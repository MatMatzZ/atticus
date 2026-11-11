// Local-only demo data. Run after `npm run db:start` (or `db:reset`):
//   cp .env.example .env.local   # paste SUPABASE_SECRET_KEY from `supabase start`
//   npm run db:seed-dev
//
// Creates two demo caregivers sharing one household with a heart-disease pet.
// NEVER point this at production.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321';
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? secret; // RPCs run as the signed-in user either way

if (!secret) throw new Error('Set SUPABASE_SECRET_KEY in .env.local (printed by `npx supabase start`).');
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error(`Refusing to seed non-local URL: ${url}`);

const admin = createClient(url, secret, { auth: { persistSession: false } });

const DEMO_PASSWORD = 'atticus-demo-123';
const users = [
  { email: 'owner@atticus.test', display_name: 'Ana (owner)' },
  { email: 'caregiver@atticus.test', display_name: 'Ben (caregiver)' },
];

async function ensureUser({ email, display_name }) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { display_name },
  });
  if (error && !/already/i.test(error.message)) throw error;
  return data?.user;
}

async function signedIn(email) {
  const c = createClient(url, publishable, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  return c;
}

const must = ({ data, error }) => { if (error) throw error; return data; };

for (const u of users) await ensureUser(u);

const owner = await signedIn(users[0].email);
const householdId = must(await owner.rpc('create_household', { p_name: 'Demo Household' }));

const pet = must(await owner.from('pets').insert({
  household_id: householdId, name: 'Bantay', species: 'dog', breed: 'Aspin', sex: 'male',
  birth_date: '2013-05-01', weight_kg: 14.2,
}).select().single());

must(await owner.from('pet_conditions').insert({ pet_id: pet.id, preset_key: 'heart_disease' }));
must(await owner.from('pet_thresholds').insert({
  pet_id: pet.id, metric: 'rrr', comparator: '>', value: 30, unit: 'breaths/min',
  vet_instruction: 'DEMO VALUE — replace with the number your vet gave you',
}));
must(await owner.from('vet_contacts').insert([
  { household_id: householdId, kind: 'regular_vet', name: 'Dr. Demo', clinic: 'Demo Animal Clinic', phone: '+63 900 000 0000' },
  { household_id: householdId, kind: 'emergency_clinic', name: '24/7 Demo ER', phone: '+63 900 000 0001' },
]));

const meds = [
  { name: 'Pimobendan', strength: '5 mg', with_food: true, dose: 1.75, qty: 40, alert: 10, times: ['08:00', '20:00'] },
  { name: 'Furosemide', strength: '12.5 mg', with_food: false, dose: 0.5, qty: 20, alert: 6, times: ['08:00', '14:00', '20:00'] },
];
for (const m of meds) {
  const med = must(await owner.from('medications').insert({
    pet_id: pet.id, name: m.name, strength: m.strength, with_food: m.with_food,
    quantity_on_hand: m.qty, refill_alert_at: m.alert, prescribed_by: 'Dr. Demo',
  }).select().single());
  must(await owner.from('medication_versions').insert({ medication_id: med.id, dose_amount: m.dose }));
  must(await owner.from('med_schedules').insert(m.times.map((t) => ({ medication_id: med.id, time_of_day: t }))));
}
must(await owner.from('meal_schedules').insert([
  { pet_id: pet.id, time_of_day: '08:00', food: 'Cardiac diet', amount_text: '1/2 can' },
  { pet_id: pet.id, time_of_day: '20:00', food: 'Cardiac diet', amount_text: '1/2 can' },
]));

const invite = must(await owner.from('household_invites')
  .insert({ household_id: householdId, role: 'caregiver' }).select().single());
const caregiver = await signedIn(users[1].email);
must(await caregiver.rpc('accept_invite', { p_token: invite.token }));

console.log(`Seeded household ${householdId} with pet Bantay.`);
console.log(`Sign in with ${users.map((u) => u.email).join(' / ')}  password: ${DEMO_PASSWORD}`);
