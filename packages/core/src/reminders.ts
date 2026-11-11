import { formatAmount } from './fractions';
import { addDays, localDate, zonedInstant } from './time';
import type { MealScheduleInput, MedScheduleInput } from './nextUp';

/**
 * Local-notification plan for the next N hours. Pure: the app diffs this
 * against what is scheduled. Text only restates what the household entered.
 */
export interface PlannedReminder {
  id: string;        // deterministic: kind:refId:ISO
  at: Date;
  title: string;
  body: string;
}

export function planReminders(
  meds: MedScheduleInput[],
  meals: MealScheduleInput[],
  opts: { timeZone: string; now: Date; petName: string; hours?: number; maxCount?: number },
): PlannedReminder[] {
  const { timeZone, now, petName } = opts;
  const end = now.getTime() + (opts.hours ?? 48) * 3_600_000;
  const today = localDate(now, timeZone);
  const out: PlannedReminder[] = [];

  for (const d of [addDays(today, -1), today, addDays(today, 1), addDays(today, 2)]) {
    for (const m of meds) {
      if (!m.daysOfWeek.includes(d.weekday)) continue;
      const at = zonedInstant(d, m.timeOfDay, timeZone);
      out.push({
        id: `med:${m.scheduleId}:${at.toISOString()}`,
        at,
        title: `${petName}: ${m.medicationName}`,
        body: `${formatAmount(m.doseAmount)} ${m.unit}${m.withFood ? ' with food' : ''}`,
      });
    }
    for (const meal of meals) {
      if (meal.daysOfWeek && !meal.daysOfWeek.includes(d.weekday)) continue;
      const at = zonedInstant(d, meal.timeOfDay, timeZone);
      out.push({
        id: `meal:${meal.scheduleId}:${at.toISOString()}`,
        at,
        title: `${petName}: meal time`,
        body: [meal.food, meal.amountText].filter(Boolean).join(' — ') || 'Meal',
      });
    }
  }

  return out
    .filter((r) => r.at.getTime() > now.getTime() && r.at.getTime() <= end)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, opts.maxCount ?? 60); // iOS keeps at most 64 pending
}
