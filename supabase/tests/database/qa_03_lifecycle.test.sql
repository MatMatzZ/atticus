-- QA fixture prologue (identical in every file under supabase/tests/database).
-- Everything runs inside a transaction that is rolled back; no data is left behind.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
create schema qa;

create table qa.ids (k text primary key, v uuid not null);

-- Replace {key} tokens with quoted uuids; {me} = acting user.
create function qa.sub(p_sql text, p_me uuid) returns text language plpgsql as $$
declare r record; s text := p_sql;
begin
  for r in select k, v from qa.ids loop s := replace(s, '{' || r.k || '}', quote_literal(r.v::text) || '::uuid'); end loop;
  return replace(s, '{me}', coalesce(quote_literal(p_me::text) || '::uuid', 'null'));
end $$;

-- Run p_sql as an authenticated user (or anon when p_role='anon'); changes PERSIST on success.
-- Returns first column of first row as text, '' when none, or 'err:<sqlstate>' on failure.
create function qa.call(p_user uuid, p_sql text, p_role text default 'authenticated') returns text language plpgsql as $$
declare v_old text := current_setting('role'); res text := ''; s text := qa.sub(p_sql, p_user);
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', p_role)::text, true);
    perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
    perform set_config('role', p_role, true);
    execute s into res;
  exception when others then
    res := 'err:' || sqlstate;
  end;
  perform set_config('role', v_old, true);
  return coalesce(res, '');
end $$;

-- Run p_sql as a user and ROLL IT BACK. Returns 'rows' | 'none' | 'err:<sqlstate>'.
create function qa.attempt(p_user uuid, p_sql text, p_role text default 'authenticated') returns text language plpgsql as $$
declare n int; res text; s text := qa.sub(p_sql, p_user);
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', p_role)::text, true);
    perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
    perform set_config('role', p_role, true);
    execute s;
    get diagnostics n = row_count;
    res := case when n > 0 then 'rows' else 'none' end;
    raise exception 'qa_rollback' using errcode = 'QA000';
  exception
    when sqlstate 'QA000' then null;
    when others then res := 'err:' || sqlstate;
  end;
  return res;
end $$;

create function qa.u(p_k text) returns uuid language sql as $$ select v from qa.ids where k = p_k $$;

-- ---- users: owner, caregiver (cg), sitter, sitterx (expired), vet, outsider, owner2 (other household)
insert into qa.ids values
 ('owner','00000000-0000-4000-8000-0000000000a1'),('cg','00000000-0000-4000-8000-0000000000a2'),
 ('sitter','00000000-0000-4000-8000-0000000000a3'),('sitterx','00000000-0000-4000-8000-0000000000a4'),
 ('vet','00000000-0000-4000-8000-0000000000a5'),('outsider','00000000-0000-4000-8000-0000000000a6'),
 ('owner2','00000000-0000-4000-8000-0000000000a7'),
 ('hh','00000000-0000-4000-8000-0000000000b1'),('hh2','00000000-0000-4000-8000-0000000000b2'),
 ('pet','00000000-0000-4000-8000-0000000000c1'),('pet2','00000000-0000-4000-8000-0000000000c2'),
 ('med','00000000-0000-4000-8000-0000000000d1'),('med2','00000000-0000-4000-8000-0000000000d2'),
 ('ver','00000000-0000-4000-8000-0000000000e1'),('ver2','00000000-0000-4000-8000-0000000000e2'),
 ('dose','00000000-0000-4000-8000-0000000000f1'),('feed','00000000-0000-4000-8000-0000000000f2'),
 ('obs','00000000-0000-4000-8000-0000000000f3'),('note','00000000-0000-4000-8000-0000000000f4'),
 ('inv','00000000-0000-4000-8000-0000000000f5'),('contact','00000000-0000-4000-8000-0000000000f6'),
 ('msched','00000000-0000-4000-8000-0000000000f7'),('mealsched','00000000-0000-4000-8000-0000000000f8'),
 ('cond','00000000-0000-4000-8000-0000000000f9'),('thr','00000000-0000-4000-8000-0000000000fa');

insert into auth.users (id, instance_id, aud, role, email)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '@qa.test'
from qa.ids where k in ('owner','cg','sitter','sitterx','vet','outsider','owner2');
update public.profiles p set display_name = case i.k when 'owner' then 'Ana' when 'cg' then 'Ben' else i.k end
from qa.ids i where i.v = p.id;

insert into public.households (id, name, created_by) values (qa.u('hh'),'QA House',qa.u('owner')), (qa.u('hh2'),'Other House',qa.u('owner2'));
insert into public.household_members (household_id, user_id, role, expires_at) values
 (qa.u('hh'),qa.u('owner'),'owner',null), (qa.u('hh'),qa.u('cg'),'caregiver',null),
 (qa.u('hh'),qa.u('sitter'),'sitter', now() + interval '30 days'),
 (qa.u('hh'),qa.u('sitterx'),'sitter', now() - interval '1 day'),
 (qa.u('hh'),qa.u('vet'),'vet',null), (qa.u('hh2'),qa.u('owner2'),'owner',null);
