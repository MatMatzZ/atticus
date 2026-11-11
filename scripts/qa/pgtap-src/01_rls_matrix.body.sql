select * from no_plan();

-- Role order for every matrix row: owner, caregiver, sitter, sitter(expired), vet, outsider
-- Codes: R = rows affected/visible, N = zero rows (RLS filtered), E = error 42501, Exxxxx = error with that SQLSTATE.
create temp table m (tbl text, op text, sql text, exp text);
insert into m values
('households','select','select * from public.households where id={hh}','R R R N R N'),
('households','insert','insert into public.households(name) values (''x'')','E E E E E E'),
('households','update','update public.households set name=''n'' where id={hh}','R N N N N N'),
('households','delete','delete from public.households where id={hh}','R N N N N N'),

('household_members','select','select * from public.household_members where household_id={hh}','R R R N R N'),
('household_members','insert (self as owner)','insert into public.household_members(household_id,user_id,role) values ({hh},{me},''owner'')','E E E E E E'),
('household_members','update (promote cg)','update public.household_members set role=''owner'' where household_id={hh} and user_id={cg}','R N N N N N'),
('household_members','update (self-promote; owner no-op ok)','update public.household_members set role=''owner'' where household_id={hh} and user_id={me}','R N N N N N'),
('household_members','delete (remove sitter; sitter may leave)','delete from public.household_members where household_id={hh} and user_id={sitter}','R N R N N N'),
('household_members','delete (remove owner)','delete from public.household_members where household_id={hh} and user_id={owner} and {me} <> {owner}','N N N N N N'),

('household_invites','select','select * from public.household_invites where household_id={hh}','R N N N N N'),
('household_invites','insert','insert into public.household_invites(household_id,role) values ({hh},''caregiver'')','R E E E E E'),
('household_invites','update','update public.household_invites set expires_at=now()+interval ''1 day'' where household_id={hh}','R N N N N N'),
('household_invites','delete','delete from public.household_invites where household_id={hh}','R N N N N N'),

('pets','select','select * from public.pets where id={pet}','R R R N R N'),
('pets','insert','insert into public.pets(household_id,name,species) values ({hh},''p'',''dog'')','R R E E E E'),
('pets','update','update public.pets set breed=''b'' where id={pet}','R R N N N N'),
('pets','update status->memorial (owner-only per set_pet_memorial)','update public.pets set status=''memorial'' where id={pet}','R N N N N N'),
('pets','update household_id (move pet)','update public.pets set household_id={hh2} where id={pet}','E E N N N N'),
('pets','delete','delete from public.pets where id={pet}','R N N N N N'),

('condition_presets','select','select * from public.condition_presets','R R R R R R'),
('condition_presets','insert','insert into public.condition_presets(key,name) values (''zz'',''zz'')','E E E E E E'),
('condition_presets','update','update public.condition_presets set name=''x''','N N N N N N'),
('condition_presets','delete','delete from public.condition_presets','N N N N N N'),

('pet_conditions','select','select * from public.pet_conditions where pet_id={pet}','R R R N R N'),
('pet_conditions','insert','insert into public.pet_conditions(pet_id,preset_key) values ({pet},''ckd'')','R R E E E E'),
('pet_conditions','update','update public.pet_conditions set notes=''n'' where pet_id={pet}','R R N N N N'),
('pet_conditions','delete','delete from public.pet_conditions where pet_id={pet}','R R N N N N'),

('pet_thresholds','select','select * from public.pet_thresholds where pet_id={pet}','R R R N R N'),
('pet_thresholds','insert','insert into public.pet_thresholds(pet_id,metric,comparator,value,unit) values ({pet},''rrr'',''<'',1,''x'')','R R E E E E'),
('pet_thresholds','update','update public.pet_thresholds set value=1 where pet_id={pet}','R R N N N N'),
('pet_thresholds','delete','delete from public.pet_thresholds where pet_id={pet}','R R N N N N'),

('vet_contacts','select','select * from public.vet_contacts where household_id={hh}','R R R N R N'),
('vet_contacts','insert','insert into public.vet_contacts(household_id,name) values ({hh},''v'')','R R E E E E'),
('vet_contacts','update','update public.vet_contacts set phone=''1'' where household_id={hh}','R R N N N N'),
('vet_contacts','delete','delete from public.vet_contacts where household_id={hh}','R R N N N N'),

('medications','select','select * from public.medications where pet_id={pet}','R R R N R N'),
('medications','insert','insert into public.medications(pet_id,name) values ({pet},''m'')','R R E E E E'),
('medications','update','update public.medications set strength=''s'' where id={med}','R R N N N N'),
('medications','update quantity_on_hand directly (inventory only via RPC/Add supply)','update public.medications set quantity_on_hand=999 where id={med}','R R N N N N'),
('medications','delete (must not erase dose history -> see 02)','delete from public.medications where id={med}','R N N N N N'),

