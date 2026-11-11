// Independent WCAG 2.x audit of packages/core/src/design/tokens.ts (does NOT reuse the repo's own contrast.ts).
//   node scripts/qa/contrast.mjs        exit 1 on any failure
import { palettes, statusColors, STATUS_KEYS, tap, typeScale, MIN_BODY_SIZE, MAX_FONT_SCALE } from '../../packages/core/src/design/tokens.ts';

const parse = (c) => {
  if (c.startsWith('rgba')) { const [r, g, b, a] = c.match(/[\d.]+/g).map(Number); return { r, g, b, a }; }
  const h = c.replace('#', ''); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
};
const over = (fg, bg) => { const f = parse(fg), b = parse(bg); const a = f.a; return { r: f.r * a + b.r * (1 - a), g: f.g * a + b.g * (1 - a), b: f.b * a + b.b * (1 - a), a: 1 }; };
const L = ({ r, g, b }) => { const [R, G, B] = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

let n = 0, bad = 0;
const check = (theme, what, fg, bg, need) => {
  const bgc = parse(bg); const fgc = parse(fg).a < 1 ? over(fg, bg) : parse(fg);
  const r = ratio(fgc, bgc); n++; const ok = r >= need; if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${theme.padEnd(6)} ${what.padEnd(46)} ${r.toFixed(2).padStart(5)}:1 (need ${need})`);
};

for (const [theme, p] of Object.entries(palettes)) {
  for (const fg of ['ink', 'ink2', 'muted']) for (const bg of ['canvas', 'surface', 'sunken', 'accentSoft']) check(theme, `${fg} on ${bg}`, p[fg], p[bg], 4.5);
  check(theme, 'onAccent on accent (primary button)', p.onAccent, p.accent, 4.5);
  check(theme, 'accent on canvas (links/text)', p.accent, p.canvas, 4.5);
  check(theme, 'accent on surface (links/text)', p.accent, p.surface, 4.5);
  check(theme, 'accentInk on accentSoft (selected)', p.accentInk, p.accentSoft, 4.5);
  check(theme, 'onUrgent on urgent (Urgent button)', p.onUrgent, p.urgent, 4.5);
  check(theme, 'urgent on canvas (text)', p.urgent, p.canvas, 4.5);
  check(theme, 'toastFg on toastBg', p.toastFg, p.toastBg, 4.5);
  // UI-component contrast (WCAG 1.4.11): control borders, focus ring, accent fill vs page
  for (const bg of ['canvas', 'surface']) { check(theme, `strong border on ${bg}`, p.strong, p[bg], 3); check(theme, `focus ring on ${bg}`, p.focus, p[bg], 3); }
  { const r = ratio(parse(p.focus), parse(p.accent)); console.log(`ADVISE ${theme.padEnd(6)} focus ring vs accent fill = ${r.toFixed(2)}:1 -> ring MUST be offset >=2px so it sits on canvas, not on the button`); }
  check(theme, 'accent fill vs canvas (button boundary)', p.accent, p.canvas, 3);
  // text drawn on the scrim: worst case = scrim over the page's lightest/darkest content
  for (const content of [p.canvas, p.surface, '#FFFFFF', '#000000']) check(theme, `onScrim on scrim over ${content}`, p.onScrim, over(p.scrim, content).constructor === Object ? `#${[over(p.scrim, content).r, over(p.scrim, content).g, over(p.scrim, content).b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}` : content, 4.5);
  for (const k of STATUS_KEYS) {
    const s = statusColors[theme][k];
    check(theme, `status ${k}: label on chip`, s.fg, s.bg, 4.5);
    if (k !== 'urgent') { // urgent is a solid chip: its label only ever sits on its own fill
      check(theme, `status ${k}: label on canvas`, s.fg, p.canvas, 4.5);
      check(theme, `status ${k}: label on surface`, s.fg, p.surface, 4.5);
    }
  }
}
// Sizes & targets
const sizes = Object.entries(typeScale);
console.log('');
for (const [name, t] of sizes) { n++; const ok = t.size >= 16 && (name === 'meta' || name.startsWith('numeral') || t.size >= MIN_BODY_SIZE || name === 'heading' || name === 'title'); if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  type ${name.padEnd(10)} ${t.size}px / lh ${t.lineHeight} (lh>=1.25x: ${t.lineHeight / t.size >= 1.25})`); }
for (const [k, v] of Object.entries(tap)) { if (k === 'gap') continue; n++; const ok = v >= 48; if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  tap.${k} = ${v}px (need >= 48)`); }
n++; if (MAX_FONT_SCALE < 2) { bad++; console.log('FAIL  MAX_FONT_SCALE < 2'); } else console.log(`PASS  MAX_FONT_SCALE = ${MAX_FONT_SCALE} (WCAG 1.4.4 needs 200%)`);
console.log(`\n${n - bad}/${n} checks OK`);
process.exit(bad ? 1 : 0);
