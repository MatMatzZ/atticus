import 'server-only';
import { cache } from 'react';
import { cacheLife } from 'next/cache';
import type { MemberRole } from '@atticus/core';
import { createClient } from '@/lib/supabase/server';

/**
 * All reads run as the signed-in user (publishable key + session cookie), so RLS applies.
 * The secret key is never used here.
 */

export const ACTIVITY_PAGE_SIZE = 10;
export const TREND_DAYS = 14;

/** Pets the user can see, with role, household and the user's own thresholds — one round trip. */
export const getDashboardData = cache(async () => {
  const supabase = await createClient();
  const [members, pets] = await Promise.all([
    supabase.from('household_members').select('household_id, role, expires_at, households(name, timezone)'),
    supabase
      .from('pets')
      .select(
        'id, name, species, status, household_id, pet_thresholds(metric, comparator, value, unit, vet_instruction)',
      )
      .order('name'),
  ]);
  if (members.error) throw members.error;
  if (pets.error) throw pets.error;

  const now = Date.now();
  const households = new Map<string, { role: MemberRole; name: string; timezone: string }>();
  for (const m of members.data) {
    if (m.expires_at && new Date(m.expires_at).getTime() <= now) continue; // expired sitter
    const h = Array.isArray(m.households) ? m.households[0] : m.households;
    households.set(m.household_id, { role: m.role, name: h?.name ?? 'Household', timezone: h?.timezone ?? 'UTC' });
  }
  return { households, pets: pets.data.filter((p) => households.has(p.household_id)) };
});

/** Breathing-rate readings for every pet in a single query (no N+1), grouped in memory. */
export async function getBreathingTrends(petIds: string[]) {
  'use cache: private';
  cacheLife({ stale: 30 });
  if (petIds.length === 0) return {} as Record<string, { t: number; v: number }[]>;
  const supabase = await createClient();
  const since = new Date(Date.now() - TREND_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('observation_events')
    .select('pet_id, observed_at, value_num')
    .eq('kind', 'rrr')
    .is('voided_at', null)
    .not('value_num', 'is', null)
    .gte('observed_at', since)
    .in('pet_id', petIds)
    .order('observed_at')
    .limit(500);
  if (error) throw error;
  const byPet: Record<string, { t: number; v: number }[]> = {};
  for (const row of data) {
    (byPet[row.pet_id] ??= []).push({ t: new Date(row.observed_at).getTime(), v: Number(row.value_num) });
  }
  return byPet;
}

/** One page of the unified activity_feed view (+1 row to detect a next page). */
export async function getActivityPage(petIds: string[], page: number) {
  'use cache: private';
  cacheLife({ stale: 15 });
  if (petIds.length === 0) return { rows: [], hasNext: false };
  const supabase = await createClient();
  const from = (page - 1) * ACTIVITY_PAGE_SIZE;
  const { data, error } = await supabase
    .from('activity_feed')
    .select('id, pet_id, type, occurred_at, title, detail, voided_at')
    .in('pet_id', petIds)
    .is('voided_at', null)
    .order('occurred_at', { ascending: false })
    .range(from, from + ACTIVITY_PAGE_SIZE);
  if (error) throw error;
  // Views type every column as nullable; these are never null in practice.
  const rows = data.slice(0, ACTIVITY_PAGE_SIZE).flatMap((r) =>
    r.id && r.pet_id && r.occurred_at && r.type && r.title
      ? [{ id: r.id, pet_id: r.pet_id, type: r.type, occurred_at: r.occurred_at, title: r.title, detail: r.detail }]
      : [],
  );
  return { rows, hasNext: data.length > ACTIVITY_PAGE_SIZE };
}