('medication_versions','select','select * from public.medication_versions where medication_id={med}','R R R N R N'),
('medication_versions','insert (2nd current row => unique idx; RLS passes owner/cg)','insert into public.medication_versions(medication_id,dose_amount) values ({med},1)','E23505 E23505 E E E E'),
('medication_versions','update dose_amount in place (must use change_dose)','update public.medication_versions set dose_amount=9 where medication_id={med}','N N N N N N'),
('medication_versions','delete history row','delete from public.medication_versions where medication_id={med}','N N N N N N'),

('med_schedules','select','select * from public.med_schedules where medication_id={med}','R R R N R N'),
('med_schedules','insert','insert into public.med_schedules(medication_id,time_of_day) values ({med},''09:00'')','R R E E E E'),
('med_schedules','update','update public.med_schedules set active=false where medication_id={med}','R R N N N N'),
('med_schedules','delete','delete from public.med_schedules where medication_id={med}','R R N N N N'),

('meal_schedules','select','select * from public.meal_schedules where pet_id={pet}','R R R N R N'),
('meal_schedules','insert','insert into public.meal_schedules(pet_id,time_of_day) values ({pet},''09:00'')','R R E E E E'),
('meal_schedules','update','update public.meal_schedules set active=false where pet_id={pet}','R R N N N N'),
('meal_schedules','delete','delete from public.meal_schedules where pet_id={pet}','R R N N N N'),

('dose_events','select','select * from public.dose_events where pet_id={pet}','R R R N R N'),
('dose_events','insert direct (must use log_dose)','insert into public.dose_events(id,medication_id,pet_id,outcome,logged_by) values (gen_random_uuid(),{med},{pet},''given'',{me})','E E E E E E'),
('dose_events','update (tamper)','update public.dose_events set amount=99 where id={dose}','N N N N N N'),
('dose_events','update (self-void bypassing void_dose inventory restore)','update public.dose_events set voided_at=now() where id={dose}','N N N N N N'),
('dose_events','delete','delete from public.dose_events where id={dose}','N N N N N N'),

('feeding_events','select','select * from public.feeding_events where pet_id={pet}','R R R N R N'),
('feeding_events','insert as self','insert into public.feeding_events(id,pet_id,portion_eaten,logged_by) values (gen_random_uuid(),{pet},0.5,{me})','R R R E E E'),
('feeding_events','insert spoofing logged_by=owner (owner itself is legit)','insert into public.feeding_events(id,pet_id,portion_eaten,logged_by) values (gen_random_uuid(),{pet},0.5,{owner}) ','R E E E E E'),
('feeding_events','update (edit)','update public.feeding_events set portion_eaten=1 where id={feed}','N N N N N N'),
('feeding_events','delete','delete from public.feeding_events where id={feed}','N N N N N N'),
('feeding_events','VOID own/any entry (spec: corrections are voids)','update public.feeding_events set voided_at=now(), voided_by={me} where id={feed}','R R N N N N'),

('observation_events','select','select * from public.observation_events where pet_id={pet}','R R R N R N'),
('observation_events','insert as self','insert into public.observation_events(id,pet_id,kind,logged_by) values (gen_random_uuid(),{pet},''cough'',{me})','R R R E E E'),
('observation_events','insert spoofing logged_by','insert into public.observation_events(id,pet_id,kind,logged_by) values (gen_random_uuid(),{pet},''cough'',{owner})','R E E E E E'),
('observation_events','update (edit)','update public.observation_events set kind=''x'' where id={obs}','N N N N N N'),
('observation_events','delete','delete from public.observation_events where id={obs}','N N N N N N'),
('observation_events','VOID entry (spec: corrections are voids)','update public.observation_events set voided_at=now(), voided_by={me} where id={obs}','R R N N N N'),

('handoff_notes','select','select * from public.handoff_notes where pet_id={pet}','R R R N R N'),
('handoff_notes','insert as self','insert into public.handoff_notes(pet_id,body,created_by) values ({pet},''b'',{me})','R R R E E E'),
('handoff_notes','RESOLVE note (M-9 requirement)','update public.handoff_notes set resolved_at=now(), resolved_by={me} where id={note}','R R R N N N'),
('handoff_notes','delete','delete from public.handoff_notes where id={note}','N N N N N N'),

('activity_feed (view)','select','select * from public.activity_feed where pet_id={pet}','R R R N R N'),

('profiles','select owner profile','select * from public.profiles where id={owner}','R R R N R N'),
('profiles','update another user''s profile','update public.profiles set display_name=''hax'' where id={owner} and {me} <> {owner}','N N N N N N');

create temp table roles (i int, name text, k text);
insert into roles values (1,'owner','owner'),(2,'caregiver','cg'),(3,'sitter','sitter'),(4,'sitter-expired','sitterx'),(5,'vet','vet'),(6,'outsider','outsider');

select is(
  qa.attempt(qa.u(r.k), m.sql),
  case when c = 'R' then 'rows' when c = 'N' then 'none' when c = 'E' then 'err:42501' else 'err:' || substr(c, 2) end,
  m.tbl || ' | ' || m.op || ' | ' || r.name)
