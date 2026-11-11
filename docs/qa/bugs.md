# ATTICUS QA — Bug log

Filed by QA on 2026-11-12 against the working tree (migrations `…000000_phase1_core`, `…000100_rls_hardening`).
Every bug has a failing automated test unless marked **(static)**. Re-run: `scripts/qa/run-pgtap.sh`,
`npx vitest run --root . scripts/qa/reminders-outbox.qa.test.ts`, `node --env-file=.env.local --env-file=apps/web/.env.local scripts/race-test.mjs`.
QA does not fix feature code; owners are the roles named in `docs/TASKS.md`.

| ID | Sev | Area | Task | Title |
|----|-----|------|------|-------|
| QA-001 | High | Data safety | BE-1 | Caregiver can delete a medication and cascade-erase its whole dose history |
| QA-002 | High | Dose safety / offline | M-8 | Outbox treats transient server errors as permanent failures (dose can be lost) |
| QA-003 | High | Memorial | BE-1 / M-10 | Memorial mode is reversible by a caregiver; reminders can be re-enabled |
| QA-004 | Medium | Dose safety | BE-1 / M-3 | `log_dose` accepts doses for archived medications and memorial pets |
| QA-005 | Medium | Reminders | M-8 | Reminder still fires for a dose another caregiver already logged |
| QA-006 | Medium | Offline / privacy | M-8 | Sign-out does not clear the outbox or cancel scheduled reminders |
| QA-007 | Medium | Reminders | M-8 | Reminder scheduling is non-atomic, silent on denied permission, and stops after 48 h without app open |
| QA-008 | Medium | Data safety | BE-1 / M-9 | No way to void feeding or observation events (corrections are voids) |
| QA-009 | Medium | Family sync | BE-1 / M-9 | Handoff notes cannot be resolved (no UPDATE policy) |
| QA-010 | Medium | Data safety | BE-1 | The last owner can leave or demote themselves, orphaning the household |
| QA-011 | Medium | Data safety | BE-1 / M-2 | `create_household` accepts an invalid timezone, which breaks Next Up and reminders |
| QA-012 | Medium | Accessibility | M-6 | Breathing counter cannot be operated at speed with VoiceOver / TalkBack **(static)** |
| QA-013 | Low | Dose safety | BE-1 | A UUID already used in another household makes `log_dose` report `already_logged` for a dose never recorded |
| QA-014 | Low | Invites | BE-5 | `accept_invite` burns an invite that grants nothing; sitter invite may already be expired |
| QA-015 | Low | Storage | BE-1 / BE-4 | Sitters can upload into `atticus-reports` (server-generated bucket) |
| QA-016 | Low | Guardrails | M-6 / PO-1 | "Not above the limit you entered" reads like an all-clear **(static)** |

Verified **fixed** by BE-1's `rls_hardening` migration while QA was testing (tests now pass, kept as regression guards):
anon-executable security-definer helpers, `profiles` visible to expired sitters, `void_dose` by expired/removed logger,
caregiver rewriting/deleting `medication_versions`.

---

### QA-001 · Caregiver can delete a medication and erase its dose history — High · BE-1
**Steps** (as caregiver, `supabase/tests/database/qa_02_dose_safety.test.sql` INTEG-1): `delete from public.medications where id = <med with dose history>;`
**Expected** denied (or archive-only). README: "care events are append-only".
**Actual** succeeds; FK `on delete cascade` removes every `dose_events` row for it. `meds_write` is `for all`.
**Evidence** pgTAP `qa_02` #63 #64, `qa_01` #278. **Fix hint** (not applied): split policy so DELETE is owner-only or removed; use `active=false` to archive; consider `on delete restrict` for event FKs.

### QA-002 · Outbox drops doses on transient server errors — High · M-8
**Steps** `interpretDoseResult(null, {code:'PGRST301'|'57014'|'40P01'|'40001'|'08006'|'PGRST002'|'PGRST000'})` (`apps/mobile/src/lib/outbox.ts` passes only `{message, code}`, so any error with a code is "permanent").
**Expected** `pending` (retry with backoff). **Actual** `failed` → UI offers "Remove from this phone"; dose is never recorded unless re-entered by hand.
**Why it matters** a phone offline for hours reconnects with an expired JWT or a restarting PostgREST; the first flush is the one that matters. `fromPlain()` has the same flaw for feeding/observation.
**Evidence** `scripts/qa/reminders-outbox.qa.test.ts` — 7 failing cases.

### QA-003 · Memorial mode can be reversed by a caregiver — High · BE-1 / M-10
**Steps** owner calls `set_pet_memorial`; then as caregiver: `update pets set status='active'`, `update medications set active=true`, `update med_schedules set active=true`, `update meal_schedules set active=true`, or insert a new schedule.
**Expected** denied (memorial is owner-only and must stop every reminder on every device). **Actual** all succeed (also `update pets set status='memorial'` skips the schedule deactivation).
**Evidence** `qa_03` #28–#33, `qa_01` #422. **Fix hint** column-level guard / trigger on `pets.status`, and `with check` that the pet is active for schedule writes.

### QA-004 · Dose logged for archived medication / memorial pet — Medium · BE-1 / M-3
**Steps** `update medications set active=false …` (or memorial) then `log_dose(new uuid, med, 'given')`.
**Expected** error (e.g. P0001 "medication is not active"). **Actual** `logged`, inventory decremented. An offline outbox entry queued before the pet passed would be written afterwards.
**Evidence** `qa_02` #61 #62.

