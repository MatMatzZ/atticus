import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  buildNextUp, type HandledOccurrence, type MealScheduleInput, type MedScheduleInput, type Threshold,
} from '@atticus/core';
import { supabase } from '@/lib/supabase';
import { outboxStore, startOutboxSync, syncEvents } from '@/lib/outbox';
import { useSession } from './session';

export interface Pet { id: string; name: string; species: string; status: 'active' | 'memorial'; household_id: string }
export interface Med {
  id: string; name: string; unit: string; strength: string | null; withFood: boolean; doseAmount: number;
  quantityOnHand: number | null; refillAlertAt: number | null; duplicateWarningMinutes: number;
  schedules: { id: string; timeOfDay: string; daysOfWeek: number[] }[];
}
export interface Meal { id: string; timeOfDay: string; food: string | null; amountText: string | null }
export interface PresetConfig {
  quick_logs?: { kind: string; label: string; input?: string; options?: string[]; scale?: string; tool?: string; unit?: string }[];
  urgent_logs?: { kind: string; label: string; capture_video?: boolean }[];
}
export interface ActivityItem { id: string; type: string; title: string; detail: string | null; occurredAt: string; voided: boolean; who: string | null }
export interface Contact { id: string; kind: string; name: string; clinic: string | null; phone: string | null }
export interface Member { userId: string; role: string; name: string; expiresAt: string | null }

export interface CareState {
  loading: boolean; error: string | null; fromCache: boolean;
  userId: string; userName: string;
  timeZone: string; pet: Pet | null; meds: Med[]; meals: Meal[];
  preset: PresetConfig; thresholds: Threshold[]; contacts: Contact[]; members: Member[];
  activity: ActivityItem[]; handled: HandledOccurrence[]; doseEvents: { id: string; medicationId: string; scheduledFor: string | null; givenAt: string; outcome: string; voidedAt: string | null; loggedBy: string | null }[];
  names: Record<string, string>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<CareState | null>(null);
const CACHE_KEY = 'atticus.care.v1';

type Snap = Omit<CareState, 'loading' | 'error' | 'fromCache' | 'refresh' | 'userId' | 'userName'>;
const empty: Snap = {
  timeZone: 'Asia/Manila', pet: null, meds: [], meals: [], preset: {}, thresholds: [], contacts: [], members: [],
  activity: [], handled: [], doseEvents: [], names: {},
};

function readCache(uid: string): Snap | null {
  try { const raw = localStorage.getItem(`${CACHE_KEY}.${uid}`); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeCache(uid: string, s: Snap) {
  try { localStorage.setItem(`${CACHE_KEY}.${uid}`, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export function CareProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const uid = session?.user.id ?? '';
  const [snap, setSnap] = useState<Snap>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!uid || busy.current) return;
    busy.current = true;
    try {
      const next = await fetchAll();
      setSnap(next); writeCache(uid, next); setError(null); setFromCache(false);
    } catch (e) {
      const cached = readCache(uid);
      if (cached) { setSnap((s) => (s.pet ? s : cached)); setFromCache(true); }
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally { busy.current = false; setLoading(false); }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const cached = readCache(uid);
    if (cached) { setSnap(cached); setFromCache(true); setLoading(false); }
    startOutboxSync();
    void refresh();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void refresh(); });
    const onSynced = () => void refresh();
    syncEvents.onSynced.add(onSynced);
    const timer = setInterval(() => void refresh(), 60_000);
    return () => { sub.remove(); syncEvents.onSynced.delete(onSynced); clearInterval(timer); };
  }, [uid, refresh]);

  const value = useMemo<CareState>(() => ({
    ...snap, loading, error, fromCache, refresh, userId: uid,
    userName: snap.names[uid] ?? session?.user.email?.split('@')[0] ?? 'you',
  }), [snap, loading, error, fromCache, refresh, uid, session]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCare(): CareState {
  const v = useContext(Ctx);
  if (!v) throw new Error('CareProvider missing');
  return v;
}

export function useOutbox() {
  return useSyncExternalStore(outboxStore.subscribe, outboxStore.getSnapshot);
}

async function fetchAll(): Promise<Snap> {
  const { data: pets, error: pe } = await supabase.from('pets').select('*').order('created_at');
  if (pe) throw pe;
  const pet = (pets ?? []).find((p) => p.status === 'active') ?? pets?.[0] ?? null;
  if (!pet) return { ...empty };

  const since = new Date(Date.now() - 36 * 3_600_000).toISOString();
  const [hh, meds, mealsR, cond, thr, contacts, members, feed, doses, feedings] = await Promise.all([
    supabase.from('households').select('timezone').eq('id', pet.household_id).single(),
    supabase.from('medications').select('*, medication_versions(dose_amount, effective_to), med_schedules(id, time_of_day, days_of_week, active)').eq('pet_id', pet.id).eq('active', true),
    supabase.from('meal_schedules').select('*').eq('pet_id', pet.id).eq('active', true),
    supabase.from('pet_conditions').select('preset_key').eq('pet_id', pet.id),
    supabase.from('pet_thresholds').select('*').eq('pet_id', pet.id),
    supabase.from('vet_contacts').select('*').eq('household_id', pet.household_id),
    supabase.from('household_members').select('user_id, role, expires_at').eq('household_id', pet.household_id),
    supabase.from('activity_feed').select('*').eq('pet_id', pet.id).order('occurred_at', { ascending: false }).limit(30),
    supabase.from('dose_events').select('id, medication_id, scheduled_for, given_at, outcome, voided_at, logged_by').eq('pet_id', pet.id).gte('given_at', since),
    supabase.from('feeding_events').select('meal_schedule_id, scheduled_for, voided_at').eq('pet_id', pet.id).gte('logged_at', since),
  ]);
  for (const r of [hh, meds, mealsR, cond, thr, contacts, members, feed, doses, feedings]) if (r.error) throw r.error;

  const presetKey = cond.data?.[0]?.preset_key;
  let preset: PresetConfig = {};
  if (presetKey) {
    const { data } = await supabase.from('condition_presets').select('config').eq('key', presetKey).single();
    preset = (data?.config as PresetConfig) ?? {};
  }

  const userIds = Array.from(new Set([
    ...(members.data ?? []).map((m) => m.user_id),
    ...(feed.data ?? []).map((f) => f.logged_by).filter((x): x is string => !!x),
    ...(doses.data ?? []).map((d) => d.logged_by).filter((x): x is string => !!x),
  ]));
  const { data: profs } = userIds.length ? await supabase.from('profiles').select('id, display_name').in('id', userIds) : { data: [] };
  const names: Record<string, string> = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name]));

