-- =====================================================================
-- ATTICUS — RLS / function hardening (found while writing BE-1 pgTAP tests)
--
-- 1. Security-definer helpers were executable by PUBLIC/anon. pet_household()
--    leaked a pet's household id to unauthenticated callers. Lock them to
--    authenticated (RLS policies still need them); the trigger function is
--    not callable by API roles at all.
-- 2. profiles_select ignored sitter expiry: an expired sitter could still read
--    the profiles of the household they used to belong to.
-- 3. void_dose let the original logger void a dose even after their access
--    ended (expired sitter / removed member).
-- 4. medication_versions were directly updatable/deletable by caregivers,
--    bypassing change_dose() and rewriting dose history. Now insert-only;
--    history changes go through change_dose().
-- =====================================================================

-- 1. Function execute privileges -------------------------------------------
revoke execute on function public.current_role_in(uuid)                         from public, anon;
revoke execute on function public.is_member(uuid)                               from public, anon;
revoke execute on function public.has_role(uuid, public.member_role[])          from public, anon;
revoke execute on function public.pet_household(uuid)                           from public, anon;
grant  execute on function public.current_role_in(uuid)                         to authenticated;
grant  execute on function public.is_member(uuid)                               to authenticated;
grant  execute on function public.has_role(uuid, public.member_role[])          to authenticated;
grant  execute on function public.pet_household(uuid)                           to authenticated;

-- Trigger-only functions: never callable through the API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at()  from public, anon, authenticated;

-- 2. Profiles: only people you currently share a household with -----------
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.household_members theirs
    where theirs.user_id = profiles.id
      and public.is_member(theirs.household_id)));

-- 3. void_dose: caller must still have write access to the household -------
create or replace function public.void_dose(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ev public.dose_events; v_hh uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select * into v_ev from public.dose_events where id = p_id for update;
  if not found then raise exception 'dose not found' using errcode = 'P0002'; end if;

  v_hh := public.pet_household(v_ev.pet_id);
  -- Owner/caregiver may void anything; a sitter only their own, and only while active.
  if not (public.has_role(v_hh, '{owner,caregiver}')
          or (v_ev.logged_by = auth.uid() and public.has_role(v_hh, '{sitter}'))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if v_ev.voided_at is not null then return; end if;

  update public.dose_events
     set voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
   where id = p_id;

  if v_ev.inventory_decremented > 0 then
    update public.medications
       set quantity_on_hand = quantity_on_hand + v_ev.inventory_decremented
     where id = v_ev.medication_id and quantity_on_hand is not null;
  end if;
end $$;
revoke execute on function public.void_dose(uuid, text) from public, anon;
grant  execute on function public.void_dose(uuid, text) to authenticated;

-- 4. medication_versions: insert-only from the API -------------------------
drop policy medver_write on public.medication_versions;
create policy medver_insert on public.medication_versions for insert to authenticated
  with check (exists (select 1 from public.medications m where m.id = medication_id
                      and public.has_role(public.pet_household(m.pet_id), '{owner,caregiver}')));
