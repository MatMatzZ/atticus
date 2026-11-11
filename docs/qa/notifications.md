# Notification reliability matrix (QA-3)

**Status: partially executed.** No physical iOS/Android device or simulator was available to QA in this session, and
BE-2 (push) / BE-3 (pg_cron overdue + refill jobs) do not exist in the repo yet (`supabase/functions/` is absent, only two migrations).
Cells are therefore one of: **PASS (auto)** = proven by an executable test, **FAIL (auto)** = failing test / bug filed,
**STATIC** = found by code review, **TODO-DEVICE** = must be run on hardware, **BLOCKED** = feature not built.

Code under test: `packages/core/src/reminders.ts`, `apps/mobile/src/lib/reminders.ts`, `apps/mobile/src/lib/outbox.ts`,
`apps/mobile/app.json` (has `time-sensitive` entitlement, `SCHEDULE_EXACT_ALARM`, `POST_NOTIFICATIONS`).

## A. Local dose / meal reminders (M-8)

| Scenario | iOS | Android | Evidence |
|---|---|---|---|
| Plan covers next 48 h, ordered, future only, deterministic unique ids | PASS (auto) | PASS (auto) | `reminders-outbox.qa.test.ts`, `core/reminders.test.ts` |
| Shows exact fraction + "with food", no advice wording | PASS (auto) | PASS (auto) | same |
| Household timezone is the clock; device timezone change (Auckland / LA / Manila) leaves plan identical | PASS (auto) | PASS (auto) | "device timezone changes…" |
| Household-local weekday filter (Mon 07:00 Manila = Sun 23:00 UTC) | PASS (auto) | PASS (auto) | test |
| DST spring-forward / fall-back (NY), nonexistent & ambiguous local times → exactly one reminder/day | PASS (auto) | PASS (auto) | 3 tests |
| App foreground banner + sound | TODO-DEVICE | TODO-DEVICE | handler returns banner/list/sound |
| App background | TODO-DEVICE | TODO-DEVICE | local notifications are OS-scheduled |
| **App killed (swipe-away)** | TODO-DEVICE | TODO-DEVICE (OEM task-killers: Xiaomi/Oppo/Samsung "sleeping apps" may drop alarms) | |
| **Airplane mode** | TODO-DEVICE (expected PASS: local) | TODO-DEVICE (expected PASS) | no network use in `rescheduleReminders` |
| Do Not Disturb / Focus: Time-Sensitive breaks through Focus only if the user allows it | TODO-DEVICE; entitlement present | n/a — channel is `IMPORTANCE_HIGH` but DND overrides it unless user allows channel | confirm copy tells users to allow |
| **Battery saver / Doze / App Standby** | n/a | TODO-DEVICE; inexact alarms are deferred by Doze unless exact alarms are granted | `requestExactAlarms()` exists but is only reachable from Household tab |
| Exact-alarm permission denied (Android 14+ default) | n/a | STATIC: no in-flow prompt on first schedule; no warning state | QA-007 |
| Notification permission denied | STATIC: silent | STATIC: silent | QA-007 (returns 0, no UI) |
| Phone reboot | TODO-DEVICE (iOS keeps scheduled) | TODO-DEVICE (expo-notifications re-registers on boot) | |
| **Dose already logged by someone else → reminder still fires** | FAIL (auto) | FAIL (auto) | QA-005 |
| Sign-out / account switch leaves reminders | STATIC FAIL | STATIC FAIL | QA-006 |
| Sitter access expires, reminders continue up to 48 h | STATIC FAIL | STATIC FAIL | QA-006 |
| Partial schedule if app killed during reschedule loop; overlapping runs | STATIC FAIL | STATIC FAIL | QA-007 |
| Nobody opens the app for > 48 h → reminders stop with no indicator | STATIC FAIL | STATIC FAIL | QA-007 |
| 64-pending-notification iOS cap: plan caps at 60 per pet | PASS for 1 pet; STATIC risk for ≥ 2 pets (cancel-all is global) | n/a | QA-007 |
| Memorial: reminders cancelled on this device | STATIC PASS (`memorial` → cancel-all, return) | same | needs two-device realtime check (M-10) |

## B. Offline queue (M-8)

| Scenario | Result | Evidence |
|---|---|---|
| Offline dose, other caregiver logs first, reconnect → `needs_confirmation`, never auto-forced | PASS (auto) | `race-test.mjs` S6 |
| Replayed flush (response lost) → `already_logged`, inventory untouched | PASS (auto) | S6.g/h |
| Concurrent outbox flush + live taps: no two un-forced doses < 60 min apart | PASS (auto) | S7 |
| Feeding/observation replay is idempotent and append-only (same id, changed payload not applied) | PASS (auto) | S8.a–d |
| Transient server errors (JWT expiry, timeout, deadlock, PostgREST restart) keep entry queued | **FAIL (auto)** | QA-002 |
| Account switch on same phone | FAIL (auto/static) | S8.e/f, QA-006 |
| Actual airplane-mode toggle on a device, kill app while queued, relaunch | TODO-DEVICE | outbox is SQLite-backed so expected to survive |

## C. Household push, overdue escalation, refill alerts — BLOCKED

| Feature | Task | iOS | Android |
|---|---|---|---|
| Push to every other active member within 5 s of dose/urgent log | BE-2 | BLOCKED | BLOCKED |
| One "overdue" notification per occurrence ≥ 30 min late (no duplicates) | BE-3 | BLOCKED | BLOCKED |
| Refill reminder once/medication/day at 09:00 household time | BE-3 | BLOCKED | BLOCKED |
| Expired sitters lose access hourly; no pushes after memorial | BE-3 / BE-2 | BLOCKED | BLOCKED |
| App-state matrix (foreground / background / killed) × DND × offline × battery saver × timezone change for each of the above | | BLOCKED | BLOCKED |

DB-side prerequisite already verified: expired sitters get no data access (RLS matrix), and memorial deactivates schedules (qa_03 MEM-2),
so BE-3's job queries can rely on `active` flags *once QA-003 is fixed*.

## D. Device run-sheet (to execute when hardware is available)
For each of iPhone (iOS 17+) and Pixel/Samsung (Android 14+): create a dose due in 2 min, then test **foreground → background → force-quit → airplane mode → Focus/DND on → battery saver on → change phone timezone → reboot**; record pass/fail + minutes of drift. File failures as `QA-0xx` in `bugs.md` with the device, OS version and build.
