# Guardrails audit — no diagnosis, no dose advice, no default thresholds

`node scripts/qa/guardrails.mjs` scans `apps/*/src`, `packages/*/src`, migrations, seed, scripts and `docs/copy.md` for diagnosis / dose-advice / default-threshold / medical-instruction phrasing
(negated sentences such as the disclaimer itself are exempt), **and** inspects the live DB: every number or threshold-like key inside `condition_presets.config` and any numeric column default on `pet_thresholds`, `medications`, `medication_versions`.

**Result: 0 violations** (61 files + presets + DB defaults). Two notes:
1. `medications.duplicate_warning_minutes` defaults to 60. It is the duplicate-dose guard window, not a clinical interval — PO should confirm it is editable and never worded as a "safe" spacing.
2. `scripts/seed-dev.mjs` inserts a numeric demo threshold (`rrr > 30`) labelled `DEMO VALUE…`; it is localhost-guarded. Make sure it never ships in a build or demo screenshot for the stores.

Manual review of user-facing strings (mobile + web):
- ✅ Sign-in disclaimer: "records and organizes… does not give medical advice. Follow your licensed vet."
- ✅ Presets hold questions only (`heart_disease.threshold_prompts` text, no numbers); breathing result compares **only** with the user-entered threshold and shows the user's own `vet_instruction`.
- ✅ Urgent flow: tel: buttons only, "Logged for {pet}", no instructions. Reminder notifications only restate the entered schedule (unit-tested for advice words).
- ⚠️ QA-016: "Not above the limit you entered from your vet." can be read as reassurance.
- ⚠️ `StatusBadge status="overdue"` is reused for "Above the 30 you set": the icon/colour mean "overdue", not "threshold exceeded" (label text carries the meaning, so it is acceptable, but consider a dedicated status).
- ℹ️ Not reviewable yet: vet report PDF (BE-4), memorial copy (M-10), push text (BE-2), store listing — re-run the script when those land.
