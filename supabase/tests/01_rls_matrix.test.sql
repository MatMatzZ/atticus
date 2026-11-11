-- Role matrix: owner, caregiver, sitter (active + expired), vet, outsider
-- × select / insert / update / delete on every public table (+ view, storage).
begin;
\ir _fixture.psql

create temp table cases (tbl text, op text, stmt text, allowed text[]) on commit drop;

insert into cases values
-- profiles: see yourself + current housemates; edit only yourself
('profiles', 'select', $$select count(*) from public.profiles where id = '{owner}'$$, '{owner,caregiver,sitter,vet}'),
('profiles', 'insert', $$insert into public.profiles (id) values ('{outsider}')$$, '{}'),
('profiles', 'update', $$update public.profiles set display_name = 'x' where id = '{owner}'$$, '{owner}'),
('profiles', 'delete', $$delete from public.profiles where id = '{owner}'$$, '{}'),

-- households: created only via create_household(); owner manages
('households', 'select', $$select count(*) from public.households where id = '{H}'$$, '{owner,caregiver,sitter,vet}'),
('households', 'insert', $$insert into public.households (name) values ('x')$$, '{}'),
('households', 'update', $$update public.households set name = 'x' where id = '{H}'$$, '{owner}'),
('households', 'delete', $$delete from public.households where id = '{H}'$$, '{owner}'),

-- household_members: joined only via accept_invite(); owner manages; anyone may leave
('household_members', 'select', $$select count(*) from public.household_members where household_id = '{H}'$$, '{owner,caregiver,sitter,vet}'),
('household_members', 'insert', $$insert into public.household_members (household_id, user_id, role) values ('{H}', '{outsider}', 'caregiver')$$, '{}'),
('household_members', 'update', $$update public.household_members set role = 'vet' where household_id = '{H}' and user_id = '{caregiver}'$$, '{owner}'),
('household_members', 'delete', $$delete from public.household_members where household_id = '{H}' and user_id = '{caregiver}'$$, '{owner,caregiver}'),

-- household_invites: owner only
('household_invites', 'select', $$select count(*) from public.household_invites where household_id = '{H}'$$, '{owner}'),
('household_invites', 'insert', $$insert into public.household_invites (household_id, role) values ('{H}', 'caregiver')$$, '{owner}'),
('household_invites', 'update', $$update public.household_invites set expires_at = now() + interval '1 day' where id = '{INV}'$$, '{owner}'),
('household_invites', 'delete', $$delete from public.household_invites where id = '{INV}'$$, '{owner}'),

-- condition_presets: read-only reference data for any signed-in user
('condition_presets', 'select', $$select count(*) from public.condition_presets where key = 'heart_disease'$$, '{owner,caregiver,sitter,sitter_expired,vet,outsider}'),
('condition_presets', 'insert', $$insert into public.condition_presets (key, name) values ('x', 'x')$$, '{}'),
('condition_presets', 'update', $$update public.condition_presets set name = 'x' where key = 'ckd'$$, '{}'),
('condition_presets', 'delete', $$delete from public.condition_presets where key = 'ckd'$$, '{}'),

-- pets: members read, owner/caregiver write, owner deletes
('pets', 'select', $$select count(*) from public.pets where id = '{P}'$$, '{owner,caregiver,sitter,vet}'),
('pets', 'insert', $$insert into public.pets (household_id, name, species) values ('{H}', 'x', 'cat')$$, '{owner,caregiver}'),
('pets', 'update', $$update public.pets set breed = 'x' where id = '{P}'$$, '{owner,caregiver}'),
('pets', 'delete', $$delete from public.pets where id = '{P}'$$, '{owner}'),

-- care-plan tables: members read, owner/caregiver write
('pet_conditions', 'select', $$select count(*) from public.pet_conditions where pet_id = '{P}'$$, '{owner,caregiver,sitter,vet}'),
('pet_conditions', 'insert', $$insert into public.pet_conditions (pet_id, preset_key) values ('{P}', 'ckd')$$, '{owner,caregiver}'),
('pet_conditions', 'update', $$update public.pet_conditions set notes = 'x' where id = '{COND}'$$, '{owner,caregiver}'),
('pet_conditions', 'delete', $$delete from public.pet_conditions where id = '{COND}'$$, '{owner,caregiver}'),

