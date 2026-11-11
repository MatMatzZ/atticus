-- Security-definer hygiene for every function in public.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

select is_empty($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and not coalesce('search_path=""' = any (p.proconfig), false)$$,
  'every security-definer function sets search_path = ''''');

select is_empty($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute')$$,
  'anon cannot execute any security-definer function');

select is_empty($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE')$$,
  'no security-definer function is executable by PUBLIC');

select is_empty($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'execute')$$,
  'trigger functions are not callable from the API');

select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'execute')) from unnest(array[
     'public.create_household(text, text)', 'public.accept_invite(text)',
     'public.log_dose(uuid, uuid, public.dose_outcome, timestamptz, timestamptz, numeric, text, boolean)',
     'public.void_dose(uuid, text)', 'public.change_dose(uuid, numeric, text)',
     'public.set_pet_memorial(uuid, date)']::regprocedure[]) f),
  'authenticated can execute every app RPC');

select * from finish();
rollback;
