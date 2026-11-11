/**
 * Timezone helpers without dependencies. Schedules are stored as local
 * wall-clock times ("08:00") in the household's IANA timezone.
 */

/** Offset (ms) of `timeZone` from UTC at instant `at`. */
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Local calendar date (y, m, d) and weekday (0=Sun) of `at` in `timeZone`. */
export function localDate(at: Date, timeZone: string) {
  const shifted = new Date(at.getTime() + tzOffsetMs(at, timeZone));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/** UTC instant of local wall-clock `hh:mm` on local date (y, m, d) in `timeZone`. */
export function zonedInstant(
  d: { year: number; month: number; day: number },
  timeOfDay: string,
  timeZone: string,
): Date {
  const [h, m] = timeOfDay.split(':').map(Number);
  const guess = Date.UTC(d.year, d.month - 1, d.day, h, m);
  const first = guess - tzOffsetMs(new Date(guess), timeZone);
  // second pass corrects for offset changes (DST) between guess and result
  return new Date(guess - tzOffsetMs(new Date(first), timeZone));
}

/** Adds n days to a local date. */
export function addDays(d: { year: number; month: number; day: number }, n: number) {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), weekday: t.getUTCDay() };
}
