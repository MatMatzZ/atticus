/**
 * Small, pure care-logic helpers shared by web, mobile and tests.
 * None of these make clinical decisions — they record, count and compare
 * against numbers the user entered from their vet.
 */

// ---------------------------------------------------------------------
// Duplicate-dose guard (client mirror of public.log_dose, for offline use)
// ---------------------------------------------------------------------
export interface DoseEventLite {
  id: string;
  medicationId: string;
  givenAt: string;             // ISO
  outcome: 'given' | 'skipped' | 'refused' | 'vomited_after';
  loggedByName?: string | null;
  voidedAt?: string | null;
}

export function findRecentDose(
  events: DoseEventLite[],
  medicationId: string,
  at: Date,
  windowMinutes: number,
): DoseEventLite | null {
  const windowMs = windowMinutes * 60_000;
  return (
    events
      .filter((e) => e.medicationId === medicationId && !e.voidedAt)
      .filter((e) => e.outcome === 'given' || e.outcome === 'vomited_after')
      .filter((e) => Math.abs(new Date(e.givenAt).getTime() - at.getTime()) < windowMs)
      .sort((a, b) => new Date(b.givenAt).getTime() - new Date(a.givenAt).getTime())[0] ?? null
  );
}

// ---------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------
/** Whole days of supply left. null when unknown. */
export function daysOfSupply(quantityOnHand: number | null, doseAmount: number, dosesPerDay: number): number | null {
  if (quantityOnHand == null || doseAmount <= 0 || dosesPerDay <= 0) return null;
  return Math.floor(quantityOnHand / (doseAmount * dosesPerDay) + 1e-9);
}

export function needsRefill(quantityOnHand: number | null, refillAlertAt: number | null): boolean {
  return quantityOnHand != null && refillAlertAt != null && quantityOnHand <= refillAlertAt;
}

// ---------------------------------------------------------------------
// Vet-entered thresholds
// ---------------------------------------------------------------------
export interface Threshold {
  metric: string;
  comparator: '>' | '>=' | '<' | '<=';
  value: number;
  unit: string;
  vetInstruction?: string | null;
}

/** Returns the user-entered thresholds this reading crosses. */
export function crossedThresholds(metric: string, reading: number, thresholds: Threshold[]): Threshold[] {
  return thresholds.filter((t) => {
    if (t.metric !== metric) return false;
    switch (t.comparator) {
      case '>': return reading > t.value;
      case '>=': return reading >= t.value;
      case '<': return reading < t.value;
      case '<=': return reading <= t.value;
    }
  });
}

// ---------------------------------------------------------------------
// Breathing counter (tap once per breath)
// ---------------------------------------------------------------------
/**
 * breaths/min from tap timestamps (ms) over a fixed counting window.
 * Count-based: breaths counted in `windowSeconds`, scaled to 60s — the
 * same method owners are taught (count for 30s, double it).
 */
export function breathsPerMinute(tapTimesMs: number[], windowSeconds: 30 | 60, startedAtMs: number): number {
  const end = startedAtMs + windowSeconds * 1000;
  const count = tapTimesMs.filter((t) => t >= startedAtMs && t <= end).length;
  return Math.round(count * (60 / windowSeconds));
}

// ---------------------------------------------------------------------
// Seizure timer
// ---------------------------------------------------------------------
export function elapsedSeconds(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}
