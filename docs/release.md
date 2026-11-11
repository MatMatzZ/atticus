# Release & environments

| Env   | Supabase (Singapore, ap-southeast-1) | Web (Vercel)        | Mobile (EAS)        | Trigger |
|-------|--------------------------------------|---------------------|---------------------|---------|
| local | `supabase start` (ports 553xx)       | `npm run web`       | `npm run mobile`    | manual  |
| dev   | `atticus-dev`                        | Vercel *preview* env | profile `preview`, channel `dev` | merge to `main` |
| prod  | `atticus-prod`                       | Vercel *production* | profile `production` | tag `vX.Y.Z` |

## Flow
1. PR -> `ci.yml`: `npm ci`, `npm test`, typecheck every workspace, `supabase db lint`, pgTAP (`supabase test db`).
2. Merge to `main` (protected: PR + green CI) -> `deploy-dev.yml`: `db push` to atticus-dev, then web.
3. Release: `git tag vX.Y.Z && git push origin vX.Y.Z` (tag commit must be on `main`) -> `deploy-prod.yml`.
   Waits for approval on the `prod` environment, checks PITR is on, dry-runs then pushes migrations, deploys web, queues EAS builds.
4. `prod-backup-check.yml` re-checks PITR weekly.

Rollback: migrations are forward-only; ship a corrective migration. Data loss: Supabase PITR restore on atticus-prod.

## One-time setup (needs repo admin; not stored in repo)
Secrets, by name, per GitHub **environment** (`dev`, `prod`):
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; `prod` also `EXPO_TOKEN`.
Runtime config lives in Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`: preview -> dev, production -> prod) and EAS env (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` per environment).

```bash
gh api -X PUT repos/OWNER/REPO/environments/dev
gh api -X PUT repos/OWNER/REPO/environments/prod   # then add required reviewers in the UI
gh secret set SUPABASE_ACCESS_TOKEN --env prod      # repeat per secret/env
```
Branch protection on `main`: require PR, required checks `Install, test, typecheck` and `Supabase lint and pgTAP`.
Supabase: create both projects in Singapore; on atticus-prod enable PITR (Pro plan + PITR add-on; needs Small compute or larger).
Vercel: root directory `apps/web`; `vercel.json` disables the automatic `main` deploy (the workflows deploy dev and prod).
EAS: run `eas init` in `apps/mobile` once to link the project.
