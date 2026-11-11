-- =====================================================================
-- ATTICUS — Phase 1 core schema
-- Households & roles, pets, condition presets, vet-entered thresholds,
-- medications (versioned), schedules, append-only care events,
-- duplicate-dose guard, invites, storage buckets, realtime.
--
-- Principle: ATTICUS records and organizes. It never decides doses or
-- thresholds — every clinical number is entered by the user from their vet.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.member_role  as enum ('owner', 'caregiver', 'sitter', 'vet');
create type public.pet_status   as enum ('active', 'memorial');
create type public.dose_outcome as enum ('given', 'skipped', 'refused', 'vomited_after');
create type public.contact_kind as enum ('regular_vet', 'emergency_clinic', 'other');

-- ---------------------------------------------------------------------
-- Utility
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Safe text->uuid (used for storage paths); returns null instead of erroring.
create or replace function public.safe_uuid(p text)
returns uuid language sql immutable set search_path = '' as $$
  select case
    when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then p::uuid end
$$;

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default 'Caregiver',
  created_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name',
                           split_part(coalesce(new.email, ''), '@', 1),
                           'Caregiver'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Households & membership
-- ---------------------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  timezone    text not null default 'Asia/Manila',
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          public.member_role not null,
  expires_at    timestamptz,                      -- sitters: access ends here
  added_at      timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members (user_id);

create table public.household_invites (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references public.households (id) on delete cascade,
  role                 public.member_role not null check (role <> 'owner'),
  token                text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at           timestamptz not null default now() + interval '7 days',
  sitter_access_until  timestamptz,
  created_by           uuid references auth.users (id) on delete set null default auth.uid(),
  accepted_by          uuid references auth.users (id) on delete set null,
  accepted_at          timestamptz,
  created_at           timestamptz not null default now(),
  check (role <> 'sitter' or sitter_access_until is not null)
);
create index on public.household_invites (household_id);

