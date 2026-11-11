## What & why


## Definition of done
- [ ] No diagnosis, no dose advice, no default thresholds (clinical numbers come from the user's vet)
- [ ] Doses are logged only via `log_dose()` (changes via `change_dose()`)
- [ ] Corrections are voids, never edits (care events are append-only)
- [ ] No secret key in `apps/mobile` or any `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` variable
- [ ] Tests included (`packages/core` and/or pgTAP)
- [ ] RLS policies included for any new table or RPC
- [ ] Migrations are new files only (no edits to applied migrations)
