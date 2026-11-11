import { describe, expect, it } from 'vitest';
import {
  breathsPerMinute, buildNextUp, crossedThresholds, daysOfSupply, findRecentDose,
  formatAmount, needsRefill, parseAmount, zonedInstant,
} from './index';

const TZ = 'Asia/Manila';
// 2026-11-12 07:45 Manila = 2026-11-11T23:45Z
const NOW = new Date('2026-11-11T23:45:00Z');

describe('fractions', () => {
  it('parses prescribed amounts', () => {
    expect(parseAmount('1 3/4')).toBe(1.75);
    expect(parseAmount('3/4')).toBe(0.75);
    expect(parseAmount('1/8')).toBe(0.125);
    expect(parseAmount('2')).toBe(2);
    expect(parseAmount('0.5')).toBe(0.5);
    expect(parseAmount('5/4')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1/0')).toBeNull();
  });
  it('formats as fractions', () => {
    expect(formatAmount(1.75)).toBe('1 3/4');
    expect(formatAmount(0.5)).toBe('1/2');
    expect(formatAmount(2.25)).toBe('2 1/4');
    expect(formatAmount(0.375)).toBe('3/8');
    expect(formatAmount(3)).toBe('3');
    expect(formatAmount(0.3)).toBe('0.3');
  });
  it('round-trips', () => {
    for (const s of ['1 3/4', '1/2', '2 1/8', '4']) expect(formatAmount(parseAmount(s)!)).toBe(s);
  });
});

describe('time', () => {
  it('converts Manila wall clock to UTC', () => {
    expect(zonedInstant({ year: 2026, month: 11, day: 12 }, '08:00', TZ).toISOString())
      .toBe('2026-11-12T00:00:00.000Z');
  });
  it('handles DST zones', () => {
    // New York, 2026-03-08 is DST start; 08:00 local = 12:00Z
    expect(zonedInstant({ year: 2026, month: 3, day: 8 }, '08:00', 'America/New_York').toISOString())
      .toBe('2026-03-08T12:00:00.000Z');
  });
});

describe('buildNextUp', () => {
  const meds = [{
    scheduleId: 's1', medicationId: 'pimo', medicationName: 'Pimobendan',
    doseAmount: 1.75, unit: 'tablet', withFood: true, timeOfDay: '08:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  }, {
    scheduleId: 's2', medicationId: 'furo', medicationName: 'Furosemide',
    doseAmount: 0.5, unit: 'tablet', withFood: false, timeOfDay: '14:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  }];
  const meals = [{ scheduleId: 'breakfast', timeOfDay: '08:00', food: 'Cardiac diet', amountText: '1/2 can' }];

  it('puts a with-food med and its meal on one card with a countdown', () => {
    const [first] = buildNextUp(meds, meals, [], { timeZone: TZ, now: NOW });
    expect(first.items.map((i) => i.refId).sort()).toEqual(['breakfast', 'pimo']);
    expect(first.items.find((i) => i.refId === 'pimo')!.label).toBe('Pimobendan — 1 3/4 tablet');
    expect(first.countdownLabel).toBe('DUE IN 15 MIN');
    expect(first.status).toBe('due_soon');
  });

  it('skips handled occurrences and shows overdue', () => {
    const later = new Date('2026-11-12T00:20:00Z'); // 08:20 Manila
    const handled = [{ kind: 'meal' as const, refId: 'breakfast', scheduledFor: '2026-11-12T00:00:00.000Z' }];
    const [first] = buildNextUp(meds, meals, handled, { timeZone: TZ, now: later });
    expect(first.items.map((i) => i.refId)).toEqual(['pimo']);
    expect(first.countdownLabel).toBe('OVERDUE 20 MIN');
  });

  it('shows clock time for far-off items', () => {
    const handled = [
      { kind: 'meal' as const, refId: 'breakfast', scheduledFor: '2026-11-12T00:00:00.000Z' },
      { kind: 'med' as const, refId: 'pimo', scheduledFor: '2026-11-12T00:00:00.000Z' },
    ];
    const [first] = buildNextUp(meds, meals, handled, { timeZone: TZ, now: NOW });
    expect(first.items[0].refId).toBe('furo');
    expect(first.countdownLabel).toBe('DUE AT 2:00 PM');
  });

  it('respects days of week', () => {
    const weekendOnly = [{ ...meds[1], daysOfWeek: [0, 6], medicationId: 'wk' }];
    // 2026-11-12 is a Thursday → next is Saturday, outside the 3-day horizon from Thu
    expect(buildNextUp(weekendOnly, [], [], { timeZone: TZ, now: NOW })).toHaveLength(0);
  });
});

describe('care helpers', () => {
  const events = [
    { id: 'a', medicationId: 'pimo', givenAt: '2026-11-12T00:02:00Z', outcome: 'given' as const, loggedByName: 'Ana' },
    { id: 'b', medicationId: 'pimo', givenAt: '2026-11-12T00:03:00Z', outcome: 'refused' as const },
    { id: 'c', medicationId: 'pimo', givenAt: '2026-11-12T00:04:00Z', outcome: 'given' as const, voidedAt: 'x' },
  ];
  it('flags a recent given dose, ignoring refused and voided', () => {
    expect(findRecentDose(events, 'pimo', new Date('2026-11-12T00:10:00Z'), 60)?.id).toBe('a');
    expect(findRecentDose(events, 'pimo', new Date('2026-11-12T02:00:00Z'), 60)).toBeNull();
    expect(findRecentDose(events, 'other', new Date('2026-11-12T00:10:00Z'), 60)).toBeNull();
  });
  it('computes supply and refill', () => {
    expect(daysOfSupply(10, 1.75, 2)).toBe(2);
    expect(daysOfSupply(7, 0.5, 2)).toBe(7);
    expect(daysOfSupply(null, 1, 1)).toBeNull();
    expect(needsRefill(8.25, 9)).toBe(true);
    expect(needsRefill(20, 9)).toBe(false);
    expect(needsRefill(5, null)).toBe(false);
  });
  it('compares only against user-entered thresholds', () => {
    const t = [{ metric: 'rrr', comparator: '>' as const, value: 30, unit: 'breaths/min', vetInstruction: 'Call us' }];
    expect(crossedThresholds('rrr', 34, t)).toHaveLength(1);
    expect(crossedThresholds('rrr', 30, t)).toHaveLength(0);
    expect(crossedThresholds('rrr', 50, [])).toHaveLength(0);
  });
  it('counts breaths over a 30s window', () => {
    const start = 0;
    const taps = Array.from({ length: 12 }, (_, i) => i * 2400); // 12 taps in ~26s
    expect(breathsPerMinute([...taps, 45_000], 30, start)).toBe(24);
  });
});
