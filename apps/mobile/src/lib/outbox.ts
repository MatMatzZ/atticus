import * as SQLite from 'expo-sqlite';
import { AppState } from 'react-native';
import { rpc, type DoseOutcome } from '@atticus/db';
import { interpretDoseResult, type DoseConflict, type DoseRpcResult, type OutboxStatus } from '@atticus/core';
import { supabase } from './supabase';

export interface DosePayload {
  petId: string; medicationId: string; outcome: DoseOutcome; givenAt: string;
  scheduledFor: string | null; amount: number | null; note: string | null; force: boolean;
  loggedByName?: string;
}
export interface FeedingPayload {
  petId: string; loggedBy: string; portion: number; loggedAt: string;
  scheduledFor: string | null; mealScheduleId: string | null; food: string | null;
}
export interface ObservationPayload {
  petId: string; loggedBy: string; kind: string; observedAt: string; isUrgent: boolean;
  valueNum: number | null; valueText: string | null; scaleValue: number | null; unit: string | null; note: string | null;
}
export type OutboxEntry =
  | { id: string; kind: 'dose'; payload: DosePayload; status: OutboxStatus; conflict: DoseConflict | null; error: string | null; createdAt: string }
  | { id: string; kind: 'feeding'; payload: FeedingPayload; status: OutboxStatus; conflict: null; error: string | null; createdAt: string }
  | { id: string; kind: 'observation'; payload: ObservationPayload; status: OutboxStatus; conflict: null; error: string | null; createdAt: string };

let dbp: Promise<SQLite.SQLiteDatabase> | null = null;
function db() {
  dbp ??= SQLite.openDatabaseAsync('atticus-outbox.db').then(async (d) => {
    await d.execAsync(`CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      conflict TEXT, error TEXT, created_at TEXT NOT NULL);`);
    return d;
  });
  return dbp;
}

let snapshot: OutboxEntry[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const outboxStore = {
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  getSnapshot: () => snapshot,
};

type Row = { id: string; kind: OutboxEntry['kind']; payload: string; status: OutboxStatus; conflict: string | null; error: string | null; created_at: string };

export async function loadOutbox() {
  const rows = await (await db()).getAllAsync<Row>('SELECT * FROM outbox ORDER BY created_at ASC');
  snapshot = rows.map((r) => ({
    id: r.id, kind: r.kind, payload: JSON.parse(r.payload), status: r.status,
    conflict: r.conflict ? JSON.parse(r.conflict) : null, error: r.error, createdAt: r.created_at,
  })) as OutboxEntry[];
  emit();
}

/** Writes locally first (shown immediately), then tries to sync in the background. */
export async function enqueue(entry: { id: string; kind: OutboxEntry['kind']; payload: DosePayload | FeedingPayload | ObservationPayload }) {
  await (await db()).runAsync(
    'INSERT OR IGNORE INTO outbox (id, kind, payload, status, created_at) VALUES (?, ?, ?, ?, ?)',
    entry.id, entry.kind, JSON.stringify(entry.payload), 'pending', new Date().toISOString(),
  );
  await loadOutbox();
  void flushOutbox();
}

/** Review decision for a dose the server flagged as a possible duplicate. */
export async function resolveReview(id: string, giveAnyway: boolean) {
  const d = await db();
  if (!giveAnyway) {
    await d.runAsync('DELETE FROM outbox WHERE id = ?', id);
  } else {
    const row = await d.getFirstAsync<{ payload: string }>('SELECT payload FROM outbox WHERE id = ?', id);
    if (row) {
      const p = { ...JSON.parse(row.payload), force: true };
      await d.runAsync("UPDATE outbox SET payload = ?, status = 'pending', conflict = NULL WHERE id = ?", JSON.stringify(p), id);
    }
  }
  await loadOutbox();
  void flushOutbox();
}

export async function dismissFailed(id: string) {
  await (await db()).runAsync('DELETE FROM outbox WHERE id = ?', id);
  await loadOutbox();
}

/** Synced rows are only kept briefly for the UI; drop old ones. */
async function prune() {
  await (await db()).runAsync("DELETE FROM outbox WHERE status = 'synced' AND created_at < ?", new Date(Date.now() - 36e5).toISOString());
}

let flushing = false;
export const syncEvents = { onSynced: new Set<() => void>() };

export async function flushOutbox() {
  if (flushing) return;
  flushing = true;
  try {
    const d = await db();
    const rows = await d.getAllAsync<Row>("SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC");
    let synced = false;
    for (const r of rows) {
      const outcome = await send(r);
      if (outcome.status === 'pending') { await d.runAsync('UPDATE outbox SET attempts = attempts + 1 WHERE id = ?', r.id); break; } // offline: stop, retry later
      await d.runAsync('UPDATE outbox SET status = ?, conflict = ?, error = ? WHERE id = ?',
        outcome.status, outcome.status === 'needs_review' ? JSON.stringify(outcome.conflict) : null,
        outcome.status === 'failed' ? outcome.message : null, r.id);
      if (outcome.status === 'synced') synced = true;
    }
    await prune();
    await loadOutbox();
    if (synced) syncEvents.onSynced.forEach((f) => f());
  } finally { flushing = false; }
}

type Sent = ReturnType<typeof interpretDoseResult>;
async function send(r: Row): Promise<Sent> {
  try {
    if (r.kind === 'dose') {
      const p: DosePayload = JSON.parse(r.payload);
      const { data, error } = await rpc.logDose(supabase, {
        id: r.id, medicationId: p.medicationId, outcome: p.outcome, givenAt: p.givenAt,
        scheduledFor: p.scheduledFor, amount: p.amount, note: p.note, force: p.force,
      });
      return interpretDoseResult(data as DoseRpcResult | null, error ? { message: error.message, code: error.code } : null);
    }
    if (r.kind === 'feeding') {
      const p: FeedingPayload = JSON.parse(r.payload);
      const { error } = await supabase.from('feeding_events').upsert({
        id: r.id, pet_id: p.petId, logged_by: p.loggedBy, portion_eaten: p.portion, logged_at: p.loggedAt,
        scheduled_for: p.scheduledFor, meal_schedule_id: p.mealScheduleId, food: p.food,
      }, { onConflict: 'id', ignoreDuplicates: true });
      return fromPlain(error);
    }
    const p: ObservationPayload = JSON.parse(r.payload);
    const { error } = await supabase.from('observation_events').upsert({
      id: r.id, pet_id: p.petId, logged_by: p.loggedBy, kind: p.kind, observed_at: p.observedAt, is_urgent: p.isUrgent,
      value_num: p.valueNum, value_text: p.valueText, scale_value: p.scaleValue, unit: p.unit, note: p.note,
    }, { onConflict: 'id', ignoreDuplicates: true });
    return fromPlain(error);
  } catch {
    return { status: 'pending', retry: true }; // thrown fetch error = offline
  }
}

function fromPlain(error: { message: string; code?: string } | null): Sent {
  if (!error) return { status: 'synced' };
  // PostgREST errors carry a code (RLS, constraint); transport failures do not.
  return error.code ? { status: 'failed', message: error.message } : { status: 'pending', retry: true };
}

let started = false;
export function startOutboxSync() {
  if (started) return;
  started = true;
  void loadOutbox().then(flushOutbox);
  AppState.addEventListener('change', (s) => { if (s === 'active') void flushOutbox(); });
  setInterval(() => void flushOutbox(), 15_000);
}
