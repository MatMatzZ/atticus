# ATTICUS — Phase 1 Tasks by Role

**Phase 1 goal:** a heart-disease caregiver household can onboard a pet, follow the
vet's medication and meal plan from the Command Center, log observations (including
urgent events and breathing rate), stay in sync across caregivers without
double-dosing, and export a one-page vet report.

Each task lists the **role**, its **dependencies**, **done-when** criteria, and a
**prompt** you can paste into Claude Code (or hand to a teammate) from the repo root.

---

## Shared context (prefix every prompt with this)

```text
You are working in the ATTICUS monorepo (npm workspaces: apps/web Next.js 16,
apps/mobile Expo SDK 58, packages/core, packages/db, supabase/). Read README.md
"Data model rules" first and follow them strictly:
- ATTICUS records and organizes; it never diagnoses, recommends doses or sets
  clinical thresholds. All clinical numbers are user-entered from their vet.
- Care events are append-only; corrections are voids.
- Doses are written only via rpc.logDose (public.log_dose), with a device-generated UUID.
- Put reusable logic in packages/core with vitest tests; keep apps thin.
- Never put the Supabase secret key in apps/mobile or any NEXT_PUBLIC_ variable.
When done: summarize the plan, the trace of what you changed, and the actions
taken (files, commands, test results).
```

---

## Order of work

```
Week 1   OPS-1 → BE-1 → UX-1 ─┬─ M-1 → M-2 → M-3 → M-4
                              └─ W-1
Week 2   M-5, M-6, M-7, BE-2, BE-5, QA-1
Week 3   M-8, M-9, BE-3, BE-4, W-2, QA-2
Week 4   M-10, W-3, OPS-2, OPS-3, QA-3, QA-4, PO-2 sign-off
```

---

## 👤 Product Owner (Mat)

### PO-1 · Lock Phase 1 copy & disclaimers
**Depends on:** — · **Done when:** onboarding disclaimer, store description and preset question wording are approved and saved in `docs/copy.md`.
```text
Draft docs/copy.md for ATTICUS Phase 1: (1) onboarding disclaimer (not a
diagnostic/medical-advice app; follow your licensed vet), (2) App Store / Play
Store short + long description consistent with that stance, (3) friendly
wording for every heart_disease preset label and threshold question found in
supabase/migrations/*_phase1_core.sql, (4) empty states and error messages for
the duplicate-dose warning, refill reminder and memorial mode. Plain, calm,
neutral language; Grade 6 reading level; offer an optional Filipino version.
```

### PO-2 · Vet advisor review
**Depends on:** PO-1, BE-4 · **Done when:** a licensed vet has reviewed the heart preset fields, threshold questions and a sample PDF report; feedback filed as issues.
```text
Prepare a review packet for a veterinary advisor in docs/vet-review.md: list
every heart_disease preset quick-log, urgent log, tool and threshold question;
include a sample generated PDF report from the demo seed; and add a checklist
of questions for the vet (missing fields, misleading wording, report layout).
```

---

## 🎨 UI/UX Designer

### UX-1 · Design tokens & accessibility baseline
**Depends on:** — · **Done when:** tokens exist for light + night mode, all text/background pairs pass WCAG AA (4.5:1), tap targets ≥ 48 px.
```text
Replace apps/mobile/src/constants/theme.ts with ATTICUS design tokens: a calm
palette (soft neutrals + one accent) in light and night (dark) variants, with
every text/background pair at WCAG AA contrast or better — write a small
script in packages/core to verify contrast ratios and a vitest test for it.
Type scale with large defaults (body ≥ 18), spacing scale, radius, and
semantic colors for status: upcoming, due_soon, overdue, urgent. Minimum tap
target 48px. Export the same tokens as CSS variables for apps/web.
```

### UX-2 · Phase 1 screen designs
**Depends on:** UX-1 · **Done when:** designs for every screen below are approved (Design artifact or Figma link in `docs/design.md`).
```text
Design the Phase 1 screens for ATTICUS, optimized for a tired caregiver at
night using one hand: Onboarding (household → pet → condition preset → vet
threshold questions → meds & meals → invite family), Command Center ("Here is
what [Pet] needs next", Next Up card with countdown, recent activity strip,
quick-log grid, persistent Urgent Log button), duplicate-dose confirmation
dialog ("Already given by Ana at 8:02 AM"), feeding fraction picker,
breathing counter, urgent log with video + one-tap call vet/ER, medication
detail (dose history, inventory, refill), household members & invite QR,
memorial mode. Document states: loading skeleton, offline, error, empty.
```

