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
