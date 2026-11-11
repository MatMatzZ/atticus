/**
 * Offline outbox state machine. A queued write is shown immediately,
 * flushed later, and never forced: a dose that comes back as a possible
 * duplicate waits for a person to review it.
 */
export type OutboxStatus = 'pending' | 'needs_review' | 'synced' | 'failed';

export interface DoseConflict {
  id: string;
  given_at: string;
  amount: number | null;
  logged_by: string;
  logged_by_name: string | null;
}

export type DoseRpcResult =
  | { status: 'logged' | 'already_logged' }
  | { status: 'needs_confirmation'; conflict: DoseConflict };

export type FlushOutcome =
  | { status: 'synced' }
  | { status: 'needs_review'; conflict: DoseConflict }
  | { status: 'pending'; retry: true }   // network / transient: keep queued
  | { status: 'failed'; message: string }; // server rejected: keep for the user to see

/** Maps a log_dose reply (or transport error) to the next outbox state. */
export function interpretDoseResult(
  data: DoseRpcResult | null,
  error: { message: string; code?: string; status?: number } | null,
): FlushOutcome {
  if (error) {
    const transient = !error.code && !error.status ? true : (error.status ?? 0) >= 500 || error.status === 0;
    return transient ? { status: 'pending', retry: true } : { status: 'failed', message: error.message };
  }
  if (!data) return { status: 'pending', retry: true };
  if (data.status === 'needs_confirmation') return { status: 'needs_review', conflict: data.conflict };
  return { status: 'synced' };
}

export function nextRetryDelayMs(attempt: number): number {
  return Math.min(5 * 60_000, 2_000 * 2 ** Math.max(0, attempt));
}
