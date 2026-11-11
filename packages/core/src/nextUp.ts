import { addDays, localDate, zonedInstant } from './time';
import { formatAmount } from './fractions';

/**
 * "Here is what [Pet] needs next." — builds the Next Up card(s).
 * Pure function: same input → same output, so web, mobile and tests agree.
 */

export interface MedScheduleInput {
  scheduleId: string;
  medicationId: string;
  medicationName: string;
  doseAmount: number;          // current medication_version.dose_amount
  unit: string;                // "tablet"
  withFood: boolean;
  timeOfDay: string;           // "08:00"
  daysOfWeek: number[];        // 0=Sun..6=Sat
}

export interface MealScheduleInput {
  scheduleId: string;
  timeOfDay: string;
  food?: string | null;
  amountText?: string | null;
  daysOfWeek?: number[];
}

/** An occurrence that was already handled (dose or meal logged against it). */
export interface HandledOccurrence {
  kind: 'med' | 'meal';
  refId: string;               // medicationId or meal scheduleId
  scheduledFor: string;        // ISO
}

export interface NextUpItem {
  kind: 'med' | 'meal';
  refId: string;
  scheduledFor: Date;
  label: string;               // "Pimobendan — 1 3/4 tablet"
}

export interface NextUpCard {
  scheduledFor: Date;
  items: NextUpItem[];         // med + meal together when "with food"
  minutesUntil: number;        // negative = overdue
  status: 'upcoming' | 'due_soon' | 'overdue';
  countdownLabel: string;      // "DUE IN 15 MIN" | "OVERDUE 10 MIN" | "DUE AT 8:00 PM"
}

export interface NextUpOptions {
  timeZone: string;
  now: Date;
  /** Look-back for overdue items not yet handled. Default 6h. */
  overdueWindowMinutes?: number;
  /** A "with food" med pairs with a meal within this window. Default 45. */
  pairWindowMinutes?: number;
  /** "due_soon" threshold. Default 60. */
  dueSoonMinutes?: number;
}

export function buildNextUp(
  meds: MedScheduleInput[],
  meals: MealScheduleInput[],
  handled: HandledOccurrence[],
  opts: NextUpOptions,
): NextUpCard[] {
  const { timeZone, now } = opts;
  const overdueMs = (opts.overdueWindowMinutes ?? 360) * 60_000;
  const pairMs = (opts.pairWindowMinutes ?? 45) * 60_000;
  const dueSoon = opts.dueSoonMinutes ?? 60;

  const done = new Set(handled.map((h) => key(h.kind, h.refId, new Date(h.scheduledFor))));
  const today = localDate(now, timeZone);
  const days = [addDays(today, -1), today, addDays(today, 1)];

  const occurrences: (NextUpItem & { withFood?: boolean })[] = [];

  for (const d of days) {
    for (const m of meds) {
      if (!m.daysOfWeek.includes(d.weekday)) continue;
      const at = zonedInstant(d, m.timeOfDay, timeZone);
      occurrences.push({
        kind: 'med', refId: m.medicationId, scheduledFor: at, withFood: m.withFood,
        label: `${m.medicationName} — ${formatAmount(m.doseAmount)} ${m.unit}`,
      });
    }
    for (const meal of meals) {
      if (meal.daysOfWeek && !meal.daysOfWeek.includes(d.weekday)) continue;
      const at = zonedInstant(d, meal.timeOfDay, timeZone);
      occurrences.push({
        kind: 'meal', refId: meal.scheduleId, scheduledFor: at,
        label: [meal.food ?? 'Meal', meal.amountText].filter(Boolean).join(' — '),
      });
    }
  }

  const pending = occurrences
    .filter((o) => !done.has(key(o.kind, o.refId, o.scheduledFor)))
    .filter((o) => o.scheduledFor.getTime() >= now.getTime() - overdueMs)
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

  // Group: same time → one card; a "with food" med also pulls in the nearest meal.
  const cards: NextUpCard[] = [];
  const used = new Set<NextUpItem>();

  for (const o of pending) {
    if (used.has(o)) continue;
    const group: NextUpItem[] = [o];
    used.add(o);

    for (const other of pending) {
      if (used.has(other)) continue;
      const sameTime = other.scheduledFor.getTime() === o.scheduledFor.getTime();
      const foodPair =
        Math.abs(other.scheduledFor.getTime() - o.scheduledFor.getTime()) <= pairMs &&
        ((o.kind === 'med' && o.withFood && other.kind === 'meal') ||
         (o.kind === 'meal' && other.kind === 'med' && (other as { withFood?: boolean }).withFood));
      if (sameTime || foodPair) {
        group.push(other);
        used.add(other);
      }
    }

    const at = group[0].scheduledFor;
    const minutesUntil = Math.round((at.getTime() - now.getTime()) / 60_000);
    cards.push({
      scheduledFor: at,
      items: group.map(({ kind, refId, scheduledFor, label }) => ({ kind, refId, scheduledFor, label })),
      minutesUntil,
      status: minutesUntil < 0 ? 'overdue' : minutesUntil <= dueSoon ? 'due_soon' : 'upcoming',
      countdownLabel: countdown(minutesUntil, at, timeZone),
    });
  }

  return cards;
}

function key(kind: string, refId: string, at: Date) {
  return `${kind}:${refId}:${at.toISOString()}`;
}

function countdown(min: number, at: Date, timeZone: string): string {
  if (min < 0) return `OVERDUE ${humanize(-min)}`;
  if (min === 0) return 'DUE NOW';
  if (min <= 120) return `DUE IN ${humanize(min)}`;
  const t = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(at);
  return `DUE AT ${t}`;
}

function humanize(min: number): string {
  if (min < 60) return `${min} MIN`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} HR ${m} MIN` : `${h} HR`;
}
