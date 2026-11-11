import { describe, expect, it } from 'vitest';
import { planReminders, interpretDoseResult, nextRetryDelayMs } from './index';

const med = {
  scheduleId: 's1', medicationId: 'm1', medicationName: 'Pimobendan', doseAmount: 1.75,
  unit: 'tablet', withFood: true, timeOfDay: '08:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
};

describe('planReminders', () => {
  const now = new Date('2026-11-12T10:00:00Z'); // 6:00 PM Manila
  const plan = planReminders([med], [{ scheduleId: 'k1', timeOfDay: '19:00', food: 'Dinner' }], {
    timeZone: 'Asia/Manila', now, petName: 'Bantay',
  });
  it('only covers the next 48 hours, in order, future only', () => {
    expect(plan.length).toBeGreaterThan(0);
    for (const r of plan) {
      expect(r.at.getTime()).toBeGreaterThan(now.getTime());
      expect(r.at.getTime()).toBeLessThanOrEqual(now.getTime() + 48 * 3_600_000);
    }
    expect([...plan].sort((a, b) => +a.at - +b.at)).toEqual(plan);
  });
  it('shows exact fractions', () => {
    expect(plan.find((r) => r.id.startsWith('med:'))!.body).toBe('1 3/4 tablet with food');
  });
  it('ids are deterministic and unique', () => {
    expect(new Set(plan.map((r) => r.id)).size).toBe(plan.length);
  });
  it('caps the count', () => {
    expect(planReminders([med], [], { timeZone: 'UTC', now, petName: 'B', maxCount: 1 })).toHaveLength(1);
  });
});

describe('interpretDoseResult', () => {
  it('never forces a duplicate', () => {
    const conflict = { id: 'x', given_at: 't', amount: 1, logged_by: 'u', logged_by_name: 'Ben' };
    expect(interpretDoseResult({ status: 'needs_confirmation', conflict }, null)).toEqual({ status: 'needs_review', conflict });
  });
  it('treats logged and already_logged as synced', () => {
    expect(interpretDoseResult({ status: 'already_logged' }, null).status).toBe('synced');
    expect(interpretDoseResult({ status: 'logged' }, null).status).toBe('synced');
  });
  it('keeps queued on network error, fails on server rejection', () => {
    expect(interpretDoseResult(null, { message: 'Network request failed' }).status).toBe('pending');
    expect(interpretDoseResult(null, { message: 'denied', code: '42501', status: 403 }).status).toBe('failed');
  });
  it('backs off with a cap', () => {
    expect(nextRetryDelayMs(0)).toBe(2000);
    expect(nextRetryDelayMs(20)).toBe(300000);
  });
});
