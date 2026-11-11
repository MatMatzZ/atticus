select * from no_plan();

-- Helpers -------------------------------------------------------------
create function qa.ld(p_user uuid, p_id uuid, p_outcome text, p_at text, p_force boolean default false, p_med text default 'med')
returns jsonb language sql as $$
  select case when r like 'err:%' then jsonb_build_object('status', r) else r::jsonb end
  from (select qa.call(p_user, format('select public.log_dose(%L::uuid, {%s}, %L, %L::timestamptz, null, null, null, %L)::text',
                                       p_id, p_med, p_outcome, p_at, p_force)) r) x
$$;
create function qa.qty(p_med text default 'med') returns numeric language sql as $$ select quantity_on_hand from public.medications where id = qa.u(p_med) $$;
create function qa.n_events(p_id uuid) returns int language sql as $$ select count(*)::int from public.dose_events where id = p_id $$;

-- ====================================================================
-- DOSE-1  happy path, inventory decrement, idempotent retry
-- ====================================================================
select is(qa.ld(qa.u('owner'), 'aaaaaaaa-0000-4000-8000-000000000001', 'given', '2026-11-12 08:00:00+00') ->> 'status', 'logged', 'DOSE-1 first dose is logged');
select is(qa.qty(), 38.25, 'DOSE-1 inventory decremented by the current dose (40 - 1.75)');
select is(qa.ld(qa.u('owner'), 'aaaaaaaa-0000-4000-8000-000000000001', 'given', '2026-11-12 08:00:00+00') ->> 'status', 'already_logged', 'DOSE-2 offline retry of same UUID is idempotent');
select is(qa.qty(), 38.25, 'DOSE-2 idempotent retry does not decrement again');
select is(qa.n_events('aaaaaaaa-0000-4000-8000-000000000001'), 1, 'DOSE-2 exactly one row for the UUID');

