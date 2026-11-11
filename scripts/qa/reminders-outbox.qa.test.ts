// QA: executable checks for reminder planning + offline outbox classification (M-8 / QA-3).
//   npx vitest run --root . scripts/qa/reminders-outbox.qa.test.ts
// Failing tests here are FILED BUGS (see docs/qa/bugs.md); they assert the requirement, not current behaviour.
import { describe, expect, it } from 'vitest';
import { planReminders, interpretDoseResult } from '../../packages/core/src/index';

const med = (o: Record<string, unknown> = {}) => ({
  scheduleId: 's1', medicationId: 'm1', medicationName: 'Pimobendan', doseAmount: 1.75, unit: 'tablet',
  withFood: false, timeOfDay: '08:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], ...o,
});
const plan = (meds: any[], tz: string, now: string, extra: Record<string, unknown> = {}) =>
  planReminders(meds, [], { timeZone: tz, now: new Date(now), petName: 'Bantay', hours: 48, ...extra } as any);

describe('OFFLINE: transient server errors must stay queued, not be dropped as permanent failures', () => {
  const transient: [string, string][] = [
    ['PGRST301', 'JWT expired (phone was offline for hours; token refresh in flight)'],
    ['57014', 'statement timeout'], ['40P01', 'deadlock detected'], ['40001', 'serialization failure'],
    ['08006', 'connection failure'], ['PGRST002', 'schema cache not ready (PostgREST restarting)'], ['PGRST000', 'could not connect to DB'],
  ];
  for (const [code, why] of transient)
    it(`code ${code} (${why}) => pending/retry`, () => {
      expect(interpretDoseResult(null, { message: why, code }).status).toBe('pending');
    });
  it('HTTP 503 without code => pending', () => expect(interpretDoseResult(null, { message: 'Service Unavailable', status: 503 }).status).toBe('pending'));
  it('network failure => pending', () => expect(interpretDoseResult(null, { message: 'Network request failed' }).status).toBe('pending'));
  for (const code of ['42501', '23514', 'P0002', 'P0001'])
    it(`code ${code} (permanent) => failed, visible to the user`, () => expect(interpretDoseResult(null, { message: 'x', code }).status).toBe('failed'));
  it('needs_confirmation is never auto-forced', () => {
    const conflict = { id: 'c', given_at: '2026-11-12T08:00:00Z', amount: 1, logged_by: 'u', logged_by_name: 'Ana' };
    expect(interpretDoseResult({ status: 'needs_confirmation', conflict }, null).status).toBe('needs_review');
  });
});

describe('REMINDERS: timezone', () => {
  it('device timezone changes do not move reminders (household tz is the clock)', () => {
    const results = ['Pacific/Auckland', 'America/Los_Angeles', 'Asia/Manila'].map((deviceTz) => {
      const prev = process.env.TZ; process.env.TZ = deviceTz;
      try { return plan([med()], 'Asia/Manila', '2026-11-12T10:00:00Z').map((r) => r.at.toISOString()); }
      finally { process.env.TZ = prev; }
    });
    expect(results[1]).toEqual(results[0]); expect(results[2]).toEqual(results[0]);
  });
  it('weekday filter uses household-local weekday (Mon 07:00 Manila = Sun 23:00 UTC)', () => {
    const r = plan([med({ timeOfDay: '07:00', daysOfWeek: [1] })], 'Asia/Manila', '2026-11-15T12:00:00Z');
    expect(r.map((x) => x.at.toISOString())).toEqual(['2026-11-15T23:00:00.000Z']);
  });
  it('08:00 stays 08:00 local across US spring-forward (UTC shifts 1h)', () => {
    const r = plan([med()], 'America/New_York', '2027-03-13T00:00:00Z'); // Mar 14 2027 = DST start
    const iso = r.map((x) => x.at.toISOString());
    expect(iso).toContain('2027-03-13T13:00:00.000Z'); // 08:00 EST
    expect(iso).toContain('2027-03-14T12:00:00.000Z'); // 08:00 EDT
  });
  it('nonexistent local time (02:30 on spring-forward day) yields exactly one reminder that day', () => {
    const r = plan([med({ timeOfDay: '02:30' })], 'America/New_York', '2027-03-13T12:00:00Z');
    const day = r.filter((x) => x.at.toISOString().startsWith('2027-03-14'));
    expect(day).toHaveLength(1);
  });
  it('ambiguous local time (01:30 on fall-back day) yields exactly one reminder that day', () => {
    const r = plan([med({ timeOfDay: '01:30' })], 'America/New_York', '2027-11-06T12:00:00Z');
    expect(r.filter((x) => x.at.toISOString().startsWith('2027-11-07'))).toHaveLength(1);
  });
});

describe('REMINDERS: dose already handled by another caregiver', () => {
  it('a dose logged at 07:55 by someone else must not still alert at 08:00 on this phone', () => {
    const handled = [{ kind: 'med', refId: 'm1', scheduledFor: '2026-11-13T00:00:00.000Z' }]; // 08:00 Manila
    const r = plan([med()], 'Asia/Manila', '2026-11-12T23:00:00Z', { handled });
    expect(r.find((x) => x.at.toISOString() === '2026-11-13T00:00:00.000Z')).toBeUndefined();
  });
});

describe('REMINDERS: 48 h horizon', () => {
  it('plan never extends beyond 48 h (app must be opened/refreshed at least every 2 days -> needs background top-up)', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    const r = planReminders([med()], [], { timeZone: 'Asia/Manila', now, petName: 'B' });
    expect(Math.max(...r.map((x) => +x.at)) - +now).toBeLessThanOrEqual(48 * 3_600_000);
  });
  it('ids unique even when two meds share the same time', () => {
    const r = plan([med(), med({ scheduleId: 's2', medicationId: 'm2', medicationName: 'Furosemide' })], 'Asia/Manila', '2026-11-12T10:00:00Z');
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
  });
  it('notification text only restates the entered schedule (no advice words)', () => {
    const r = plan([med({ withFood: true })], 'Asia/Manila', '2026-11-12T10:00:00Z');
    for (const x of r) expect(`${x.title} ${x.body}`).not.toMatch(/\b(should|recommend|safe|normal|diagnos|increase|decrease)\b/i);
  });
});
