# ATTICUS QA — plan, trace, actions

## Plan (priority order, per brief)
1. Dose safety — concurrent + offline `log_dose`, voids, inventory.
2. Data safety — full role × table × operation RLS matrix, RPC privileges, storage policies.
3. Reminder reliability — iOS/Android, killed, DND, offline, battery saver, timezone.
4. Accessibility — AA contrast, labels, dynamic type, 48 px targets.
5. Guardrails — no diagnosis, dose advice or default thresholds.

## What was tested (trace)
| # | Check | How | Result |
|---|---|---|---|
| 1 | RLS matrix: 77 table/op rows × 6 roles, anon, RPC privileges, storage, structural guards | pgTAP `qa_01_rls_matrix` (531 assertions) | 521 pass · **10 fail** → QA-001/003/008/009/015 |
| 2 | Dose guard, idempotency, window boundary, void/inventory, clamping, versions, auth, state | pgTAP `qa_02_dose_safety` (64) | 59 pass · **5 fail** → QA-001/004/013 |
| 3 | Invites, ownership, households, memorial | pgTAP `qa_03_lifecycle` (33) | 21 pass · **12 fail** → QA-003/010/011/014 |
| 4 | Concurrency: 3×50 parallel `log_dose`, 20× same-UUID, 10× forced, 20× parallel void, log/void storm, offline-A/online-B, outbox replay & upserts (HTTP via PostgREST) | `scripts/race-test.mjs` | **43/43 pass** (invariant: stock = start − Σ non-voided decrements, held in every scenario) |
| 5 | Offline classification + reminder planning (tz, DST, weekday, handled doses) | vitest `scripts/qa/reminders-outbox.qa.test.ts` | 15 pass · **8 fail** → QA-002/005 |
| 6 | Reminder device matrix | `notifications.md` | static review done; device runs + BE-2/BE-3 **blocked** |
| 7 | WCAG contrast, type, targets | `scripts/qa/contrast.mjs` | **99/99** |
| 8 | Labels / dynamic type / reach | static review | QA-012; device pass pending |
| 9 | Guardrail scan (code, copy, presets, DB defaults) | `scripts/qa/guardrails.mjs` | **0 violations**, 2 notes, QA-016 |

Totals: pgTAP 628 assertions (601 pass / 27 fail), race 43/43, vitest QA 23 (15/8), existing core suite 38/38 (`npm test`).
All failures are real, reproducible bugs, listed in [bugs.md](bugs.md) (16 filed: 3 High, 9 Medium, 4 Low).
Four earlier suspicions were fixed by BE-1's `rls_hardening` migration during the session and are kept as regression tests.

## Actions taken
Files created (QA scope only; no feature code touched):
- `supabase/tests/database/qa_01_rls_matrix.test.sql`, `qa_02_dose_safety.test.sql`, `qa_03_lifecycle.test.sql` (generated; sources in `scripts/qa/pgtap-src/`)
- `scripts/race-test.mjs`, `scripts/qa/{run-pgtap.sh,build-pgtap.sh,contrast.mjs,guardrails.mjs,reminders-outbox.qa.test.ts}`
- `docs/qa/{README,bugs,rls-matrix,notifications,accessibility,guardrails}.md`

The pgTAP files are wrapped in `BEGIN…ROLLBACK`; the race test creates and deletes its own users/household (verified: 0 leftover rows). Everything targets the local stack only.

## How to run
```bash
scripts/qa/build-pgtap.sh                # regenerate qa_*.test.sql from sources
npx supabase test db                      # or: scripts/qa/run-pgtap.sh (psql fallback via the db container)
node --env-file=.env.local --env-file=apps/web/.env.local scripts/race-test.mjs
npx vitest run --root . scripts/qa/reminders-outbox.qa.test.ts
node scripts/qa/contrast.mjs && node scripts/qa/guardrails.mjs
```
`npx supabase test db` was not used for the reported numbers (it needs to pull the pg_prove image); results come from the same files run through `psql` in the `supabase_db_atticus` container.
Failing QA tests will keep CI red until the bugs are fixed — expected; mark individual cases `todo` only with PO agreement.

## Not covered / next
Physical-device matrix (reminders, VoiceOver/TalkBack, 200 % type, reach); BE-2 push, BE-3 cron jobs, BE-4 PDF, M-10 memorial UI, W-3 vet view (not built or not reviewable); Realtime/RLS interaction; load beyond 50 concurrent callers; vet report guardrail scan once generated.
