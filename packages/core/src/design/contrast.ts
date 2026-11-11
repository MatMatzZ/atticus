/**
 * WCAG 2.x contrast checking for the ATTICUS tokens.
 *
 * Only `import type` from tokens.ts, so `scripts/check-contrast.ts` can run
 * this file with Node's built-in type stripping (no build step).
 */
import type { Palette, StatusColors, StatusKey, ThemeName } from './tokens';

export const WCAG_AA = { text: 4.5, largeText: 3, ui: 3 } as const;

export interface Rgba { r: number; g: number; b: number; a: number }

/** Parses #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(). */
export function parseColor(input: string): Rgba {
  const s = input.trim();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) throw new Error(`Unsupported colour: ${input}`);
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map((p) => p.trim());
    const [r, g, b] = parts.slice(0, 3).map(Number);
    const a = parts[3] === undefined ? 1 : Number(parts[3]);
    if ([r, g, b, a].some((v) => Number.isNaN(v))) throw new Error(`Unsupported colour: ${input}`);
    return { r, g, b, a };
  }
  throw new Error(`Unsupported colour: ${input}`);
}

/** Flattens a (possibly translucent) colour over an opaque backdrop. */
export function composite(top: string, backdrop: string): Rgba {
  const t = parseColor(top);
  const b = parseColor(backdrop);
  if (b.a !== 1) throw new Error(`Backdrop must be opaque: ${backdrop}`);
  const mix = (x: number, y: number) => Math.round(x * t.a + y * (1 - t.a));
  return { r: mix(t.r, b.r), g: mix(t.g, b.g), b: mix(t.b, b.b), a: 1 };
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(c: Rgba | string): number {
  const { r, g, b, a } = typeof c === 'string' ? parseColor(c) : c;
  if (a !== 1) throw new Error('Composite translucent colours before measuring luminance');
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio (1–21). Translucent `bg` needs a `backdrop` to flatten onto. */
export function contrastRatio(fg: string, bg: string, backdrop?: string): number {
  const bgFlat = parseColor(bg).a < 1 ? composite(bg, backdrop ?? '#FFFFFF') : parseColor(bg);
  const fgFlat = parseColor(fg).a < 1 ? composite(fg, toHex(bgFlat)) : parseColor(fg);
  const L1 = relativeLuminance(fgFlat);
  const L2 = relativeLuminance(bgFlat);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

function toHex({ r, g, b }: Rgba): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export type PairKind = 'text' | 'ui';

export interface ContrastPair {
  theme: ThemeName;
  name: string;
  fg: string;
  bg: string;
  /** Opaque colour under a translucent bg (scrim). */
  backdrop?: string;
  kind: PairKind;
  min: number;
}

export interface ContrastResult extends ContrastPair { ratio: number; pass: boolean }

type PaletteKey = keyof Palette;

/**
 * Every foreground/background pair the apps are allowed to draw.
 * `hair` and `sunken`/`edge` outlines are decorative and deliberately absent:
 * no control or status may rely on them alone.
 */
export function contrastPairs(
  palettes: Record<ThemeName, Palette>,
  statusColors: Record<ThemeName, Record<StatusKey, StatusColors>>,
): ContrastPair[] {
  const out: ContrastPair[] = [];
  for (const theme of Object.keys(palettes) as ThemeName[]) {
    const p = palettes[theme];
    const add = (name: string, fg: string, bg: string, kind: PairKind, backdrop?: string) =>
      out.push({ theme, name, fg, bg, backdrop, kind, min: kind === 'text' ? WCAG_AA.text : WCAG_AA.ui });
    const textOn = (fgKey: PaletteKey, bgKeys: PaletteKey[]) =>
      bgKeys.forEach((bgKey) => add(`${fgKey} on ${bgKey}`, p[fgKey], p[bgKey], 'text'));

    // Text on the three grounds.
    textOn('ink', ['canvas', 'surface', 'sunken', 'accentSoft']);
    textOn('ink2', ['canvas', 'surface', 'sunken']);
    textOn('muted', ['canvas', 'surface', 'sunken']);
    // Links / outline-button labels.
    textOn('accent', ['canvas', 'surface']);
    textOn('urgent', ['canvas', 'surface']);
    // Filled components.
    add('onAccent on accent', p.onAccent, p.accent, 'text');
    add('accentInk on accentSoft', p.accentInk, p.accentSoft, 'text');
    add('onUrgent on urgent', p.onUrgent, p.urgent, 'text');
    add('toastFg on toastBg', p.toastFg, p.toastBg, 'text');
    // Text on the scrim, measured over the lightest content it can cover.
    add('onScrim on scrim (over surface)', p.onScrim, p.scrim, 'text', p.surface);
    add('onScrim on scrim (over canvas)', p.onScrim, p.scrim, 'text', p.canvas);
    // Non-text: control borders, focus ring, selected outline (WCAG 1.4.11).
    for (const bg of ['canvas', 'surface'] as const) {
      add(`strong border on ${bg}`, p.strong, p[bg], 'ui');
      add(`focus ring on ${bg}`, p.focus, p[bg], 'ui');
      add(`accent (selected outline) on ${bg}`, p.accent, p[bg], 'ui');
    }

    // Status chips: label/icon on the chip and on plain grounds.
    const s = statusColors[theme];
    for (const key of Object.keys(s) as StatusKey[]) {
      const c = s[key];
      add(`status.${key} fg on chip`, c.fg, c.bg, 'text');
      if (key === 'urgent') {
        // Solid fill: the shape itself must stand out from the page.
        add('status.urgent fill on canvas', c.bg, p.canvas, 'ui');
        add('status.urgent fill on surface', c.bg, p.surface, 'ui');
      } else {
        add(`status.${key} fg on surface`, c.fg, p.surface, 'text');
        add(`status.${key} fg on canvas`, c.fg, p.canvas, 'text');
      }
    }
  }
  return out;
}

export function auditContrast(pairs: ContrastPair[]): ContrastResult[] {
  return pairs.map((pair) => {
    const ratio = contrastRatio(pair.fg, pair.bg, pair.backdrop);
    return { ...pair, ratio, pass: ratio + 1e-9 >= pair.min };
  });
}

export function formatContrastReport(results: ContrastResult[]): string {
  const rows = results.map((r) =>
    `${r.pass ? 'PASS' : 'FAIL'}  ${r.ratio.toFixed(2).padStart(5)}:1  (min ${r.min})  ${r.theme.padEnd(5)}  ${r.name}  ${r.fg} / ${r.bg}`,
  );
  const failed = results.filter((r) => !r.pass).length;
  return [...rows, '', `${results.length - failed}/${results.length} pairs pass WCAG AA.`].join('\n');
}