### QA-005 · Reminder fires for a dose another caregiver already logged — Medium · M-8
**Steps** schedule 08:00 on two phones; Ana logs 07:55; Ben's phone still alerts 08:00 "Pimobendan 1 3/4 tablet".
**Expected** the occurrence is cancelled/suppressed once logged (Next Up already uses `HandledOccurrence`). **Actual** `planReminders` has no handled input and the `Reminders` effect (`(app)/_layout.tsx`) only re-runs when meds/meals/pet change, never when doses arrive. The duplicate guard would catch a second tap, but the alert itself says "due".
**Evidence** `reminders-outbox.qa.test.ts` "dose already handled…".

### QA-006 · Sign-out leaves outbox and reminders behind — Medium · M-8 (static + DB evidence)
**Steps** A queues entries offline → A taps *Sign out* (`household.tsx` only calls `supabase.auth.signOut()`) → B signs in on the same phone.
**Actual** (a) queued doses flush under B's session and are attributed to B (race-test S8.f); queued feeding/observations are rejected 42501 and become permanent failures (S8.e); (b) A's household reminders keep alerting on the lock screen (pet and medication names). Also: sitter reminders continue after `expires_at` until the 48 h window drains.
**Expected** per-user outbox (store `user_id`, flush only for the signed-in user), clear/cancel on sign-out, cancel on membership loss.

### QA-007 · Reminder scheduling reliability — Medium · M-8 (static)
1. `rescheduleReminders` calls `cancelAllScheduledNotificationsAsync()` then ~60 sequential `await schedule…`; killing the app mid-loop leaves a partial schedule, and the effect re-runs on every refetch (new array identities) so runs overlap.
2. If notification permission is denied it returns `0` silently — no banner, no Household-tab warning, caregiver believes reminders are on.
3. Horizon is 48 h and only extended when the app is opened; nothing tops it up in the background, so a phone nobody opens for 2 days goes silent without any indicator.
4. Cancel-all is per-pet; a second pet would wipe the first pet's reminders.
**Expected** diff-based schedule (add/remove by deterministic id), serialized, a visible "reminders off / exact alarms off" state, background top-up or repeating triggers as a fallback.

### QA-008 · Feeding/observation events cannot be voided — Medium · BE-1 / M-9
**Steps** logger or owner: `update feeding_events set voided_at=now(), voided_by=auth.uid() where id=…` (no RPC exists either).
**Expected** allowed for owner/caregiver (and own entries); columns `voided_at/voided_by` exist for this. **Actual** 0 rows — RLS has no UPDATE policy, so a mistaken urgent log or meal can never be corrected.
**Evidence** `qa_01` #91 #92 #337 #338. **Fix hint** `void_feeding()/void_observation()` RPCs mirroring `void_dose`.

### QA-009 · Handoff notes cannot be resolved — Medium · BE-1 / M-9
**Expected** owner/caregiver/sitter can set `resolved_at/resolved_by`. **Actual** 0 rows (no UPDATE policy). `qa_01` #109–#111.

### QA-010 · Last owner can abandon or demote themselves — Medium · BE-1
`delete from household_members where user_id=auth.uid()` (own row) and `update … set role='caregiver'` both succeed for the only owner. Result: nobody can create invites, change roles, set memorial, or delete the household. `qa_03` #12 #13.

### QA-011 · Invalid timezone accepted — Medium · BE-1 / M-2
`select create_household('x','Not/AZone')` succeeds (also `''`). `Intl.DateTimeFormat` throws `RangeError: Invalid time zone` in `time.ts`, which `buildNextUp`/`planReminders` call on every render → Today tab and reminders crash for the whole household. `qa_03` #18 #19. Add a `check`/validation against `pg_timezone_names`.

### QA-012 · Breathing counter with a screen reader — Medium · M-6 (static, needs device)
`BreathingSheet` counts one breath per `onPress` on a `Pressable` whose `accessibilityLabel` changes every tap. With VoiceOver/TalkBack each tap needs double-tap activation (~2 per second is not achievable) and the label is re-announced. **Expected** a non-gesture alternative (± stepper, or "enter the count" after a timed observation) and/or direct-touch pass-through. Confirm on device (see `accessibility.md`).

### QA-013 · UUID collision across households returns `already_logged` — Low · BE-1
`log_dose` checks `exists (select 1 from dose_events where id = p_id)` without comparing medication. A reused id (buggy client, or deliberate probing) gets `already_logged` for a dose that was never written and learns that the id exists elsewhere. `qa_02` #60. Compare `medication_id` (else raise `23505`).

### QA-014 · `accept_invite` edge cases — Low · BE-5
`on conflict do nothing` still marks the invite accepted when the caller is already a member (`qa_03` #11), and a sitter invite with `sitter_access_until` in the past is accepted into an already-expired membership (`qa_03` #8; no check at creation either).

### QA-015 · Sitters can write to `atticus-reports` — Low · BE-1/BE-4
`atticus_storage_insert` allows owner/caregiver/sitter for both buckets; reports are generated by BE-4 for caregivers. `qa_01` #522.

### QA-016 · Reassuring copy — Low · M-6 / PO-1 (static)
`flows.tsx:371` "Not above the limit you entered from your vet." can be read as "your pet is fine". Prefer neutral wording that only restates the saved number, e.g. "This reading is 24. Your saved limit is 30." (numbers the user entered), reviewed under PO-1.
