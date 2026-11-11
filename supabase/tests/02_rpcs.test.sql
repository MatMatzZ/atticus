-- RPC behaviour: log_dose, void_dose, change_dose, accept_invite,
-- create_household, set_pet_memorial.
begin;
\ir _fixture.psql

select plan(60);

-- Fixed ids for doses logged in this file
create or replace function tests.dose(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid
$$;
grant execute on function tests.dose(int) to authenticated;

create or replace function tests.qty() returns numeric language sql security definer as $$
  select quantity_on_hand from public.medications where id = tests.id('M')
$$;
grant execute on function tests.qty() to authenticated;

-- =====================================================================
-- log_dose
-- =====================================================================
select tests.login('caregiver');

select is(public.log_dose(tests.dose(1), tests.id('M'), 'given') ->> 'status', 'logged',
  'log_dose: first dose is logged');
select is(tests.qty(), 38.250, 'log_dose: inventory decremented by the current dose (1.75)');

select is(public.log_dose(tests.dose(1), tests.id('M'), 'given') ->> 'status', 'already_logged',
  'log_dose: same client id is idempotent (already_logged)');
select is(tests.qty(), 38.250, 'log_dose: idempotent retry does not decrement inventory again');

select tests.login('owner');
select is(public.log_dose(tests.dose(2), tests.id('M'), 'given') ->> 'status', 'needs_confirmation',
  'log_dose: second dose inside the warning window needs confirmation');
select is(public.log_dose(tests.dose(3), tests.id('M'), 'given') -> 'conflict' ->> 'logged_by',
  tests.id('caregiver')::text, 'log_dose: conflict names who already gave it');
select is(public.log_dose(tests.dose(4), tests.id('M'), 'given') -> 'conflict' ->> 'logged_by_name',
  'caregiver', 'log_dose: conflict carries the display name');
select is(tests.qty(), 38.250, 'log_dose: needs_confirmation writes nothing');
select tests.logout();
select is((select count(*)::int from public.dose_events where id in (tests.dose(2), tests.dose(3), tests.dose(4))), 0,
  'log_dose: no event row for unconfirmed doses');

select tests.login('owner');
select is(public.log_dose(tests.dose(5), tests.id('M'), 'given', p_force => true) ->> 'status', 'logged',
  'log_dose: force=true logs despite the duplicate warning');
select is(tests.qty(), 36.500, 'log_dose: forced dose decrements inventory');

select is(public.log_dose(tests.dose(6), tests.id('M'), 'skipped') ->> 'status', 'logged',
  'log_dose: skipped is not subject to the duplicate guard');
select is(tests.qty(), 36.500, 'log_dose: skipped does not touch inventory');

select is(public.log_dose(tests.dose(7), tests.id('M'), 'given', p_given_at => now() + interval '2 hours') ->> 'status',
  'logged', 'log_dose: dose outside the window is logged');
select is(public.log_dose(tests.dose(8), tests.id('M'), 'given', p_given_at => now() + interval '6 hours', p_amount => 0.5)
  ->> 'quantity_on_hand', '34.250', 'log_dose: explicit amount overrides the version dose');

select tests.login('sitter');
select is(public.log_dose(tests.dose(9), tests.id('M'), 'given', p_given_at => now() + interval '10 hours') ->> 'status',
  'logged', 'log_dose: active sitter can log');
select tests.logout();
select is((select logged_by from public.dose_events where id = tests.dose(9)), tests.id('sitter'),
  'log_dose: event is attributed to the caller');

select tests.login('vet');
select throws_ok($$select public.log_dose(tests.dose(10), tests.id('M'), 'given', p_force => true)$$,
  '42501', 'not allowed', 'log_dose: vet (read-only) cannot log');
select tests.login('sitter_expired');
select throws_ok($$select public.log_dose(tests.dose(11), tests.id('M'), 'given', p_force => true)$$,
  '42501', 'not allowed', 'log_dose: expired sitter cannot log');
select tests.login('outsider');
select throws_ok($$select public.log_dose(tests.dose(12), tests.id('M'), 'given', p_force => true)$$,
  '42501', 'not allowed', 'log_dose: outsider cannot log');
select tests.login('caregiver');
select throws_ok($$select public.log_dose(tests.dose(13), gen_random_uuid(), 'given')$$,
  'P0002', 'medication not found', 'log_dose: unknown medication');
select tests.login_anon();
select throws_ok($$select public.log_dose(tests.dose(14), tests.id('M'), 'given')$$,
  '42501', null, 'log_dose: anon has no execute privilege');

-- Refill flag: drop stock to the alert level
select tests.logout();
update public.medications set quantity_on_hand = 11 where id = tests.id('M');
select tests.login('caregiver');
select is(public.log_dose(tests.dose(15), tests.id('M'), 'given', p_given_at => now() + interval '20 hours', p_force => true)
  ->> 'refill_needed', 'true', 'log_dose: refill_needed once stock <= refill_alert_at');
select is(public.log_dose(tests.dose(16), tests.id('M'), 'given', p_given_at => now() + interval '30 hours', p_amount => 50, p_force => true)
  ->> 'quantity_on_hand', '0.000', 'log_dose: inventory never goes negative');

-- =====================================================================
-- void_dose
-- =====================================================================
select tests.logout();
update public.medications set quantity_on_hand = 20 where id = tests.id('M');
select tests.login('caregiver');
select lives_ok($$select public.void_dose(tests.dose(1), 'wrong pet')$$, 'void_dose: caregiver voids a dose');
select is(tests.qty(), 21.750, 'void_dose: inventory restored');
select lives_ok($$select public.void_dose(tests.dose(1))$$, 'void_dose: voiding twice is a no-op');
select is(tests.qty(), 21.750, 'void_dose: second void does not restore again');
select tests.logout();
select isnt((select voided_at from public.dose_events where id = tests.dose(1)), null, 'void_dose: event is marked voided');
select is((select count(*)::int from public.dose_events where id = tests.dose(1)), 1, 'void_dose: event row is kept (append-only)');

-- A voided dose no longer triggers the duplicate guard
select tests.login('owner');
select is(public.log_dose(tests.dose(17), tests.id('M'), 'given', p_given_at => now() - interval '20 hours') ->> 'status',
  'logged', 'log_dose: voided doses do not block new ones');

select tests.login('sitter');
select lives_ok($$select public.void_dose(tests.dose(9))$$, 'void_dose: sitter can void their own dose');
select throws_ok($$select public.void_dose(tests.dose(7))$$, '42501', 'not allowed',
  'void_dose: sitter cannot void someone else''s dose');
select tests.login('sitter_expired');
select throws_ok($$select public.void_dose(tests.id('DOSE_EXPIRED'))$$, '42501', 'not allowed',
  'void_dose: expired sitter cannot void even their own dose');
select tests.login('vet');
select throws_ok($$select public.void_dose(tests.dose(7))$$, '42501', 'not allowed', 'void_dose: vet cannot void');
select tests.login('outsider');
select throws_ok($$select public.void_dose(tests.dose(7))$$, '42501', 'not allowed', 'void_dose: outsider cannot void');

-- =====================================================================
-- change_dose
-- =====================================================================
select tests.login('caregiver');
select isnt(public.change_dose(tests.id('M'), 2.0, 'Vet increased dose'), null, 'change_dose: returns the new version id');
select tests.logout();
select isnt((select effective_to from public.medication_versions where id = tests.id('MV')), null,
  'change_dose: previous version is closed');
select is((select count(*)::int from public.medication_versions where medication_id = tests.id('M') and effective_to is null), 1,
  'change_dose: exactly one current version');
select is((select dose_amount from public.medication_versions where medication_id = tests.id('M') and effective_to is null), 2.000,
  'change_dose: current version has the new amount');

select tests.login('caregiver');
select is(public.log_dose(tests.dose(18), tests.id('M'), 'given', p_given_at => now() + interval '50 hours') ->> 'status', 'logged',
  'log_dose: logs against the new version');
select tests.logout();
select is((select amount from public.dose_events where id = tests.dose(18)), 2.000, 'log_dose: uses the new dose amount');
select is((select medication_version_id from public.dose_events where id = tests.dose(18)),
  (select id from public.medication_versions where medication_id = tests.id('M') and effective_to is null),
  'log_dose: event references the current version');

select tests.login('sitter');
select throws_ok($$select public.change_dose(tests.id('M'), 3)$$, '42501', 'not allowed', 'change_dose: sitter cannot change doses');
select tests.login('vet');
select throws_ok($$select public.change_dose(tests.id('M'), 3)$$, '42501', 'not allowed', 'change_dose: vet cannot change doses');

-- =====================================================================
-- accept_invite / create_household
-- =====================================================================
select tests.logout();
insert into public.household_invites (household_id, role, token, expires_at)
  values (tests.id('H'), 'caregiver', 'tok-expired', now() - interval '1 minute');
insert into public.household_invites (household_id, role, token, sitter_access_until)
  values (tests.id('H'), 'sitter', 'tok-sitter', now() + interval '2 days');
insert into public.household_invites (household_id, role, token)
  values (tests.id('H'), 'vet', 'tok-vet');
-- A second outsider for the sitter invite
insert into auth.users (id, email, aud, role)
  values ('00000000-0000-0000-0000-0000000000a7', 'outsider2@pgtap.invalid', 'authenticated', 'authenticated');

select tests.login('outsider');
select is(public.accept_invite('tok-caregiver'), tests.id('H'), 'accept_invite: returns the household');
select tests.logout();
select is((select role::text from public.household_members where household_id = tests.id('H') and user_id = tests.id('outsider')),
  'caregiver', 'accept_invite: joins with the invited role');

select tests.login('owner');
select throws_ok($$select public.accept_invite('tok-caregiver')$$, 'P0001', 'invite is invalid or expired',
  'accept_invite: token is single-use');
select throws_ok($$select public.accept_invite('tok-expired')$$, 'P0001', 'invite is invalid or expired',
  'accept_invite: expired invite is rejected');
select throws_ok($$select public.accept_invite('no-such-token')$$, 'P0001', 'invite is invalid or expired',
  'accept_invite: unknown token is rejected');

-- Existing member accepting a lower-role invite keeps their role
select lives_ok($$select public.accept_invite('tok-vet')$$, 'accept_invite: existing member can accept');
select tests.logout();
select is((select role::text from public.household_members where household_id = tests.id('H') and user_id = tests.id('owner')),
  'owner', 'accept_invite: never changes an existing member''s role');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}', true);
