/**
 * Serialises the tokens as CSS custom properties for apps/web.
 * Only `import type` from tokens.ts (see contrast.ts for why).
 *
 * Theme switching:
 *   - follows `prefers-color-scheme` by default;
 *   - `<html data-theme="light">` or `data-theme="night"` forces one.
 */
import type { Palette, StatusKey, Tokens } from './tokens';

const kebab = (s: string) => s.replace(/_/g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function svgDataUri(path: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='${path}'/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}")`;
}

function themeVars(t: Tokens, theme: keyof Tokens['palettes']): string[] {
  const p: Palette = t.palettes[theme];
  const lines = (Object.keys(p) as (keyof Palette)[]).map((k) => `  --at-${kebab(k)}: ${p[k]};`);
  for (const key of Object.keys(t.statusColors[theme]) as StatusKey[]) {
    const c = t.statusColors[theme][key];
    lines.push(`  --at-status-${kebab(key)}-fg: ${c.fg};`);
    lines.push(`  --at-status-${kebab(key)}-bg: ${c.bg};`);
    lines.push(`  --at-status-${kebab(key)}-edge: ${c.edge};`);
  }
  return lines;
}

function staticVars(t: Tokens): string[] {
  const lines: string[] = [];
  lines.push(`  --at-font-sans: ${t.fontFamily.web};`);
  lines.push(`  --at-font-mono: ${t.fontFamily.mono};`);
  for (const [k, v] of Object.entries(t.typeScale)) {
    lines.push(`  --at-text-${kebab(k)}-size: ${v.size}px;`);
    lines.push(`  --at-text-${kebab(k)}-line: ${v.lineHeight}px;`);
    lines.push(`  --at-text-${kebab(k)}-weight: ${v.weight};`);
  }
  for (const [k, v] of Object.entries(t.space)) lines.push(`  --at-space-${kebab(k)}: ${v}px;`);
  for (const [k, v] of Object.entries(t.radius)) lines.push(`  --at-radius-${kebab(k)}: ${v}px;`);
  for (const [k, v] of Object.entries(t.tap)) lines.push(`  --at-tap-${kebab(k)}: ${v}px;`);
  for (const [k, v] of Object.entries(t.stroke)) lines.push(`  --at-stroke-${kebab(k)}: ${v}px;`);
  for (const key of Object.keys(t.statusMeta) as StatusKey[]) {
    const m = t.statusMeta[key];
    lines.push(`  --at-status-${kebab(key)}-label: "${m.label}";`);
    lines.push(`  --at-status-${kebab(key)}-icon: ${svgDataUri(m.iconPath)};`);
  }
  return lines;
}

export function toCssVariables(t: Tokens): string {
  const light = themeVars(t, 'light').join('\n');
  const night = themeVars(t, 'night').join('\n');
  return [
    '/* GENERATED from packages/core/src/design/tokens.ts — do not edit by hand.',
    '   Regenerate: npm run tokens:css --workspace @atticus/core */',
    '',
    ':root {',
    '  color-scheme: light dark;',
    ...staticVars(t),
    '}',
    '',
    ':root,',
    '[data-theme="light"] {',
    light,
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root:not([data-theme="light"]) {',
    night.replace(/^ {2}/gm, '    '),
    '  }',
    '}',
    '',
    '[data-theme="night"] {',
    night,
    '}',
    '',
  ].join('\n');
}