  const medList: Med[] = (meds.data ?? []).map((m) => {
    const cur = (m.medication_versions ?? []).find((v) => v.effective_to == null) ?? m.medication_versions?.[0];
    return {
      id: m.id, name: m.name, unit: m.unit, strength: m.strength, withFood: m.with_food,
      doseAmount: Number(cur?.dose_amount ?? 0), quantityOnHand: m.quantity_on_hand, refillAlertAt: m.refill_alert_at,
      duplicateWarningMinutes: m.duplicate_warning_minutes,
      schedules: (m.med_schedules ?? []).filter((s) => s.active).map((s) => ({ id: s.id, timeOfDay: s.time_of_day.slice(0, 5), daysOfWeek: s.days_of_week })),
    };
  });

  const handled: HandledOccurrence[] = [
    ...(doses.data ?? []).filter((d) => !d.voided_at && d.scheduled_for).map((d) => ({ kind: 'med' as const, refId: d.medication_id, scheduledFor: d.scheduled_for! })),
    ...(feedings.data ?? []).filter((f) => !f.voided_at && f.scheduled_for && f.meal_schedule_id).map((f) => ({ kind: 'meal' as const, refId: f.meal_schedule_id!, scheduledFor: f.scheduled_for! })),
  ];

  return {
    timeZone: hh.data?.timezone ?? 'Asia/Manila',
    pet: pet as Pet,
    meds: medList,
    meals: (mealsR.data ?? []).map((m) => ({ id: m.id, timeOfDay: m.time_of_day.slice(0, 5), food: m.food, amountText: m.amount_text })),
    preset,
    thresholds: (thr.data ?? []).map((t) => ({ metric: t.metric, comparator: t.comparator as Threshold['comparator'], value: Number(t.value), unit: t.unit, vetInstruction: t.vet_instruction })),
    contacts: (contacts.data ?? []).map((c) => ({ id: c.id, kind: c.kind, name: c.name, clinic: c.clinic, phone: c.phone })),
    members: (members.data ?? []).map((m) => ({ userId: m.user_id, role: m.role, name: names[m.user_id] ?? 'Member', expiresAt: m.expires_at })),
    activity: (feed.data ?? []).map((f) => ({ id: f.id ?? '', type: f.type ?? '', title: f.title ?? '', detail: f.detail, occurredAt: f.occurred_at ?? '', voided: !!f.voided_at, who: f.logged_by ? names[f.logged_by] ?? null : null })),
    handled,
    doseEvents: (doses.data ?? []).map((d) => ({ id: d.id, medicationId: d.medication_id, scheduledFor: d.scheduled_for, givenAt: d.given_at, outcome: d.outcome, voidedAt: d.voided_at, loggedBy: d.logged_by })),
    names,
  };
}

/** Next Up with locally queued (not yet synced) writes counted as handled, so the UI updates at once. */
export function useNextUp(now: Date) {
  const care = useCare();
  const outbox = useOutbox();
  return useMemo(() => {
    if (!care.pet) return [];
    const meds: MedScheduleInput[] = care.meds.flatMap((m) =>
      m.schedules.map((s) => ({
        scheduleId: s.id, medicationId: m.id, medicationName: m.name, doseAmount: m.doseAmount, unit: m.unit,
        withFood: m.withFood, timeOfDay: s.timeOfDay, daysOfWeek: s.daysOfWeek,
      })));
    const meals: MealScheduleInput[] = care.meals.map((m) => ({ scheduleId: m.id, timeOfDay: m.timeOfDay, food: m.food, amountText: m.amountText }));
    const local: HandledOccurrence[] = outbox.flatMap((o): HandledOccurrence[] => {
      if (o.kind === 'dose' && o.payload.scheduledFor && o.status !== 'needs_review' && o.status !== 'failed') return [{ kind: 'med', refId: o.payload.medicationId, scheduledFor: o.payload.scheduledFor }];
      if (o.kind === 'feeding' && o.payload.scheduledFor && o.payload.mealScheduleId && o.status !== 'failed') return [{ kind: 'meal', refId: o.payload.mealScheduleId, scheduledFor: o.payload.scheduledFor }];
      return [];
    });
    return buildNextUp(meds, meals, [...care.handled, ...local], { timeZone: care.timeZone, now });
  }, [care.pet, care.meds, care.meals, care.handled, care.timeZone, outbox, now]);
}
