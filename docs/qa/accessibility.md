# Accessibility audit (QA-4)

**Executed:** automated token audit and static code review of `apps/mobile` and `packages/core/src/design`.
**Not executed (needs hardware / assistive tech):** VoiceOver, TalkBack, OS font scaling to 200 %, one-handed reach, web screen-reader pass. No screenshots were captured.

## 1. WCAG 2.x AA contrast — PASS (99/99)
`node scripts/qa/contrast.mjs` re-implements the WCAG formula independently of `packages/core/src/design/contrast.ts`.
Light **and** night palettes: ink / ink2 / muted on canvas, surface, sunken and accentSoft (≥ 4.5); onAccent/accent, accentInk/accentSoft, onUrgent/urgent, toast, urgent-as-text;
control borders `strong` ≥ 3 on canvas/surface; focus ring ≥ 3; accent fill vs canvas ≥ 3; `onScrim` over scrim composited on canvas/surface/white/black (worst case);
all six status chips (label on chip fill, and on canvas/surface for non-solid chips); type sizes (body ≥ 18, meta 16, no smaller), line-height ≥ 1.25, tap tokens ≥ 48, `MAX_FONT_SCALE` = 2.

Advisory (not a failure): the focus ring (#1D4ED8 / #8AB4FF) has only 1.01–1.03:1 against the accent fill. It passes only if it is drawn **offset ≥ 2 px** so it sits on the canvas. Verify in the component (Button uses default `Pressable`; no focus style was found in `ui/Button.tsx`) — on web this relies on the browser default outline.

## 2. Touch targets ≥ 48 px — PASS (static)
`Button` min heights 48 / 56 / 64 (tokens), quick-log tiles 64, outcome / urgent-kind rows 56, checkbox rows 60, breathing pad 260, dose input 56. Non-interactive chips (recent activity 40, StatusBadge 34) are not pressable. **Gap:** the `Sheet` backdrop `Pressable` labelled "Close" is full-screen (fine) but is announced as a button behind the dialog by screen readers — verify focus is trapped in the sheet (TODO-DEVICE).

## 3. Screen-reader labels — mostly PASS (static)
Labelled: all `Button`s (label + hint on "Give anyway"), quick-log tiles ("Log …"), outcome radios (`accessibilityRole=radio` + selected state), checkbox rows, feeding choices ("Ate none"), text inputs, tabs (`tabBarAccessibilityLabel`), headings (`accessibilityRole="header"`), SVG icons hidden (`accessible={false}`), StatusBadge reads its label (status is never colour-only: icon + word).
Findings:
- **QA-012** breathing counter operability with VoiceOver/TalkBack (label changes per tap; double-tap activation).
- The Next Up card exposes each item as a single `accessible` element with `it.label`; confirm it also announces the countdown ("DUE IN 15 MIN") — not verifiable statically.
- Urgent log, call buttons and dialogs: roles are right; **TODO-DEVICE** to confirm order and that "Possible double dose" is announced as an alert on open.

## 4. Dynamic type up to 200 % — PARTIAL (static)
`ui/Text.tsx` sets `maxFontSizeMultiplier={MAX_FONT_SCALE}` (2) and the tab bar allows scaling. `TextInput`s (`useNoteInput`, `sign-in`, `meds`) have no multiplier cap, and several rows use fixed `minHeight`s with `flexDirection: 'row'` (quick-log tiles use `flexBasis: '31%'` — three columns will truncate "Resting breathing rate" at 200 %). **TODO-DEVICE:** run each screen at 200 % and bold-text on iOS and 2.0× font + display size on Android; expectation: no clipped primary action, vertical scroll only.

## 5. One-handed reach — not measured
Layout puts Urgent log at the bottom (good). Needs hands-on check on a 6.7" device: primary actions inside the bottom ~40 % of the screen; header actions out of thumb reach are limited to non-urgent items.

## 6. Web (`apps/web`)
Tokens are the same source (`atticus-tokens.css`), so contrast is covered by §1. The breathing chart (`breathing-chart.tsx`) and activity pagination need a keyboard + screen-reader pass and a text alternative/table for the chart: **not run**.