insert into public.pets (id, household_id, name, species) values (qa.u('pet'),qa.u('hh'),'Bantay','dog'), (qa.u('pet2'),qa.u('hh2'),'Other','cat');
insert into public.medications (id, pet_id, name, quantity_on_hand, refill_alert_at, duplicate_warning_minutes)
 values (qa.u('med'),qa.u('pet'),'Pimobendan',40,10,60), (qa.u('med2'),qa.u('pet2'),'OtherMed',20,5,60);
insert into public.medication_versions (id, medication_id, dose_amount) values (qa.u('ver'),qa.u('med'),1.75), (qa.u('ver2'),qa.u('med2'),1);
insert into public.med_schedules (id, medication_id, time_of_day) values (qa.u('msched'),qa.u('med'),'08:00');
insert into public.meal_schedules (id, pet_id, time_of_day) values (qa.u('mealsched'),qa.u('pet'),'08:00');
insert into public.pet_conditions (id, pet_id, preset_key) values (qa.u('cond'),qa.u('pet'),'heart_disease');
insert into public.pet_thresholds (id, pet_id, metric, comparator, value, unit) values (qa.u('thr'),qa.u('pet'),'rrr','>',99,'breaths/min');
insert into public.vet_contacts (id, household_id, name) values (qa.u('contact'),qa.u('hh'),'Dr QA');
insert into public.dose_events (id, medication_id, pet_id, medication_version_id, outcome, amount, logged_by)
 values (qa.u('dose'),qa.u('med'),qa.u('pet'),qa.u('ver'),'given',1.75,qa.u('cg'));
insert into public.feeding_events (id, pet_id, portion_eaten, logged_by) values (qa.u('feed'),qa.u('pet'),0.5,qa.u('cg'));
insert into public.observation_events (id, pet_id, kind, logged_by) values (qa.u('obs'),qa.u('pet'),'cough',qa.u('cg'));
insert into public.handoff_notes (id, pet_id, body, created_by) values (qa.u('note'),qa.u('pet'),'note',qa.u('cg'));
insert into public.household_invites (id, household_id, role, created_by) values (qa.u('inv'),qa.u('hh'),'caregiver',qa.u('owner'));
select * from no_plan();

-- ====================================================================
-- accept_invite
-- ====================================================================
update public.household_invites set token = 'tok-inv' where id = qa.u('inv');
select is(qa.call(qa.u('outsider'), 'select public.accept_invite(''tok-inv'')::text'), qa.u('hh')::text, 'INV-1 valid invite returns household id');
select is((select role::text from public.household_members where household_id=qa.u('hh') and user_id=qa.u('outsider')), 'caregiver', 'INV-1 joiner gets the invited role');
select is(qa.call(qa.u('owner2'), 'select public.accept_invite(''tok-inv'')::text'), 'err:P0001', 'INV-2 an accepted invite cannot be reused by someone else');
-- expired / unknown
insert into public.household_invites (id, household_id, role, token, expires_at) values ('00000000-0000-4000-8000-0000000000f0', qa.u('hh'), 'caregiver', 'expiredtoken', now() - interval '1 minute');
select is(qa.call(qa.u('owner2'), 'select public.accept_invite(''expiredtoken'')::text'), 'err:P0001', 'INV-3 expired invite rejected');
select is(qa.call(qa.u('owner2'), 'select public.accept_invite(''nope'')::text'), 'err:P0001', 'INV-3 unknown token rejected');
-- sitter invites
select is(qa.call(qa.u('owner'), 'insert into public.household_invites(household_id, role) values ({hh}, ''sitter'') returning 1'), 'err:23514', 'INV-4 sitter invite without end date rejected');
select is(qa.call(qa.u('owner'), 'insert into public.household_invites(household_id, role) values ({hh}, ''owner'') returning 1'), 'err:23514', 'INV-4 owner invites impossible');
select is(qa.call(qa.u('owner'), 'insert into public.household_invites(household_id, role, sitter_access_until) values ({hh}, ''sitter'', now() - interval ''1 day'') returning 1'),
          'err:23514', 'INV-5 sitter invite whose end date is already in the past is rejected at creation');
insert into public.household_invites (id, household_id, role, token, sitter_access_until) values ('00000000-0000-4000-8000-0000000000f1', qa.u('hh'), 'sitter', 'sittertoken', now() + interval '2 days');
select qa.call(qa.u('owner2'), 'select public.accept_invite(''sittertoken'')::text');
select ok((select expires_at between now() + interval '1 day 23 hours' and now() + interval '2 days 1 hour' from public.household_members where household_id=qa.u('hh') and user_id=qa.u('owner2')), 'INV-6 sitter membership expires at sitter_access_until');
-- an existing member must not be silently burned / role-changed by another invite
insert into public.household_invites (id, household_id, role, token) values ('00000000-0000-4000-8000-0000000000f2', qa.u('hh'), 'caregiver', 'dup-for-vet');
select qa.call(qa.u('vet'), 'select public.accept_invite(''dup-for-vet'')::text');
select is((select role::text from public.household_members where household_id=qa.u('hh') and user_id=qa.u('vet')), 'vet', 'INV-7 existing member role is never changed by an invite');
select is((select accepted_at is null from public.household_invites where id='00000000-0000-4000-8000-0000000000f2'), true, 'INV-7 invite is not consumed when it grants nothing (or the call errors)');