('pet_thresholds', 'select', $$select count(*) from public.pet_thresholds where pet_id = '{P}'$$, '{owner,caregiver,sitter,vet}'),
('pet_thresholds', 'insert', $$insert into public.pet_thresholds (pet_id, metric, comparator, value, unit) values ('{P}', 'weight', '<', 1, 'kg')$$, '{owner,caregiver}'),
('pet_thresholds', 'update', $$update public.pet_thresholds set vet_instruction = 'x' where id = '{THR}'$$, '{owner,caregiver}'),
('pet_thresholds', 'delete', $$delete from public.pet_thresholds where id = '{THR}'$$, '{owner,caregiver}'),

('vet_contacts', 'select', $$select count(*) from public.vet_contacts where household_id = '{H}'$$, '{owner,caregiver,sitter,vet}'),
('vet_contacts', 'insert', $$insert into public.vet_contacts (household_id, name) values ('{H}', 'x')$$, '{owner,caregiver}'),
('vet_contacts', 'update', $$update public.vet_contacts set phone = '1' where id = '{CON}'$$, '{owner,caregiver}'),
('vet_contacts', 'delete', $$delete from public.vet_contacts where id = '{CON}'$$, '{owner,caregiver}'),

('medications', 'select', $$select count(*) from public.medications where pet_id = '{P}'$$, '{owner,caregiver,sitter,vet}'),
('medications', 'insert', $$insert into public.medications (pet_id, name) values ('{P}', 'x')$$, '{owner,caregiver}'),
('medications', 'update', $$update public.medications set strength = 'x' where id = '{M}'$$, '{owner,caregiver}'),
('medications', 'delete', $$delete from public.medications where id = '{M}'$$, '{owner,caregiver}'),

-- medication_versions: dose history is insert-only (changes via change_dose())
('medication_versions', 'select', $$select count(*) from public.medication_versions where medication_id = '{M}'$$, '{owner,caregiver,sitter,vet}'),
('medication_versions', 'insert', $$insert into public.medication_versions (medication_id, dose_amount, effective_from, effective_to) values ('{M}', 1, now() - interval '60 days', now() - interval '31 days')$$, '{owner,caregiver}'),
('medication_versions', 'update', $$update public.medication_versions set dose_amount = 9 where id = '{MV}'$$, '{}'),
('medication_versions', 'delete', $$delete from public.medication_versions where id = '{MV}'$$, '{}'),

('med_schedules', 'select', $$select count(*) from public.med_schedules where medication_id = '{M}'$$, '{owner,caregiver,sitter,vet}'),
('med_schedules', 'insert', $$insert into public.med_schedules (medication_id, time_of_day) values ('{M}', '12:00')$$, '{owner,caregiver}'),
('med_schedules', 'update', $$update public.med_schedules set active = false where id = '{MS}'$$, '{owner,caregiver}'),
('med_schedules', 'delete', $$delete from public.med_schedules where id = '{MS}'$$, '{owner,caregiver}'),

('meal_schedules', 'select', $$select count(*) from public.meal_schedules where pet_id = '{P}'$$, '{owner,caregiver,sitter,vet}'),
('meal_schedules', 'insert', $$insert into public.meal_schedules (pet_id, time_of_day) values ('{P}', '12:00')$$, '{owner,caregiver}'),
('meal_schedules', 'update', $$update public.meal_schedules set active = false where id = '{MEAL}'$$, '{owner,caregiver}'),
('meal_schedules', 'delete', $$delete from public.meal_schedules where id = '{MEAL}'$$, '{owner,caregiver}'),