-- Role of the current user in a household (null = no access / expired sitter)
create or replace function public.current_role_in(p_household uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select m.role
  from public.household_members m
  where m.household_id = p_household
    and m.user_id = auth.uid()
    and (m.expires_at is null or m.expires_at > now())
$$;

create or replace function public.is_member(p_household uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_role_in(p_household) is not null
$$;

create or replace function public.has_role(p_household uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_role_in(p_household) = any (p_roles), false)
$$;

-- ---------------------------------------------------------------------
-- Pets
-- ---------------------------------------------------------------------
create table public.pets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  species       text not null check (species in ('dog', 'cat', 'other')),
  breed         text,
  sex           text check (sex in ('male', 'female', 'unknown')),
  birth_date    date,
  weight_kg     numeric(6, 2) check (weight_kg > 0),
  photo_path    text,
  status        public.pet_status not null default 'active',
  passed_on     date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.pets (household_id);
create trigger pets_updated_at before update on public.pets
  for each row execute function public.set_updated_at();

create or replace function public.pet_household(p_pet uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select household_id from public.pets where id = p_pet
$$;

-- ---------------------------------------------------------------------
-- Condition presets (reference data) & per-pet conditions (stackable)
-- ---------------------------------------------------------------------
create table public.condition_presets (
  key           text primary key,
  name          text not null,
  version       int  not null default 1,
  is_available  boolean not null default false,
  config        jsonb not null default '{}'::jsonb
);

create table public.pet_conditions (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references public.pets (id) on delete cascade,
  preset_key    text not null references public.condition_presets (key),
  diagnosed_on  date,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (pet_id, preset_key)
);

-- Alert thresholds: entered by the user exactly as instructed by their vet
create table public.pet_thresholds (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null references public.pets (id) on delete cascade,
  metric           text not null,                 -- e.g. 'rrr'
  comparator       text not null check (comparator in ('>', '>=', '<', '<=')),
  value            numeric not null,
  unit             text not null,
  vet_instruction  text,                          -- "Call us if above 30 while asleep"
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (pet_id, metric, comparator)
);

create table public.vet_contacts (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  kind          public.contact_kind not null default 'regular_vet',
  name          text not null,
  clinic        text,
  phone         text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index on public.vet_contacts (household_id);

-- ---------------------------------------------------------------------
-- Medications (versioned doses), schedules, inventory
-- ---------------------------------------------------------------------
create table public.medications (
  id                          uuid primary key default gen_random_uuid(),
  pet_id                      uuid not null references public.pets (id) on delete cascade,
  name                        text not null,
  form                        text not null default 'tablet'
                                check (form in ('tablet', 'capsule', 'liquid', 'injection', 'topical', 'other')),
  strength                    text,               -- "12.5 mg" as written on the label
  unit                        text not null default 'tablet',
  with_food                   boolean not null default false,
  prescribed_by               text,
  duplicate_warning_minutes   int not null default 60 check (duplicate_warning_minutes between 1 and 1440),
  quantity_on_hand            numeric(10, 3) check (quantity_on_hand >= 0),
  refill_alert_at             numeric(10, 3) check (refill_alert_at >= 0),
  active                      boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index on public.medications (pet_id);
create trigger medications_updated_at before update on public.medications
  for each row execute function public.set_updated_at();

-- Dose history: a new row per change, so reports show "dose changed on Nov 3"
create table public.medication_versions (
  id              uuid primary key default gen_random_uuid(),
  medication_id   uuid not null references public.medications (id) on delete cascade,
  dose_amount     numeric(8, 3) not null check (dose_amount > 0),   -- 1.75 = 1 3/4 tablets
  instructions    text,
  effective_from  timestamptz not null default now(),
  effective_to    timestamptz,
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create unique index medication_versions_one_current
  on public.medication_versions (medication_id) where effective_to is null;

create table public.med_schedules (
  id             uuid primary key default gen_random_uuid(),
  medication_id  uuid not null references public.medications (id) on delete cascade,
  time_of_day    time not null,                   -- in household timezone
  days_of_week   smallint[] not null default '{0,1,2,3,4,5,6}',
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index on public.med_schedules (medication_id);

create table public.meal_schedules (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references public.pets (id) on delete cascade,
  time_of_day  time not null,
  food         text,
  amount_text  text,                              -- "1/2 can + 1/4 cup kibble"
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index on public.meal_schedules (pet_id);

-- ---------------------------------------------------------------------
-- Care events — APPEND-ONLY. Corrections are "voids", never edits.
-- ids are client-generated so offline writes are idempotent.
-- ---------------------------------------------------------------------
create table public.dose_events (
  id                     uuid primary key,
  medication_id          uuid not null references public.medications (id) on delete cascade,
  pet_id                 uuid not null references public.pets (id) on delete cascade,
  medication_version_id  uuid references public.medication_versions (id) on delete set null,
  scheduled_for          timestamptz,
  given_at               timestamptz not null default now(),
  outcome                public.dose_outcome not null,
  amount                 numeric(8, 3) check (amount >= 0),
  inventory_decremented  numeric(10, 3) not null default 0,
  note                   text,
  logged_by              uuid references auth.users (id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  voided_at              timestamptz,
  voided_by              uuid references auth.users (id) on delete set null,
  void_reason            text
);
create index on public.dose_events (medication_id, given_at desc);
create index on public.dose_events (pet_id, given_at desc);

create table public.feeding_events (
  id              uuid primary key,
  pet_id          uuid not null references public.pets (id) on delete cascade,
  meal_schedule_id uuid references public.meal_schedules (id) on delete set null,
  scheduled_for   timestamptz,
  logged_at       timestamptz not null default now(),
  portion_eaten   numeric(4, 3) not null check (portion_eaten between 0 and 1),  -- 1 = finished
  food            text,
  note            text,
  logged_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references auth.users (id) on delete set null
);
create index on public.feeding_events (pet_id, logged_at desc);

create table public.observation_events (
  id           uuid primary key,
  pet_id       uuid not null references public.pets (id) on delete cascade,
  kind         text not null,                     -- 'rrr','cough','collapse','pee','poop',...
  value_num    numeric,                           -- e.g. breaths/min
  value_text   text,                              -- e.g. cough description
  unit         text,
  scale_value  smallint check (scale_value between 0 and 10),
  is_urgent    boolean not null default false,
  observed_at  timestamptz not null default now(),
  note         text,
  media_paths  text[] not null default '{}',
  logged_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references auth.users (id) on delete set null
);
create index on public.observation_events (pet_id, observed_at desc);
create index on public.observation_events (pet_id, kind, observed_at desc);

create table public.handoff_notes (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references public.pets (id) on delete cascade,
  body         text not null check (length(trim(body)) > 0),
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users (id) on delete set null
);
create index on public.handoff_notes (pet_id, created_at desc);

-- Unified activity feed (respects RLS of the caller)
create view public.activity_feed with (security_invoker = true) as
  select d.id, d.pet_id, 'dose'::text as type, d.given_at as occurred_at,
         m.name as title, d.outcome::text as detail, d.logged_by, d.voided_at
  from public.dose_events d join public.medications m on m.id = d.medication_id
  union all
  select f.id, f.pet_id, 'meal', f.logged_at, coalesce(f.food, 'Meal'),
         (f.portion_eaten * 100)::int || '% eaten', f.logged_by, f.voided_at
  from public.feeding_events f
  union all
  select o.id, o.pet_id, case when o.is_urgent then 'urgent' else 'observation' end,
         o.observed_at, o.kind,
         coalesce(o.value_num::text || coalesce(' ' || o.unit, ''), o.value_text),
         o.logged_by, o.voided_at
  from public.observation_events o
  union all
  select h.id, h.pet_id, 'note', h.created_at, 'Handoff note', h.body, h.created_by, null
  from public.handoff_notes h;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.households          enable row level security;
alter table public.household_members   enable row level security;
alter table public.household_invites   enable row level security;
alter table public.pets                enable row level security;
alter table public.condition_presets   enable row level security;
alter table public.pet_conditions      enable row level security;
alter table public.pet_thresholds      enable row level security;
alter table public.vet_contacts        enable row level security;
alter table public.medications         enable row level security;
alter table public.medication_versions enable row level security;
alter table public.med_schedules       enable row level security;
alter table public.meal_schedules      enable row level security;
alter table public.dose_events         enable row level security;
alter table public.feeding_events      enable row level security;
alter table public.observation_events  enable row level security;
alter table public.handoff_notes       enable row level security;

-- Profiles: see yourself and people you share a household with
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Households (created via create_household RPC)
create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.has_role(id, '{owner}')) with check (public.has_role(id, '{owner}'));
create policy households_delete on public.households for delete to authenticated
  using (public.has_role(id, '{owner}'));

-- Members (added via accept_invite RPC)
create policy members_select on public.household_members for select to authenticated
  using (public.is_member(household_id));
create policy members_update on public.household_members for update to authenticated
  using (public.has_role(household_id, '{owner}')) with check (public.has_role(household_id, '{owner}'));
create policy members_delete on public.household_members for delete to authenticated
  using (public.has_role(household_id, '{owner}') or user_id = auth.uid());

-- Invites: owners only
create policy invites_all on public.household_invites for all to authenticated
  using (public.has_role(household_id, '{owner}'))
  with check (public.has_role(household_id, '{owner}'));

-- Presets: readable reference data
create policy presets_select on public.condition_presets for select to authenticated using (true);

-- Pets
create policy pets_select on public.pets for select to authenticated
  using (public.is_member(household_id));
create policy pets_insert on public.pets for insert to authenticated
  with check (public.has_role(household_id, '{owner,caregiver}'));
create policy pets_update on public.pets for update to authenticated
  using (public.has_role(household_id, '{owner,caregiver}'))
  with check (public.has_role(household_id, '{owner,caregiver}'));
create policy pets_delete on public.pets for delete to authenticated
  using (public.has_role(household_id, '{owner}'));

-- Vet contacts
create policy contacts_select on public.vet_contacts for select to authenticated
  using (public.is_member(household_id));
create policy contacts_write on public.vet_contacts for all to authenticated
  using (public.has_role(household_id, '{owner,caregiver}'))
  with check (public.has_role(household_id, '{owner,caregiver}'));

-- Pet-scoped care-plan tables: everyone reads, owner/caregiver edit
create policy conditions_select on public.pet_conditions for select to authenticated
  using (public.is_member(public.pet_household(pet_id)));
create policy conditions_write on public.pet_conditions for all to authenticated
  using (public.has_role(public.pet_household(pet_id), '{owner,caregiver}'))
  with check (public.has_role(public.pet_household(pet_id), '{owner,caregiver}'));

create policy thresholds_select on public.pet_thresholds for select to authenticated
  using (public.is_member(public.pet_household(pet_id)));
create policy thresholds_write on public.pet_thresholds for all to authenticated
  using (public.has_role(public.pet_household(pet_id), '{owner,caregiver}'))
  with check (public.has_role(public.pet_household(pet_id), '{owner,caregiver}'));

create policy meds_select on public.medications for select to authenticated
  using (public.is_member(public.pet_household(pet_id)));
create policy meds_write on public.medications for all to authenticated
  using (public.has_role(public.pet_household(pet_id), '{owner,caregiver}'))
  with check (public.has_role(public.pet_household(pet_id), '{owner,caregiver}'));

create policy medver_select on public.medication_versions for select to authenticated
  using (exists (select 1 from public.medications m where m.id = medication_id
                 and public.is_member(public.pet_household(m.pet_id))));
create policy medver_write on public.medication_versions for all to authenticated
  using (exists (select 1 from public.medications m where m.id = medication_id
                 and public.has_role(public.pet_household(m.pet_id), '{owner,caregiver}')))
  with check (exists (select 1 from public.medications m where m.id = medication_id
                 and public.has_role(public.pet_household(m.pet_id), '{owner,caregiver}')));

create policy medsched_select on public.med_schedules for select to authenticated
  using (exists (select 1 from public.medications m where m.id = medication_id
                 and public.is_member(public.pet_household(m.pet_id))));
create policy medsched_write on public.med_schedules for all to authenticated
  using (exists (select 1 from public.medications m where m.id = medication_id
                 and public.has_role(public.pet_household(m.pet_id), '{owner,caregiver}')))
  with check (exists (select 1 from public.medications m where m.id = medication_id
                 and public.has_role(public.pet_household(m.pet_id), '{owner,caregiver}')));

create policy mealsched_select on public.meal_schedules for select to authenticated
  using (public.is_member(public.pet_household(pet_id)));
create policy mealsched_write on public.meal_schedules for all to authenticated
  using (public.has_role(public.pet_household(pet_id), '{owner,caregiver}'))
  with check (public.has_role(public.pet_household(pet_id), '{owner,caregiver}'));

-- Events: read for members; insert for owner/caregiver/sitter as themselves.
-- No update/delete policies => append-only. Doses go through log_dose().
create policy doses_select on public.dose_events for select to authenticated
  using (public.is_member(public.pet_household(pet_id)));

create policy feeding_select on public.feeding_events for select to authenticated
  using (public.is_member(public.pet_household(pet_id)));
create policy feeding_insert on public.feeding_events for insert to authenticated
  with check (logged_by = auth.uid()
              and public.has_role(public.pet_household(pet_id), '{owner,caregiver,sitter}'));

create policy obs_select on public.observation_events for select to authenticated
  using (public.is_member(public.pet_household(pet_id)));
create policy obs_insert on public.observation_events for insert to authenticated
  with check (logged_by = auth.uid()
              and public.has_role(public.pet_household(pet_id), '{owner,caregiver,sitter}'));

create policy notes_select on public.handoff_notes for select to authenticated
  using (public.is_member(public.pet_household(pet_id)));
create policy notes_insert on public.handoff_notes for insert to authenticated
  with check (created_by = auth.uid()
              and public.has_role(public.pet_household(pet_id), '{owner,caregiver,sitter}'));

-- =====================================================================
-- RPCs
-- =====================================================================

-- Create a household and make the caller its owner
create or replace function public.create_household(p_name text, p_timezone text default 'Asia/Manila')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  insert into public.households (name, timezone, created_by)
    values (p_name, p_timezone, auth.uid()) returning id into v_id;
  insert into public.household_members (household_id, user_id, role)
    values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

-- Accept an invite link/QR token
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.household_invites;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select * into v_inv from public.household_invites
   where token = p_token for update;

  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'invite is invalid or expired' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id, role, expires_at)
  values (v_inv.household_id, auth.uid(), v_inv.role,
          case when v_inv.role = 'sitter' then v_inv.sitter_access_until end)
  on conflict (household_id, user_id) do nothing;   -- never downgrade/upgrade an existing member

  update public.household_invites
     set accepted_by = auth.uid(), accepted_at = now()
   where id = v_inv.id;

  return v_inv.household_id;
end $$;

-- Log a dose with the duplicate-dose guard.
-- Returns jsonb { status: 'logged' | 'needs_confirmation' | 'already_logged', ... }
-- The medication row is locked so two caregivers tapping at once are serialized.
create or replace function public.log_dose(
  p_id             uuid,
  p_medication_id  uuid,
  p_outcome        public.dose_outcome,
  p_given_at       timestamptz default now(),
  p_scheduled_for  timestamptz default null,
  p_amount         numeric default null,
  p_note           text default null,
  p_force          boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_med       public.medications;
  v_ver       public.medication_versions;
  v_amount    numeric;
  v_dec       numeric := 0;
  v_conflict  record;
  v_qty       numeric;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select * into v_med from public.medications where id = p_medication_id for update;
  if not found then raise exception 'medication not found' using errcode = 'P0002'; end if;

  if not public.has_role(public.pet_household(v_med.pet_id), '{owner,caregiver,sitter}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- Idempotency (offline retries)
  if exists (select 1 from public.dose_events where id = p_id) then
    return jsonb_build_object('status', 'already_logged', 'id', p_id);
  end if;

  select * into v_ver from public.medication_versions
   where medication_id = v_med.id and effective_to is null;

  v_amount := coalesce(p_amount, v_ver.dose_amount);

  -- Duplicate-dose guard: another 'given' dose within the warning window?
  if p_outcome in ('given', 'vomited_after') and not p_force then
    select d.id, d.given_at, d.amount, d.logged_by, p.display_name
      into v_conflict
      from public.dose_events d
      left join public.profiles p on p.id = d.logged_by
     where d.medication_id = v_med.id
       and d.voided_at is null
       and d.outcome in ('given', 'vomited_after')
       and abs(extract(epoch from (d.given_at - p_given_at))) < v_med.duplicate_warning_minutes * 60
     order by d.given_at desc
     limit 1;

    if found then
      return jsonb_build_object(
        'status', 'needs_confirmation',
        'conflict', jsonb_build_object(
          'id', v_conflict.id,
          'given_at', v_conflict.given_at,
          'amount', v_conflict.amount,
          'logged_by', v_conflict.logged_by,
          'logged_by_name', v_conflict.display_name));
    end if;
  end if;

  -- Inventory: a pill that was given (even if vomited) is consumed
  if p_outcome in ('given', 'vomited_after') and v_med.quantity_on_hand is not null and v_amount is not null then
    v_dec := least(v_amount, v_med.quantity_on_hand);
    update public.medications set quantity_on_hand = quantity_on_hand - v_dec
     where id = v_med.id;
  end if;

  insert into public.dose_events (id, medication_id, pet_id, medication_version_id, scheduled_for,
                                  given_at, outcome, amount, inventory_decremented, note, logged_by)
  values (p_id, v_med.id, v_med.pet_id, v_ver.id, p_scheduled_for,
          p_given_at, p_outcome, v_amount, v_dec, p_note, auth.uid());

  select quantity_on_hand into v_qty from public.medications where id = v_med.id;

  return jsonb_build_object(
    'status', 'logged',
    'id', p_id,
    'quantity_on_hand', v_qty,
    'refill_needed', v_qty is not null and v_med.refill_alert_at is not null and v_qty <= v_med.refill_alert_at);
end $$;

-- Void (undo) a dose; restores inventory. Logger, owner or caregiver may void.
create or replace function public.void_dose(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ev public.dose_events;
begin
  select * into v_ev from public.dose_events where id = p_id for update;
  if not found then raise exception 'dose not found' using errcode = 'P0002'; end if;
  if v_ev.voided_at is not null then return; end if;

  if not (v_ev.logged_by = auth.uid()
          or public.has_role(public.pet_household(v_ev.pet_id), '{owner,caregiver}')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.dose_events
     set voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
   where id = p_id;

  if v_ev.inventory_decremented > 0 then
    update public.medications
       set quantity_on_hand = quantity_on_hand + v_ev.inventory_decremented
     where id = v_ev.medication_id and quantity_on_hand is not null;
  end if;
end $$;

-- Change a dose: closes the current version and opens a new one
create or replace function public.change_dose(p_medication_id uuid, p_dose_amount numeric,
                                              p_instructions text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_pet uuid; v_id uuid;
begin
  select pet_id into v_pet from public.medications where id = p_medication_id for update;
  if not found then raise exception 'medication not found' using errcode = 'P0002'; end if;
  if not public.has_role(public.pet_household(v_pet), '{owner,caregiver}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.medication_versions set effective_to = now()
   where medication_id = p_medication_id and effective_to is null;

  insert into public.medication_versions (medication_id, dose_amount, instructions, created_by)
  values (p_medication_id, p_dose_amount, p_instructions, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Memorial mode: archives the pet and deactivates every schedule/reminder
create or replace function public.set_pet_memorial(p_pet uuid, p_passed_on date default current_date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(public.pet_household(p_pet), '{owner}') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.pets set status = 'memorial', passed_on = p_passed_on where id = p_pet;
  update public.medications set active = false where pet_id = p_pet;
  update public.med_schedules set active = false
   where medication_id in (select id from public.medications where pet_id = p_pet);
  update public.meal_schedules set active = false where pet_id = p_pet;
end $$;

-- Lock down function execution
revoke execute on function public.create_household(text, text)          from public, anon;
revoke execute on function public.accept_invite(text)                   from public, anon;
revoke execute on function public.log_dose(uuid, uuid, public.dose_outcome, timestamptz, timestamptz, numeric, text, boolean) from public, anon;
revoke execute on function public.void_dose(uuid, text)                 from public, anon;
revoke execute on function public.change_dose(uuid, numeric, text)      from public, anon;
revoke execute on function public.set_pet_memorial(uuid, date)          from public, anon;
grant  execute on function public.create_household(text, text)          to authenticated;
grant  execute on function public.accept_invite(text)                   to authenticated;
grant  execute on function public.log_dose(uuid, uuid, public.dose_outcome, timestamptz, timestamptz, numeric, text, boolean) to authenticated;
grant  execute on function public.void_dose(uuid, text)                 to authenticated;
grant  execute on function public.change_dose(uuid, numeric, text)      to authenticated;
grant  execute on function public.set_pet_memorial(uuid, date)          to authenticated;

-- =====================================================================
-- Realtime (Family Sync)
-- =====================================================================
alter publication supabase_realtime add table
  public.dose_events, public.feeding_events, public.observation_events,
  public.handoff_notes, public.medications;

-- =====================================================================
-- Storage: private buckets, path = <household_id>/<pet_id>/<file>
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('atticus-media', 'atticus-media', false),
       ('atticus-reports', 'atticus-reports', false)
on conflict (id) do nothing;

create policy atticus_storage_select on storage.objects for select to authenticated
  using (bucket_id in ('atticus-media', 'atticus-reports')
         and public.is_member(public.safe_uuid((storage.foldername(name))[1])));
create policy atticus_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('atticus-media', 'atticus-reports')
              and public.has_role(public.safe_uuid((storage.foldername(name))[1]),
                                  '{owner,caregiver,sitter}'));
create policy atticus_storage_delete on storage.objects for delete to authenticated
  using (bucket_id in ('atticus-media', 'atticus-reports')
         and public.has_role(public.safe_uuid((storage.foldername(name))[1]), '{owner,caregiver}'));

-- =====================================================================
-- Reference data: condition presets
-- Shapes WHAT can be logged. Contains no clinical numbers.
-- =====================================================================
insert into public.condition_presets (key, name, version, is_available, config) values
('heart_disease', 'Heart Disease', 1, true, $json${
  "dashboard": { "next_up": true, "recent_strip": ["rrr", "pee", "cough", "meal"] },
  "quick_logs": [
    { "kind": "rrr", "label": "Resting breathing rate", "unit": "breaths/min", "tool": "breath_counter" },
    { "kind": "cough", "label": "Coughing", "input": "choice",
      "options": ["Soft", "Honking", "Wet", "Dry", "Coughing fit"] },
    { "kind": "restlessness", "label": "Restless / pacing", "input": "scale", "scale": "0-3" },
    { "kind": "pee", "label": "Pee", "input": "tap" },
    { "kind": "poop", "label": "Poop", "input": "visual_scale", "scale": "stool" },
    { "kind": "appetite", "label": "Appetite & mood", "input": "visual_scale", "scale": "0-3" }
  ],
  "urgent_logs": [
    { "kind": "collapse", "label": "Collapse / fainting", "capture_video": true },
    { "kind": "breathing_distress", "label": "Breathing difficulty", "capture_video": true }
  ],
  "tools": ["breath_counter"],
  "threshold_prompts": [
    { "metric": "rrr", "unit": "breaths/min",
      "question": "At what resting breathing rate (while asleep) did your vet tell you to call them?" }
  ]
}$json$::jsonb),
('ckd',        'Chronic Kidney Disease', 1, false, '{}'),
('diabetes',   'Diabetes',               1, false, '{}'),
('epilepsy',   'Epilepsy / Seizures',    1, false, '{}'),
('cancer',     'Cancer (General)',       1, false, '{}'),
('arthritis',  'Arthritis / Mobility',   1, false, '{}')
on conflict (key) do nothing;