from m cross join roles r
cross join lateral (select (string_to_array(m.exp, ' '))[r.i] as c) x
order by m.tbl, m.op, r.i;

-- ---- anon: nothing readable, nothing writable
select is(qa.attempt(null, 'select * from public.'||t, 'anon'), 'none', 'anon select '||t)
from unnest(array['households','household_members','household_invites','pets','pet_conditions','pet_thresholds','vet_contacts',
  'medications','medication_versions','med_schedules','meal_schedules','dose_events','feeding_events','observation_events','handoff_notes','profiles','activity_feed']) t;
select is(qa.attempt(null, 'insert into public.handoff_notes(pet_id,body) values ({pet},''x'')', 'anon'), 'err:42501', 'anon cannot insert handoff note');

-- ---- RPC execute privilege matrix
select is(qa.call(null, 'select public.log_dose(gen_random_uuid(), {med}, ''given'')', 'anon'), 'err:42501', 'anon cannot log_dose');
select is(qa.call(null, 'select public.void_dose({dose})', 'anon'), 'err:42501', 'anon cannot void_dose');
select is(qa.call(null, 'select public.change_dose({med}, 1)', 'anon'), 'err:42501', 'anon cannot change_dose');
select is(qa.call(null, 'select public.set_pet_memorial({pet})', 'anon'), 'err:42501', 'anon cannot set_pet_memorial');
select is(qa.call(null, 'select public.create_household(''x'')', 'anon'), 'err:42501', 'anon cannot create_household');
select is(qa.call(null, 'select public.accept_invite(''x'')', 'anon'), 'err:42501', 'anon cannot accept_invite');
-- security-definer lookup helpers should not be callable by anon (defence in depth / existence oracle)
select is(has_function_privilege('anon', 'public.pet_household(uuid)', 'execute'), false, 'anon must not execute pet_household() (pet-id existence oracle)');
select is(has_function_privilege('anon', 'public.current_role_in(uuid)', 'execute'), false, 'anon must not execute current_role_in()');
select is(has_function_privilege('anon', 'public.handle_new_user()', 'execute'), false, 'anon must not execute handle_new_user()');

-- ---- structural guards
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0, 'RLS enabled on every public table');
select ok((select coalesce(reloptions::text, '') like '%security_invoker=true%' from pg_class where oid = 'public.activity_feed'::regclass),
          'activity_feed is security_invoker (inherits caller RLS)');
select is((select count(*)::int from pg_policies where schemaname='public' and tablename in ('dose_events','feeding_events','observation_events')
            and cmd in ('UPDATE','DELETE','ALL')), 0, 'no UPDATE/DELETE/ALL policies on append-only event tables');

-- ---- profiles / membership edge cases
select is(qa.attempt(qa.u('sitterx'), 'select * from public.profiles where id={owner}'), 'none',
          'expired sitter must not see household members'' profiles');
select is(qa.attempt(qa.u('outsider'), 'select * from public.profiles where id={owner}'), 'none', 'outsider cannot read profiles of strangers');
select is(qa.attempt(qa.u('vet'), 'update public.profiles set display_name=''ok'' where id={me}'), 'rows', 'user can edit own profile');

-- ---- storage (path = <household>/<pet>/<file>)
create temp table s (what text, bucket text, path text, exp text);
insert into s values
 ('own household media','atticus-media','00000000-0000-4000-8000-0000000000b1/00000000-0000-4000-8000-0000000000c1/a.mp4','R R R E E E'),
 ('other household path','atticus-media','00000000-0000-4000-8000-0000000000b2/00000000-0000-4000-8000-0000000000c2/a.mp4','E E E E E E'),
 ('non-uuid folder','atticus-media','not-a-uuid/x/a.mp4','E E E E E E'),
 ('no folder','atticus-media','a.mp4','E E E E E E'),
 ('SITTER/CG writing a vet report (server-generated, should not be client-writable)','atticus-reports','00000000-0000-4000-8000-0000000000b1/00000000-0000-4000-8000-0000000000c1/r.pdf','R R E E E E');
select is(
  qa.attempt(qa.u(r.k), format('insert into storage.objects(bucket_id,name,owner) values (%L,%L,{me})', s.bucket, s.path)),
  case when c='R' then 'rows' else 'err:42501' end, 'storage insert | '||s.what||' | '||r.name)
from s cross join roles r cross join lateral (select (string_to_array(s.exp,' '))[r.i] c) x order by s.what, r.i;
-- cross-household media read: seed an object as postgres, then read as each role
insert into storage.objects(bucket_id,name,owner) values ('atticus-media','00000000-0000-4000-8000-0000000000b1/00000000-0000-4000-8000-0000000000c1/seen.jpg',null);
select is(qa.attempt(qa.u(r.k), 'select * from storage.objects where bucket_id=''atticus-media'' and name like ''%seen.jpg'''),
  case when r.k in ('owner','cg','sitter','vet') then 'rows' else 'none' end, 'storage select | '||r.name) from roles r;

select * from finish();
rollback;