-- ====================================================================
-- DOSE-3  duplicate guard
-- ====================================================================
select is(qa.ld(qa.u('cg'), 'aaaaaaaa-0000-4000-8000-000000000002', 'given', '2026-11-12 08:02:00+00') ->> 'status', 'needs_confirmation', 'DOSE-3 second caregiver within 60 min gets needs_confirmation');
select is(qa.ld(qa.u('cg'), 'aaaaaaaa-0000-4000-8000-000000000002', 'given', '2026-11-12 08:02:00+00') #>> '{conflict,logged_by_name}', 'Ana', 'DOSE-3 warning names who gave it ("Already given by Ana")');
select is(qa.n_events('aaaaaaaa-0000-4000-8000-000000000002'), 0, 'DOSE-3 unconfirmed dose is NOT written');
select is(qa.qty(), 38.25, 'DOSE-3 unconfirmed dose does not touch inventory');
select is(qa.ld(qa.u('cg'), 'aaaaaaaa-0000-4000-8000-000000000002', 'given', '2026-11-12 08:02:00+00', true) ->> 'status', 'logged', 'DOSE-4 force=true logs the confirmed duplicate');
select is(qa.qty(), 36.5, 'DOSE-4 forced dose decrements inventory again');
-- window boundary is strict (<): 08:02 + 60 min exactly is allowed, 1 s earlier is not
select is(qa.ld(qa.u('cg'), 'aaaaaaaa-0000-4000-8000-000000000003', 'given', '2026-11-12 09:01:59+00') ->> 'status', 'needs_confirmation', 'DOSE-5 59m59s after previous -> guard fires');
select is(qa.ld(qa.u('cg'), 'aaaaaaaa-0000-4000-8000-000000000004', 'given', '2026-11-12 09:02:00+00') ->> 'status', 'logged', 'DOSE-5 exactly 60m after previous -> allowed');
-- guard is symmetric (offline device logs an EARLIER time than an existing dose)
select is(qa.ld(qa.u('sitter'), 'aaaaaaaa-0000-4000-8000-000000000005', 'given', '2026-11-12 08:40:00+00') ->> 'status', 'needs_confirmation', 'DOSE-6 back-dated (offline) dose inside window of a later dose is flagged');
-- non-given outcomes never trigger the guard and never consume stock
select is(qa.ld(qa.u('cg'), 'aaaaaaaa-0000-4000-8000-000000000006', 'skipped', '2026-11-12 09:05:00+00') ->> 'status', 'logged', 'DOSE-7 skipped inside window is logged');
select is(qa.ld(qa.u('cg'), 'aaaaaaaa-0000-4000-8000-000000000007', 'refused', '2026-11-12 09:06:00+00') ->> 'status', 'logged', 'DOSE-7 refused inside window is logged');
select is(qa.qty(), 34.75, 'DOSE-7 skipped/refused do not decrement inventory (only the 09:02 dose did)');
-- vomited_after after a given dose is flagged (documented behaviour; UI should void+relog)
select is(qa.ld(qa.u('cg'), 'aaaaaaaa-0000-4000-8000-000000000008', 'vomited_after', '2026-11-12 09:20:00+00') ->> 'status', 'needs_confirmation', 'DOSE-8 vomited_after inside window of a given dose requires confirmation (documented)');

-- ====================================================================
-- VOID: inventory restore, idempotence, permissions
-- ====================================================================
select is(qa.call(qa.u('owner'), 'select public.void_dose(''aaaaaaaa-0000-4000-8000-000000000001'', ''wrong pet'')'), '', 'VOID-1 owner voids first dose');
select is(qa.qty(), 36.5, 'VOID-1 inventory restored by exactly inventory_decremented (+1.75)');
select is(qa.call(qa.u('owner'), 'select public.void_dose(''aaaaaaaa-0000-4000-8000-000000000001'')'), '', 'VOID-2 voiding twice is a no-op');
select is(qa.qty(), 36.5, 'VOID-2 second void does not restore inventory twice');
select is((select voided_by from public.dose_events where id='aaaaaaaa-0000-4000-8000-000000000001'), qa.u('owner'), 'VOID-1 voided_by recorded');
-- concurrent-looking sequence: voided dose no longer blocks a new dose in its window
select is(qa.ld(qa.u('owner'), 'aaaaaaaa-0000-4000-8000-000000000009', 'given', '2026-11-12 11:00:00+00') ->> 'status', 'logged', 'VOID-3 setup: dose at 11:00 logged');
select is(qa.call(qa.u('owner'), 'select public.void_dose(''aaaaaaaa-0000-4000-8000-000000000009'')'), '', 'VOID-3 void it');
select is(qa.ld(qa.u('cg'), 'aaaaaaaa-0000-4000-8000-00000000000a', 'given', '2026-11-12 11:10:00+00') ->> 'status', 'logged', 'VOID-3 a voided dose does not trigger the duplicate guard');

select is(qa.call(qa.u('sitter'), 'select public.void_dose(''aaaaaaaa-0000-4000-8000-00000000000a'')'), 'err:42501', 'VOID-4 sitter cannot void a caregiver''s entry');
select is(qa.call(qa.u('vet'),     'select public.void_dose(''aaaaaaaa-0000-4000-8000-00000000000a'')'), 'err:42501', 'VOID-4 vet cannot void');
select is(qa.call(qa.u('outsider'),'select public.void_dose(''aaaaaaaa-0000-4000-8000-00000000000a'')'), 'err:42501', 'VOID-4 outsider cannot void');
select is(qa.call(qa.u('owner2'),  'select public.void_dose(''aaaaaaaa-0000-4000-8000-00000000000a'')'), 'err:42501', 'VOID-4 other household''s owner cannot void');
-- sitter logs, then can void own
select is(qa.ld(qa.u('sitter'), 'aaaaaaaa-0000-4000-8000-00000000000b', 'given', '2026-11-12 14:00:00+00') ->> 'status', 'logged', 'VOID-5 sitter logs a dose');
select is(qa.call(qa.u('sitter'), 'select public.void_dose(''aaaaaaaa-0000-4000-8000-00000000000b'')'), '', 'VOID-5 sitter may void own dose while access is active');
-- access revoked => must not be able to alter records afterwards
insert into public.dose_events (id, medication_id, pet_id, outcome, amount, inventory_decremented, logged_by, given_at)
  values ('aaaaaaaa-0000-4000-8000-00000000000c', qa.u('med'), qa.u('pet'), 'given', 1.75, 1.75, qa.u('sitterx'), '2026-11-12 16:00:00+00');
update public.medications set quantity_on_hand = quantity_on_hand - 1.75 where id = qa.u('med');
select is(qa.call(qa.u('sitterx'), 'select public.void_dose(''aaaaaaaa-0000-4000-8000-00000000000c'')'), 'err:42501', 'VOID-6 EXPIRED sitter must not void their old entry (access ended)');
delete from public.household_members where household_id = qa.u('hh') and user_id = qa.u('cg');
select is(qa.call(qa.u('cg'), 'select public.void_dose(''aaaaaaaa-0000-4000-8000-000000000002'')'), 'err:42501', 'VOID-6 REMOVED caregiver must not void their old entry');
insert into public.household_members (household_id, user_id, role) values (qa.u('hh'), qa.u('cg'), 'caregiver');

-- ====================================================================
-- Inventory edge cases
-- ====================================================================
update public.medications set quantity_on_hand = 1.0, refill_alert_at = 5 where id = qa.u('med2');   -- OtherMed in hh2, dose 1
insert into public.pets (id, household_id, name, species) values ('00000000-0000-4000-8000-0000000000c3', qa.u('hh'), 'Pet3', 'dog');
insert into public.medications (id, pet_id, name, quantity_on_hand, refill_alert_at) values ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000c3', 'Small', 1.0, 2);
insert into public.medication_versions (medication_id, dose_amount) values ('00000000-0000-4000-8000-0000000000d3', 1.75);
insert into qa.ids values ('med3', '00000000-0000-4000-8000-0000000000d3');
select is(qa.ld(qa.u('owner'), 'bbbbbbbb-0000-4000-8000-000000000001', 'given', '2026-11-12 08:00:00+00', false, 'med3') ->> 'refill_needed', 'true', 'INV-1 refill_needed set when stock <= refill_alert_at');
select is(qa.qty('med3'), 0.000::numeric, 'INV-1 stock clamps at 0 (never negative)');
select is((select inventory_decremented from public.dose_events where id='bbbbbbbb-0000-4000-8000-000000000001'), 1.000::numeric, 'INV-1 inventory_decremented records the clamped value');
select is(qa.call(qa.u('owner'), 'select public.void_dose(''bbbbbbbb-0000-4000-8000-000000000001'')'), '', 'INV-2 void of clamped dose');
select is(qa.qty('med3'), 1.000::numeric, 'INV-2 void restores exactly what was removed (1.0, not 1.75)');
update public.medications set quantity_on_hand = null where id = qa.u('med3');
select is(qa.ld(qa.u('owner'), 'bbbbbbbb-0000-4000-8000-000000000002', 'given', '2026-11-12 08:00:00+00', false, 'med3') ->> 'status', 'logged', 'INV-3 untracked inventory (NULL) still logs');
select is(qa.qty('med3'), null::numeric, 'INV-3 NULL inventory stays NULL');
select is(qa.call(qa.u('owner'), 'select public.void_dose(''bbbbbbbb-0000-4000-8000-000000000002'')'), '', 'INV-3 void with NULL inventory does not error');
select is(qa.qty('med3'), null::numeric, 'INV-3 NULL inventory stays NULL after void');

-- ====================================================================
-- change_dose versioning
-- ====================================================================
select isnt(qa.call(qa.u('owner'), 'select public.change_dose({med}, 2.0, ''per vet'')::text'), '', 'VER-1 owner changes dose');
select is((select count(*)::int from public.medication_versions where medication_id=qa.u('med') and effective_to is null), 1, 'VER-1 exactly one current version');
select is(qa.ld(qa.u('owner'), 'aaaaaaaa-0000-4000-8000-00000000000d', 'given', '2026-11-12 20:00:00+00') ->> 'status', 'logged', 'VER-2 dose after change');
select is((select amount from public.dose_events where id='aaaaaaaa-0000-4000-8000-00000000000d'), 2.000::numeric, 'VER-2 new dose uses the new amount');
select is((select amount from public.dose_events where id='aaaaaaaa-0000-4000-8000-000000000002'), 1.750::numeric, 'VER-2 earlier events keep their original amount');
select is(qa.call(qa.u('sitter'),  'select public.change_dose({med}, 5)::text'), 'err:42501', 'VER-3 sitter cannot change dose');
select is(qa.call(qa.u('vet'),     'select public.change_dose({med}, 5)::text'), 'err:42501', 'VER-3 vet cannot change dose');
select is(qa.call(qa.u('outsider'),'select public.change_dose({med}, 5)::text'), 'err:42501', 'VER-3 outsider cannot change dose');
select is(qa.call(qa.u('owner'),   'select public.change_dose({med}, 0)::text'), 'err:23514', 'VER-4 zero dose rejected');
select is(qa.call(qa.u('owner'),   'select public.change_dose({med}, -1)::text'), 'err:23514', 'VER-4 negative dose rejected');

-- ====================================================================
-- Authorization & validation on log_dose
-- ====================================================================
select is(qa.ld(qa.u('vet'),     'cccccccc-0000-4000-8000-000000000001', 'given', '2026-11-13 08:00:00+00') ->> 'status', 'err:42501', 'AUTH-1 vet cannot log a dose');
select is(qa.ld(qa.u('outsider'),'cccccccc-0000-4000-8000-000000000002', 'given', '2026-11-13 08:00:00+00') ->> 'status', 'err:42501', 'AUTH-1 outsider cannot log a dose');
select is(qa.ld(qa.u('sitterx'), 'cccccccc-0000-4000-8000-000000000003', 'given', '2026-11-13 08:00:00+00') ->> 'status', 'err:42501', 'AUTH-1 expired sitter cannot log a dose');
select is(qa.ld(qa.u('owner2'),  'cccccccc-0000-4000-8000-000000000004', 'given', '2026-11-13 08:00:00+00') ->> 'status', 'err:42501', 'AUTH-1 other household cannot log on our medication');
select is(qa.call(qa.u('owner'), 'select public.log_dose(''cccccccc-0000-4000-8000-000000000005'', {med}, ''given'', ''2026-11-13 08:00:00+00'', null, -1)::text'), 'err:23514', 'AUTH-2 negative amount rejected');
select is(qa.call(qa.u('owner'), 'select public.log_dose(''cccccccc-0000-4000-8000-000000000006'', ''00000000-0000-4000-8000-00000000dead'', ''given'')::text'), 'err:P0002', 'AUTH-3 unknown medication');
-- UUID reuse across households must not silently swallow a dose
select is(qa.call(qa.u('owner2'), 'select public.log_dose(''aaaaaaaa-0000-4000-8000-000000000001'', {med2}, ''given'', ''2026-11-12 08:00:00+00'', null, null, null, true)::jsonb ->> ''status'''), 'logged', 'AUTH-4 a UUID already used in ANOTHER household must not report already_logged for a dose that was never recorded');
-- Stopped medications / memorial pets
update public.medications set active = false where id = qa.u('med3');
select is(qa.ld(qa.u('owner'), 'cccccccc-0000-4000-8000-000000000007', 'given', '2026-11-13 08:00:00+00', false, 'med3') ->> 'status', 'err:P0001', 'STATE-1 logging a dose for an archived (inactive) medication is rejected');
update public.pets set status='memorial', passed_on=current_date where id = '00000000-0000-4000-8000-0000000000c3';
select is(qa.ld(qa.u('owner'), 'cccccccc-0000-4000-8000-000000000008', 'given', '2026-11-13 08:00:00+00', false, 'med3') ->> 'status', 'err:P0001', 'STATE-2 logging a dose for a memorial pet is rejected');

-- ====================================================================
-- Append-only integrity: dose history must survive deletes
-- ====================================================================
select is(qa.call(qa.u('cg'), 'delete from public.medications where id={med} returning 1'), 'err:42501',
          'INTEG-1 a caregiver deleting a medication must not erase its dose history');
select cmp_ok((select count(*)::int from public.dose_events where medication_id = qa.u('med')), '>', 0, 'INTEG-1 dose_events for the medication still exist');

select * from finish();
rollback;
