import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type { Database };
export type AtticusClient = SupabaseClient<Database>;

export type DoseOutcome = 'given' | 'skipped' | 'refused' | 'vomited_after';

export type LogDoseResult =
  | { status: 'logged'; id: string; quantity_on_hand: number | null; refill_needed: boolean }
  | { status: 'already_logged'; id: string }
  | {
      status: 'needs_confirmation';
      conflict: { id: string; given_at: string; amount: number | null; logged_by: string; logged_by_name: string | null };
    };

/**
 * Browser / React Native client. Only ever pass the PUBLISHABLE key here.
 * `storage` lets mobile pass expo-sqlite localStorage; web uses the default.
 */
export function createAtticusClient(
  url: string,
  publishableKey: string,
  options?: { storage?: any; detectSessionInUrl?: boolean },
): AtticusClient {
  return createClient<Database>(url, publishableKey, {
    auth: {
      storage: options?.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? false,
    },
  });
}

/** Typed RPC wrappers — the only way the apps write doses. */
export const rpc = {
  createHousehold: (db: AtticusClient, name: string, timezone = 'Asia/Manila') =>
    db.rpc('create_household', { p_name: name, p_timezone: timezone }),

  acceptInvite: (db: AtticusClient, token: string) =>
    db.rpc('accept_invite', { p_token: token }),

  /** id must be generated on the device (crypto.randomUUID) so offline retries are idempotent. */
  logDose: async (
    db: AtticusClient,
    args: {
      id: string;
      medicationId: string;
      outcome: DoseOutcome;
      givenAt?: string;
      scheduledFor?: string | null;
      amount?: number | null;
      note?: string | null;
      force?: boolean;
    },
  ) => {
    const { data, error } = await db.rpc('log_dose', {
      p_id: args.id,
      p_medication_id: args.medicationId,
      p_outcome: args.outcome,
      p_given_at: args.givenAt ?? new Date().toISOString(),
      p_scheduled_for: args.scheduledFor ?? undefined,
      p_amount: args.amount ?? undefined,
      p_note: args.note ?? undefined,
      p_force: args.force ?? false,
    });
    return { data: data as LogDoseResult | null, error };
  },

  voidDose: (db: AtticusClient, id: string, reason?: string) =>
    db.rpc('void_dose', { p_id: id, p_reason: reason ?? undefined }),

  changeDose: (db: AtticusClient, medicationId: string, doseAmount: number, instructions?: string) =>
    db.rpc('change_dose', { p_medication_id: medicationId, p_dose_amount: doseAmount, p_instructions: instructions ?? undefined }),

  setPetMemorial: (db: AtticusClient, petId: string, passedOn?: string) =>
    db.rpc('set_pet_memorial', { p_pet: petId, ...(passedOn ? { p_passed_on: passedOn } : {}) }),
};

/** Storage path convention enforced by RLS: <household_id>/<pet_id>/<file> */
export const mediaPath = (householdId: string, petId: string, file: string) =>
  `${householdId}/${petId}/${file}`;