---

## 🗄️ Backend / Database Engineer

### BE-1 · Local stack, types and RLS tests
**Depends on:** OPS-1 · **Done when:** `npm run db:reset && npm run db:seed-dev && npx supabase test db` all pass; types generated.
```text
Start the local Supabase stack (npm run db:start), run db:reset and
db:seed-dev, then npm run db:types. Add pgTAP tests in supabase/tests/ that
cover the role matrix: owner, caregiver, sitter (active + expired), vet,
outsider × select/insert/update/delete on every public table, plus
log_dose (logged / needs_confirmation / already_logged / force), void_dose
inventory restore, change_dose versioning, accept_invite expiry, and
set_pet_memorial deactivating schedules. Run `npx supabase test db` until green.
```

### BE-2 · Push notifications to the household
**Depends on:** BE-1 · **Done when:** logging a dose or urgent event pushes to every other active member's devices within 5 s.
```text
Add a migration for push_tokens (user_id, expo_push_token, platform,
updated_at, RLS: users manage their own) and a notification_queue table.
Create Edge Function notify-household that sends Expo push messages to every
active member except the actor. Trigger it from a database webhook on insert
into dose_events (outcome given/vomited_after/refused) and observation_events
(is_urgent = true). Message examples: "Ben gave Pimobendan (1 3/4) at 8:02 AM",
"URGENT: Collapse logged for Bantay". Respect memorial-status pets (no pushes).
```

### BE-3 · Scheduled jobs (pg_cron)
**Depends on:** BE-2 · **Done when:** overdue doses and low inventory create one notification each (no duplicates); expired sitters lose access.
```text
Enable pg_cron in a migration. Jobs: (1) every 5 min, find scheduled med
occurrences in each household timezone that are ≥ 30 min overdue with no
dose_event, and enqueue ONE "overdue" notification per occurrence for all
caregivers; (2) daily 09:00 household time, enqueue refill reminders where
quantity_on_hand <= refill_alert_at (once per medication per day);
(3) hourly, delete household_members rows for sitters whose expires_at passed.
Mirror the schedule-expansion logic from packages/core/src/nextUp.ts in SQL and
add pgTAP tests.
```

### BE-4 · Vet report PDF
**Depends on:** BE-1 · **Done when:** report for a date range renders in < 5 s and is stored in `atticus-reports`.
```text
Create Edge Function generate-vet-report(pet_id, from, to) that runs as the
calling user (pass their JWT; RLS applies) and produces a one-page PDF:
pet header + conditions + vet-entered thresholds; medication table with dose
history (medication_versions) and adherence (given/late/skipped/refused/
vomited counts); food intake trend (portion_eaten); breathing-rate chart with
the user's threshold line; chronological notable/urgent events. No
interpretation text. Save to atticus-reports/<household>/<pet>/<date>.pdf and
return a signed URL (24h).
```

### BE-5 · Invite links & QR
**Depends on:** BE-1 · **Done when:** an invite opens the app (or web fallback) and joins the household with the right role.
```text
Implement invite links: atticus://invite/<token> with a web fallback route
apps/web/src/app/invite/[token]/page.tsx that signs the user in and calls
rpc.acceptInvite. Sitter invites require sitter_access_until. Owners can
revoke pending invites. Add a QR code for the link on the household screen.
```

---

## 📱 Mobile Engineer (Expo)

### M-1 · App shell & auth
**Depends on:** UX-1 · **Done when:** user can sign in with email OTP, session persists across restarts, template code removed, `npx tsc --noEmit` clean.
```text
In apps/mobile run `npm run reset-project` and delete leftover template
components. Build the shell with expo-router: (auth) stack with email OTP
sign-in (supabase.auth.signInWithOtp / verifyOtp) and (app) tabs: Today,
Logs, Meds, Household. Use src/lib/supabase.ts and the UX-1 theme tokens with
night mode. Guard routes on session. Make `npx tsc --noEmit` pass.
```

### M-2 · Onboarding
**Depends on:** M-1 · **Done when:** a new user goes from sign-in to a configured Command Center in ≤ 3 minutes.
```text
Build onboarding: create household (rpc.createHousehold), add pet, pick a
condition preset from condition_presets where is_available, answer the
preset's threshold_prompts (store as pet_thresholds with vet_instruction;
allow "I don't have this yet" → skip), add vet + emergency clinic contacts,
add medications (name, strength, dose using parseAmount/formatAmount from
@atticus/core so "1 3/4" works, with_food, times, quantity, refill alert)
and meal times. Final step: invite family (BE-5) or skip.
```

