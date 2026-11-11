import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  auditContrast, contrastPairs, contrastRatio, formatContrastReport, MIN_BODY_SIZE,
  palettes, parseColor, STATUS_KEYS, statusColors, statusMeta, tap, toCssVariables,
  tokens, typeScale, WCAG_AA,
} from '../index';

describe('contrast math', () => {
  it('matches known WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
    // Order of arguments does not matter.
    expect(contrastRatio('#2B6660', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#2B6660'), 10);
  });

  it('parses hex shorthand, 8-digit hex and rgba', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#00000080').a).toBeCloseTo(0.5, 2);
    expect(parseColor('rgba(31, 36, 33, 0.72)')).toEqual({ r: 31, g: 36, b: 33, a: 0.72 });
    expect(() => parseColor('red')).toThrow();
  });

  it('flattens a translucent background over its backdrop', () => {
    // 50% black over white ≈ #808080 → 3.95:1 against white.
    expect(contrastRatio('#FFFFFF', 'rgba(0,0,0,0.5)', '#FFFFFF')).toBeCloseTo(3.95, 1);
  });
});

describe('token contrast (WCAG AA)', () => {
  const results = auditContrast(contrastPairs(palettes, statusColors));

  it('checks both themes and every status', () => {
    for (const theme of ['light', 'night'] as const) {
      for (const key of STATUS_KEYS) {
        expect(results.some((r) => r.theme === theme && r.name.startsWith(`status.${key} `))).toBe(true);
      }
    }
    expect(results.length).toBeGreaterThan(60);
  });

  it('every text pair is ≥ 4.5:1 and every UI pair is ≥ 3:1', () => {
    const failures = results.filter((r) => !r.pass);
    expect(failures, formatContrastReport(failures)).toEqual([]);
    for (const r of results) expect(r.min).toBe(r.kind === 'text' ? WCAG_AA.text : WCAG_AA.ui);
  });
});

describe('status is never colour alone', () => {
  it('each status has a label and a distinct icon', () => {
    const icons = new Set<string>();
    for (const key of STATUS_KEYS) {
      const m = statusMeta[key];
      expect(m.label.trim().length).toBeGreaterThan(0);
      expect(m.iconPath).toMatch(/^M/);
      icons.add(m.iconPath);
    }
    expect(icons.size).toBe(STATUS_KEYS.length);
  });

  it('covers the NextUp statuses from nextUp.ts', () => {
    for (const s of ['upcoming', 'due_soon', 'overdue'] as const) expect(statusMeta[s]).toBeDefined();
  });

  it('pairs light and night colours for every status', () => {
    for (const key of STATUS_KEYS) {
      expect(statusColors.light[key]).toBeDefined();
      expect(statusColors.night[key]).toBeDefined();
    }
  });
});

describe('type, spacing and targets', () => {
  it('body text is at least 18', () => {
    expect(typeScale.body.size).toBeGreaterThanOrEqual(MIN_BODY_SIZE);
    expect(typeScale.bodyL.size).toBeGreaterThanOrEqual(MIN_BODY_SIZE);
    for (const v of Object.values(typeScale)) expect(v.lineHeight).toBeGreaterThanOrEqual(v.size);
  });

  it('touch targets are at least 48', () => {
    expect(tap.min).toBeGreaterThanOrEqual(48);
    expect(tap.primary).toBeGreaterThanOrEqual(tap.min);
    expect(tap.urgent).toBeGreaterThanOrEqual(tap.primary);
    expect(tap.gap).toBeGreaterThanOrEqual(8);
  });

  it('spacing is on a 4/8 grid', () => {
    for (const v of Object.values(tokens.space)) expect(v % 4).toBe(0);
  });
});

describe('CSS variables for apps/web', () => {
  const css = toCssVariables(tokens);

  it('exposes palette, status, type, spacing, radius and tap tokens for both themes', () => {
    for (const name of ['--at-canvas', '--at-ink', '--at-accent', '--at-status-due-soon-fg', '--at-status-urgent-bg',
      '--at-status-overdue-label', '--at-status-overdue-icon', '--at-text-body-size', '--at-space-s2', '--at-radius-card', '--at-tap-min']) {
      expect(css).toContain(`${name}:`);
    }
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain('[data-theme="night"]');
    expect(css).toContain(`--at-canvas: ${palettes.night.canvas};`);
  });

  it('apps/web/src/app/atticus-tokens.css is up to date (run: npm run tokens:css)', () => {
    const file = fileURLToPath(new URL('../../../../apps/web/src/app/atticus-tokens.css', import.meta.url));
    expect(readFileSync(file, 'utf8')).toBe(css);
  });
});
