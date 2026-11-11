import { describe, expect, it } from 'vitest';
import { buildLineChart, canWrite } from './index';

describe('canWrite', () => {
  it('blocks vets and missing roles', () => {
    expect(canWrite('vet')).toBe(false);
    expect(canWrite(null)).toBe(false);
    expect(canWrite('owner')).toBe(true);
    expect(canWrite('caregiver')).toBe(true);
  });
});

describe('buildLineChart', () => {
  const base = { width: 100, height: 50, pad: { top: 0, right: 0, bottom: 0, left: 0 } };
  it('returns null with no data', () => {
    expect(buildLineChart({ ...base, points: [], thresholds: [30] })).toBeNull();
  });
  it('draws no threshold line when the user has none', () => {
    const m = buildLineChart({ ...base, points: [{ t: 1, v: 20 }, { t: 2, v: 25 }], thresholds: [] })!;
    expect(m.thresholdLines).toHaveLength(0);
  });
  it('includes the user threshold in the Y range', () => {
    const m = buildLineChart({ ...base, points: [{ t: 1, v: 20 }, { t: 2, v: 25 }], thresholds: [40] })!;
    expect(m.yMax).toBeGreaterThan(40);
    expect(m.thresholdLines[0].value).toBe(40);
  });
});