-- care events: append-only; doses only via log_dose()
('dose_events', 'select', $$select count(*) from public.dose_events where pet_id = '{P}'$$, '{owner,caregiver,sitter,vet}'),
('dose_events', 'insert', $$insert into public.dose_events (id, medication_id, pet_id, outcome) values (gen_random_uuid(), '{M}', '{P}', 'given')$$, '{}'),
('dose_events', 'update', $$update public.dose_events set note = 'x' where id = '{DOSE}'$$, '{}'),
('dose_events', 'delete', $$delete from public.dose_events where id = '{DOSE}'$$, '{}'),

('feeding_events', 'select', $$select count(*) from public.feeding_events where pet_id = '{P}'$$, '{owner,caregiver,sitter,vet}'),
('feeding_events', 'insert', $$insert into public.feeding_events (id, pet_id, portion_eaten) values (gen_random_uuid(), '{P}', 1)$$, '{owner,caregiver,sitter}'),
('feeding_events', 'update', $$update public.feeding_events set note = 'x' where id = '{FEED}'$$, '{}'),
('feeding_events', 'delete', $$delete from public.feeding_events where id = '{FEED}'$$, '{}'),

('observation_events', 'select', $$select count(*) from public.observation_events where pet_id = '{P}'$$, '{owner,caregiver,sitter,vet}'),
('observation_events', 'insert', $$insert into public.observation_events (id, pet_id, kind) values (gen_random_uuid(), '{P}', 'cough')$$, '{owner,caregiver,sitter}'),
('observation_events', 'update', $$update public.observation_events set note = 'x' where id = '{OBS}'$$, '{}'),
('observation_events', 'delete', $$delete from public.observation_events where id = '{OBS}'$$, '{}'),

('handoff_notes', 'select', $$select count(*) from public.handoff_notes where pet_id = '{P}'$$, '{owner,caregiver,sitter,vet}'),
('handoff_notes', 'insert', $$insert into public.handoff_notes (pet_id, body) values ('{P}', 'x')$$, '{owner,caregiver,sitter}'),
('handoff_notes', 'update', $$update public.handoff_notes set resolved_at = now() where id = '{NOTE}'$$, '{}'),
('handoff_notes', 'delete', $$delete from public.handoff_notes where id = '{NOTE}'$$, '{}'),

-- events can't be logged as someone else
('feeding_events', 'insert as other user', $$insert into public.feeding_events (id, pet_id, portion_eaten, logged_by) values (gen_random_uuid(), '{P}', 1, '{owner}')$$, '{owner}'),

-- activity feed view inherits the caller's RLS
('activity_feed', 'select', $$select count(*) from public.activity_feed where pet_id = '{P}'$$, '{owner,caregiver,sitter,vet}'),

-- storage: <household_id>/<pet_id>/<file> in private buckets
('storage.objects', 'select', $$select count(*) from storage.objects where bucket_id = 'atticus-media' and name like '{H}/%'$$, '{owner,caregiver,sitter,vet}'),
('storage.objects', 'insert', $$insert into storage.objects (bucket_id, name) values ('atticus-media', '{H}/{P}/new.jpg')$$, '{owner,caregiver,sitter}'),
('storage.objects', 'delete', $$delete from storage.objects where bucket_id = 'atticus-media' and name = '{H}/{P}/fixture.jpg'$$, '{owner,caregiver}');

create temp table roles (r text, ord int) on commit drop;
insert into roles values ('owner', 1), ('caregiver', 2), ('sitter', 3), ('sitter_expired', 4), ('vet', 5), ('outsider', 6);

select plan((select count(*)::int * 6 from cases) + 2);

-- Every public table has RLS on
select is_empty(
  $$select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity$$,
  'every public table has RLS enabled');

-- And every public table is covered by this matrix
select is_empty(
  $$select c.relname::text from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    except select tbl from cases$$,
  'every public table is covered by the role matrix');

select is(tests.attempt(roles.r, cases.stmt), roles.r = any (cases.allowed),
          format('%s %s %s → %s', roles.r, cases.op, cases.tbl,
                 case when roles.r = any (cases.allowed) then 'allowed' else 'denied' end))
from cases cross join roles
order by cases.tbl, cases.op, roles.ord;

select * from finish();
rollback;