-- ====================================================================
-- Roles / ownership safety
-- ====================================================================
select is(qa.attempt(qa.u('owner'), 'delete from public.household_members where household_id={hh} and user_id={owner}'), 'err:42501', 'OWN-1 the last owner cannot leave (household would be orphaned)');
select is(qa.attempt(qa.u('owner'), 'update public.household_members set role=''caregiver'' where household_id={hh} and user_id={owner}'), 'err:42501', 'OWN-2 the last owner cannot demote themselves');
select is(qa.attempt(qa.u('cg'), 'update public.household_members set expires_at = now() + interval ''1 day'' where household_id={hh} and user_id={owner}'), 'none', 'OWN-3 caregiver cannot set an expiry on the owner');

-- ====================================================================
-- create_household
-- ====================================================================
select isnt(qa.call(qa.u('outsider'), 'select public.create_household(''New Home'', ''Asia/Manila'')::text'), '', 'HH-1 create_household works');
select is((select role::text from public.household_members m join public.households h on h.id=m.household_id where h.name='New Home' and m.user_id=qa.u('outsider')), 'owner', 'HH-1 creator becomes owner');
select is(qa.call(qa.u('outsider'), 'select public.create_household(''   '', ''Asia/Manila'')::text'), 'err:23514', 'HH-2 blank name rejected');
select is(qa.call(qa.u('outsider'), 'select public.create_household(''Bad TZ'', ''Not/AZone'')::text'), 'err:22023', 'HH-3 invalid IANA timezone rejected (Next Up + reminders depend on it)');
select is(qa.call(qa.u('outsider'), 'select public.create_household(''Bad TZ2'', '''')::text'), 'err:22023', 'HH-3 empty timezone rejected');

-- ====================================================================
-- Memorial mode
-- ====================================================================
select is(qa.call(qa.u('cg'),      'select public.set_pet_memorial({pet})::text'), 'err:42501', 'MEM-1 caregiver cannot set memorial');
select is(qa.call(qa.u('owner2'),  'select public.set_pet_memorial({pet})::text'), 'err:42501', 'MEM-1 other household cannot set memorial');
select is(qa.call(qa.u('owner'),   'select public.set_pet_memorial({pet}, ''2026-11-10'')::text'), '', 'MEM-2 owner sets memorial');
select is((select status::text || passed_on::text from public.pets where id=qa.u('pet')), 'memorial2026-11-10', 'MEM-2 status + passed_on recorded');
select is((select count(*)::int from public.medications where pet_id=qa.u('pet') and active), 0, 'MEM-2 all medications deactivated');
select is((select count(*)::int from public.med_schedules s join public.medications m on m.id=s.medication_id where m.pet_id=qa.u('pet') and s.active), 0, 'MEM-2 all medication schedules deactivated');
select is((select count(*)::int from public.meal_schedules where pet_id=qa.u('pet') and active), 0, 'MEM-2 all meal schedules deactivated');
select cmp_ok((select count(*)::int from public.dose_events where pet_id=qa.u('pet')), '>', 0, 'MEM-2 records are kept');
-- memorial must be sticky: a caregiver must not be able to quietly re-enable reminders
select is(qa.attempt(qa.u('cg'), 'update public.medications set active=true where pet_id={pet}'), 'none', 'MEM-3 caregiver cannot reactivate medications of a memorial pet');
select is(qa.attempt(qa.u('cg'), 'update public.med_schedules set active=true where medication_id={med}'), 'none', 'MEM-3 caregiver cannot reactivate schedules of a memorial pet');
select is(qa.attempt(qa.u('cg'), 'update public.meal_schedules set active=true where pet_id={pet}'), 'none', 'MEM-3 caregiver cannot reactivate meal schedules of a memorial pet');
select is(qa.attempt(qa.u('cg'), 'update public.pets set status=''active'' where id={pet}'), 'none', 'MEM-3 caregiver cannot reverse memorial status');
select is(qa.attempt(qa.u('cg'), 'insert into public.med_schedules(medication_id,time_of_day) values ({med},''10:00'')'), 'err:42501', 'MEM-4 no new schedules can be added to a memorial pet');
select is(qa.attempt(qa.u('cg'), 'insert into public.meal_schedules(pet_id,time_of_day) values ({pet},''10:00'')'), 'err:42501', 'MEM-4 no new meal schedules on a memorial pet');

select * from finish();
rollback;
