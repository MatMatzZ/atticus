# RLS / role matrix (QA-1)

Generated from `scripts/qa/pgtap-src/01_rls_matrix.body.sql` (executed by `supabase/tests/database/qa_01_rls_matrix.test.sql`).
Every cell is an executed assertion: the statement is run as that user through `set role authenticated` + JWT claims and rolled back.
Result codes: ✅ = statement affects/returns ≥ 1 row · ⛔ none = RLS filtered to 0 rows · ⛔ 42501 = permission/RLS error. **❌ BUG** = current behaviour differs from the expectation shown (expectation = the spec in README/TASKS).

Roles: **owner**, **cg** caregiver, **sit** sitter (active), **sit✕** sitter (expired), **vet**, **out** outsider (signed in, other household). `anon` is covered separately below.

| Table | Operation | owner | cg | sit | sit✕ | vet | out | Today |
|---|---|---|---|---|---|---|---|---|
| `households` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `households` | insert | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `households` | update | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `households` | delete | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `household_members` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `household_members` | insert (self as owner) | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `household_members` | update (promote cg) | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `household_members` | update (self-promote; owner no-op ok) | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `household_members` | delete (remove sitter; sitter may leave) | ✅ | ⛔ none | ✅ | ⛔ none | ⛔ none | ⛔ none | pass |
| `household_members` | delete (remove owner) | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `household_invites` | select | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `household_invites` | insert | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `household_invites` | update | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `household_invites` | delete | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `pets` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `pets` | insert | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `pets` | update | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `pets` | update status->memorial (owner-only per set_pet_memorial) | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ❌ BUG QA-003 |
| `pets` | update household_id (move pet) | ⛔ 42501 | ⛔ 42501 | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `pets` | delete | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `condition_presets` | select | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | pass |
| `condition_presets` | insert | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `condition_presets` | update | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `condition_presets` | delete | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `pet_conditions` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `pet_conditions` | insert | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `pet_conditions` | update | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `pet_conditions` | delete | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `pet_thresholds` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `pet_thresholds` | insert | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `pet_thresholds` | update | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `pet_thresholds` | delete | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `vet_contacts` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `vet_contacts` | insert | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `vet_contacts` | update | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `vet_contacts` | delete | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `medications` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `medications` | insert | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `medications` | update | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `medications` | update quantity_on_hand directly (inventory only via RPC/Add supply) | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `medications` | delete (must not erase dose history -> see 02) | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ❌ BUG QA-001 |
| `medication_versions` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `medication_versions` | insert (2nd current row => unique idx; RLS passes owner/cg) | ⛔ 23505 | ⛔ 23505 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `medication_versions` | update dose_amount in place (must use change_dose) | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `medication_versions` | delete history row | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `med_schedules` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `med_schedules` | insert | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `med_schedules` | update | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `med_schedules` | delete | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `meal_schedules` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `meal_schedules` | insert | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `meal_schedules` | update | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `meal_schedules` | delete | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `dose_events` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `dose_events` | insert direct (must use log_dose) | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `dose_events` | update (tamper) | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `dose_events` | update (self-void bypassing void_dose inventory restore) | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `dose_events` | delete | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `feeding_events` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `feeding_events` | insert as self | ✅ | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `feeding_events` | insert spoofing logged_by=owner (owner itself is legit) | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `feeding_events` | update (edit) | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `feeding_events` | delete | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `feeding_events` | VOID own/any entry (spec: corrections are voids) | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ❌ BUG QA-008 |
| `observation_events` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `observation_events` | insert as self | ✅ | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `observation_events` | insert spoofing logged_by | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `observation_events` | update (edit) | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `observation_events` | delete | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `observation_events` | VOID entry (spec: corrections are voids) | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ❌ BUG QA-008 |
| `handoff_notes` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `handoff_notes` | insert as self | ✅ | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `handoff_notes` | RESOLVE note (M-9 requirement) | ✅ | ✅ | ✅ | ⛔ none | ⛔ none | ⛔ none | ❌ BUG QA-009 |
| `handoff_notes` | delete | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `activity_feed (view)` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `profiles` | select owner profile | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |
| `profiles` | update another user's profile | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | ⛔ none | pass |
| `storage.objects` (insert, own-household media) | upload | ✅ | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `storage.objects` (insert, other household / non-uuid / no folder) | upload | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | pass |
| `storage.objects` (insert into `atticus-reports`) | upload | ✅ | ✅ | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ❌ BUG QA-015 (sitter allowed) |
| `storage.objects` | select | ✅ | ✅ | ✅ | ⛔ none | ✅ | ⛔ none | pass |

## anon (not signed in)

All 17 tables/views return 0 rows; insert → 42501; `log_dose`, `void_dose`, `change_dose`, `set_pet_memorial`, `create_household`, `accept_invite` → 42501; `pet_household`, `current_role_in`, `handle_new_user` not executable. All pass.

## RPC role matrix

| RPC | owner | cg | sitter | sitter✕ | vet | outsider | other household | Test |
|---|---|---|---|---|---|---|---|---|
| `log_dose` | ✅ | ✅ | ✅ | 42501 | 42501 | 42501 | 42501 | qa_02 DOSE-*, AUTH-1 |
| `void_dose` (others' entry) | ✅ | ✅ | 42501 | 42501 | 42501 | 42501 | 42501 | qa_02 VOID-4 |
| `void_dose` (own entry) | ✅ | ✅ | ✅ while active | 42501 | – | – | – | qa_02 VOID-5/6 (fixed by `rls_hardening`) |
| `change_dose` | ✅ | ✅ | 42501 | 42501 | 42501 | 42501 | 42501 | qa_02 VER-3 |
| `set_pet_memorial` | ✅ | 42501 | 42501 | 42501 | 42501 | 42501 | 42501 | qa_03 MEM-1 |
| `create_household` | any signed-in user | | | | | | | qa_03 HH-1 (invalid tz accepted: QA-011) |
| `accept_invite` | valid / unexpired / unused token only | | | | | | | qa_03 INV-1..7 (QA-014) |

## Structural guards (all pass)

- RLS enabled on every `public` table; `activity_feed` is `security_invoker`.
- No UPDATE/DELETE/ALL policy on `dose_events`, `feeding_events`, `observation_events` (append-only) — which is also the root of QA-008.
- Direct `insert/update/delete` on `dose_events` denied for every role (doses only via `log_dose`).
- `logged_by` / `created_by` spoofing on feeding, observation and handoff inserts is rejected.
- Role escalation: caregiver cannot self-promote (`household_members` update → 0 rows); nobody can insert membership directly.
- `medication_versions`: owner/caregiver insert only; update/delete → 0 rows for everyone (fixed by `rls_hardening`).
- Profiles: expired sitters and strangers see nothing (fixed by `rls_hardening`).

## Known gaps (not covered / not testable here)

- Supabase Realtime row filtering (subscriptions honour RLS but this was not exercised).
- Edge Functions `notify-household` and `generate-vet-report` (BE-2/BE-4) do not exist yet — role matrix for them is pending.
- `TRUNCATE` is granted to `authenticated` by Supabase defaults and is not subject to RLS; PostgREST does not expose it, but a direct DB connection with that role would bypass append-only. Consider `revoke truncate` (informational).
- BE-1 keeps its own pgTAP files in `supabase/tests/`; QA's suite is namespaced `qa_*` and shares no state with it.