### M-3 · Command Center + Next Up card
**Depends on:** M-2 · **Done when:** the card shows the right items/countdown, Confirm Done logs via log_dose, and the duplicate warning appears when another caregiver already gave it.
```text
Build the Today tab. Greeting + "Here is what {pet} needs next". Use
buildNextUp from @atticus/core (household timezone) with the pet's
med_schedules, meal_schedules and handled occurrences from today's events.
Next Up card: items (med + meal together), exact fractional amounts,
countdown label updating every 30 s, status colors. Confirm Done → for each
med item call rpc.logDose with crypto.randomUUID(); on needs_confirmation show
"Already given by {name} at {time}. Give anyway?" (Cancel / Give anyway →
force:true). Secondary actions: Skipped, Refused, Vomited after, with note.
Recent activity strip from activity_feed (last 6). Persistent Urgent Log FAB.
```

### M-4 · Feeding workflow
**Depends on:** M-3 · **Done when:** logging a meal asks "Did {pet} finish their food?" and stores the fraction.
```text
When a meal item is confirmed, ask "Did {pet} finish their food?" Yes → insert
feeding_events portion_eaten 1. No → fraction picker using PORTION_CHOICES
from @atticus/core plus Custom (slider 0–1 in eighths). Big buttons, one tap.
```

### M-5 · Quick logs & Urgent Log
**Depends on:** M-3 · **Done when:** all heart preset quick logs work in ≤ 2 taps; urgent log captures time, note and video and offers one-tap calls.
```text
Render the quick-log grid from the pet's preset config (quick_logs: tap,
choice, scale, visual_scale). Insert observation_events with auto timestamps.
Urgent Log: choose an urgent_logs kind (or "Other"), optional note, optional
video (expo-camera / image-picker, ≤ 60 s), upload to atticus-media using
mediaPath() from @atticus/db, set is_urgent=true. After saving, show big
buttons to call the regular vet and the emergency clinic (tel: links) — no
medical instructions.
```

### M-6 · Breathing counter
**Depends on:** M-5 · **Done when:** counter produces breaths/min and compares only to the user's threshold.
```text
Build the breathing counter tool: choose 30 s or 60 s, start timer, big
tap-anywhere area (haptic per tap), result via breathsPerMinute from
@atticus/core, save as observation_events kind 'rrr', unit 'breaths/min'.
Show a 14-day chart with the user's threshold line. If crossedThresholds()
returns matches, show the user's own vet_instruction text and the call-vet
buttons. If no threshold is set, prompt them to ask their vet.
```

### M-7 · Medication management
**Depends on:** M-3 · **Done when:** doses can be changed with history, inventory tracks fractional use, refill reminders show.
```text
Meds tab: list with next time, current dose (formatAmount), days of supply
(daysOfSupply) and refill badge (needsRefill). Detail: dose history from
medication_versions; "Change dose" → rpc.changeDose; edit schedule times;
"Add supply" to increase quantity_on_hand; archive medication. Dose history
of the last 14 days with voided entries shown struck through; "Undo" on own
recent entries → rpc.voidDose.
```

### M-8 · Reminders & offline queue
**Depends on:** M-3 · **Done when:** reminders fire with the app killed and in airplane mode; offline logs sync without duplicates.
```text
Schedule local notifications with expo-notifications for the next 48 h of
med + meal occurrences (reschedule on any schedule change and on app start).
Android: request exact-alarm permission; iOS: time-sensitive interruption
level. Build an offline outbox in expo-sqlite: events are written locally
first with their UUID, shown immediately in the UI, then flushed via
rpc.logDose / inserts when online. If a flushed dose returns
needs_confirmation, surface a review prompt instead of forcing it.
Register the Expo push token into push_tokens (BE-2).
```

### M-9 · Family Sync
**Depends on:** M-3, BE-2 · **Done when:** two phones see each other's logs live; handoff notes work.
```text
Subscribe with supabase realtime to dose_events, feeding_events,
observation_events, handoff_notes and medications for the current pet;
merge into local state and recompute the Next Up card. Activity feed screen
(who/what/when). Handoff notes: create, list, resolve. Household tab:
members with roles, sitter expiry, invite QR (BE-5), remove member (owner).
```