select set_config('role', 'authenticated', true);
select lives_ok($$select public.accept_invite('tok-sitter')$$, 'accept_invite: sitter invite accepted');
select tests.logout();
select is((select expires_at from public.household_members where user_id = '00000000-0000-0000-0000-0000000000a7'),
  (select sitter_access_until from public.household_invites where token = 'tok-sitter'),
  'accept_invite: sitter access expires at sitter_access_until');

-- create_household
select tests.login('vet');
select ok((select public.create_household('Vet Home')) is not null, 'create_household: returns an id');
select tests.logout();
select is((select count(*)::int from public.household_members m join public.households h on h.id = m.household_id
           where h.name = 'Vet Home' and m.user_id = tests.id('vet') and m.role = 'owner'), 1,
  'create_household: caller becomes owner');

-- =====================================================================
-- set_pet_memorial
-- =====================================================================
select tests.login('caregiver');
select throws_ok($$select public.set_pet_memorial(tests.id('P'))$$, '42501', 'not allowed',
  'set_pet_memorial: caregiver cannot');
select tests.login('owner');
select lives_ok($$select public.set_pet_memorial(tests.id('P'), '2026-11-01')$$, 'set_pet_memorial: owner can');
select tests.logout();
select results_eq($$select status::text, passed_on from public.pets where id = tests.id('P')$$,
  $$values ('memorial', '2026-11-01'::date)$$, 'set_pet_memorial: pet archived with date');
select is_empty($$select 1 from public.medications where pet_id = tests.id('P') and active
                  union all select 1 from public.med_schedules s join public.medications m on m.id = s.medication_id
                    where m.pet_id = tests.id('P') and s.active
                  union all select 1 from public.meal_schedules where pet_id = tests.id('P') and active$$,
  'set_pet_memorial: every medication and schedule deactivated');

select * from finish();
rollback;
