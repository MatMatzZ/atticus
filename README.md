# ATTICUS — Pet Health Tracker

Condition-aware care tracking for caregivers of senior and chronically ill pets.
ATTICUS **records and organizes** — it never diagnoses, recommends doses, or sets
thresholds. Every clinical number comes from the user's own veterinarian.

```
apps/web          Next.js 16 (web app, vet report viewer)
apps/mobile       Expo SDK 58 (iOS / Android)
packages/core     Pure care logic: fractions, Next Up, dose guard, thresholds (tested)
packages/db       Supabase client + typed RPC wrappers + generated DB types
supabase/         config.toml (ports 553xx), migrations, seed
scripts/          seed-dev.mjs (local demo data)
docs/TASKS.md     Phase 1 work, split by role, with ready-to-use prompts
```

## First run (macOS)

Prerequisites: Node 20+, Docker Desktop running.

```bash
npm install
npm run db:start            # local Supabase on ports 55321–55329
#   → copy the printed Publishable + Secret keys
cp .env.example .env.local                      # paste SUPABASE_SECRET_KEY
cp apps/web/.env.example apps/web/.env.local    # paste publishable key
cp apps/mobile/.env.example apps/mobile/.env    # paste publishable key
npm run db:seed-dev         # demo household: owner@atticus.test / caregiver@atticus.test
npm run db:types            # generate packages/db/src/database.types.ts
npm test                    # core logic tests
npm run web                 # http://localhost:3000
npm run mobile              # Expo
```

Studio (DB browser): http://127.0.0.1:55323 · Auth test inbox: http://127.0.0.1:55324

> The Supabase CLI is pinned in `package.json`, so always use `npx supabase …`
> (or the `npm run db:*` scripts) from the repo root. A global/older CLI may not
> understand this `config.toml`.

### Port conflict?
If `supabase start` says `address already in use`, run `lsof -i :<port>`.
On macOS, `rapportd` (Continuity/Handoff) sometimes holds a port — change that
port in `supabase/config.toml` instead of killing the process.

## Data model rules (read before changing the schema)

- **Households** own pets. Roles: `owner`, `caregiver`, `sitter` (expires), `vet` (read-only). RLS enforces all of it.
- **Care events are append-only** (`dose_events`, `feeding_events`, `observation_events`). Corrections are voids, never edits.
- **Doses only go through `log_dose()`** — it locks the medication row, runs the duplicate-dose guard, decrements inventory, and is idempotent on the client-generated id (offline-safe).
- **Dose changes go through `change_dose()`** so reports show dose history.
- **Thresholds are user-entered** (`pet_thresholds`). Presets contain *questions to ask the vet*, never numbers.
- **Memorial mode** (`set_pet_memorial`) stops every schedule for every caregiver.
- Storage paths: `<household_id>/<pet_id>/<file>` in private buckets `atticus-media`, `atticus-reports`.

Schema changes: `npx supabase migration new <name>` → write SQL → `npm run db:reset` → `npm run db:types`.