### M-10 · Memorial mode
**Depends on:** M-9 · **Done when:** marking a pet as passed stops all reminders on all devices and keeps records.
```text
Owner-only flow with gentle copy (from docs/copy.md): confirm, choose date,
call rpc.setPetMemorial, cancel all local notifications for that pet on this
device; other devices cancel on the realtime update. Pet moves to a calm
"In memory" section; records and reports stay available.
```

---

## 🌐 Web Engineer (Next.js)

### W-1 · Auth, session proxy, performance baseline
**Depends on:** UX-1 · **Done when:** sign-in works, session refreshes, Lighthouse performance ≥ 90 on the dashboard shell.
```text
In apps/web: add src/proxy.ts that refreshes the Supabase session with
@supabase/ssr (Next 16 proxy convention), sign-in page (email OTP), and an
authenticated layout using UX-1 CSS variables with a night theme. Apply the
performance checklist: compressed images (next/image), lazy loading, route
code-splitting, cache API responses where safe, minified assets, avoid
unnecessary re-renders, debounce inputs, paginate long lists, no unused
dependencies, defer non-critical scripts, loading skeletons, compressed API
payloads, cached expensive queries, no N+1 queries (use joins/views).
```

### W-2 · Household dashboard & reports
**Depends on:** W-1, BE-4 · **Done when:** a caregiver can review trends and download the vet PDF on desktop.
```text
Build /pets/[id]: activity feed (paginated, from activity_feed view),
food-intake and breathing-rate charts with the user's threshold line,
adherence table per medication, and "Generate vet report" (date range) that
calls generate-vet-report and downloads the PDF. Server Components for reads;
skeletons while loading.
```

### W-3 · Vet read-only view
**Depends on:** W-2 · **Done when:** a vet-role member sees the pet summary and reports but no edit controls.
```text
Add a vet-friendly read-only layout for members with role 'vet': summary,
current meds and dose history, recent urgent events with media, reports.
Hide all write actions based on current role; RLS already enforces it —
verify by attempting writes in a test and expecting failure.
```

---

## ✅ QA Engineer

### QA-1 · Role & RLS matrix
**Depends on:** BE-1
```text
Write docs/qa/rls-matrix.md: a table of roles × tables × operations with the
expected result, cross-checked against supabase/tests. Add any missing pgTAP
cases and run `npx supabase test db`.
```

### QA-2 · Double-dose race test
**Depends on:** M-3, M-8
```text
Write and run a script (scripts/race-test.mjs) that signs in two demo
caregivers and calls log_dose for the same medication concurrently 50 times
with force=false. Assert exactly one 'logged' per window and the rest
'needs_confirmation'; assert inventory decremented once. Also test the
offline path: queue a dose on device A offline, log on device B, reconnect A.
```

### QA-3 · Notification reliability matrix
**Depends on:** M-8, BE-2, BE-3
```text
Create docs/qa/notifications.md test matrix: iOS + Android × app foreground /
background / killed × Do Not Disturb / Focus × offline × battery saver ×
timezone change. Record pass/fail for dose reminders, overdue escalation,
household pushes and refill alerts. File bugs for every failure.
```

### QA-4 · Accessibility audit
**Depends on:** UX-2, M-5
```text
Audit mobile and web for: WCAG AA contrast, dynamic type up to 200%,
VoiceOver/TalkBack labels on every button (especially Next Up, Urgent Log,
breathing counter), tap targets ≥ 48 px, one-handed reach. Report in
docs/qa/accessibility.md with screenshots and fixes.
```

---

## 🛠️ DevOps

### OPS-1 · Repo & CI
**Depends on:** —
```text
Initialize git, push to a private GitHub repo, and add .github/workflows/ci.yml:
npm ci, npm test, typecheck all workspaces, `npx supabase db lint`, and pgTAP
tests via `supabase start` + `supabase test db`. Protect main (PR + green CI).
```

### OPS-2 · Hosted Supabase (dev & prod)
**Depends on:** BE-1
```text
Document and script: create Supabase projects atticus-dev and atticus-prod
(Singapore region), `npx supabase link`, `npx supabase db push` to dev on
merge to main and to prod on release tags via GitHub Actions (access token +
db password as secrets). Configure auth redirect URLs (web domain +
atticus://**), SMTP for OTP emails, and enable PITR/backups on prod.
```

### OPS-3 · App builds & web hosting
**Depends on:** M-1, W-1
```text
Add eas.json with development, preview and production profiles (bundle id
com.atticus.pethealth), EAS env vars for the Supabase URL + publishable key per
environment, and EAS Update channels. Deploy apps/web to Vercel with env vars
per environment. Document the release checklist in docs/release.md.
```
