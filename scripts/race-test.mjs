// QA-2 · Double-dose race & offline test.
//
//   node --env-file=.env.local --env-file=apps/web/.env.local scripts/race-test.mjs
//
// Creates its own throw-away users/household/pet/medication on the LOCAL stack, hammers
// public.log_dose / void_dose concurrently through PostgREST (the real client path),
// asserts the safety invariants, then deletes everything it created.
// Refuses to run against anything that is not 127.0.0.1 / localhost.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const secret = process.env.SUPABASE_SECRET_KEY;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
if (!secret || !publishable) throw new Error('Need SUPABASE_SECRET_KEY and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.local files).');
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url + '/')) throw new Error(`Refusing to run against non-local URL: ${url}`);

const admin = createClient(url, secret, { auth: { persistSession: false } });
const tag = randomUUID().slice(0, 8);
const PASSWORD = `qa-${tag}-Pw!x9`;
const results = [];
const check = (id, desc, ok, detail = '') => {
  results.push({ id, desc, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${desc}${ok || !detail ? '' : `   -> ${detail}`}`);
};
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

async function makeUser(label) {
  const email = `qa-race-${tag}-${label}@atticus.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: `QA ${label}` },
  });
  if (error) throw error;
  const db = createClient(url, publishable, { auth: { persistSession: false } });
  must(await db.auth.signInWithPassword({ email, password: PASSWORD }));
  return { id: data.user.id, db, name: `QA ${label}` };
}

const created = { users: [], households: [] };
const logDose = (u, medId, { id = randomUUID(), at, force = false, outcome = 'given' } = {}) =>
  u.db.rpc('log_dose', { p_id: id, p_medication_id: medId, p_outcome: outcome, p_given_at: at, p_force: force })
      .then(({ data, error }) => (error ? { status: `error:${error.code}`, message: error.message } : data));
const tally = (rs) => rs.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const H = 3_600_000;

let med, A, B;
const stats = async () => {
  const m = must(await admin.from('medications').select('quantity_on_hand').eq('id', med).single());
  const ev = must(await admin.from('dose_events').select('inventory_decremented,voided_at,outcome').eq('medication_id', med));
  const live = ev.filter((e) => !e.voided_at);
  const consumed = live.reduce((s, e) => s + Number(e.inventory_decremented), 0);
  return { qty: Number(m.quantity_on_hand), live: live.length, consumed, total: ev.length };
};
const START_QTY = 100;
const inventoryInvariant = async (id) => {
  const s = await stats();
  check(id, `inventory == ${START_QTY} - sum(non-voided inventory_decremented)`, Math.abs(s.qty - (START_QTY - s.consumed)) < 1e-9, JSON.stringify(s));
  return s;
};

try {
  // ---------------------------------------------------------------- setup
  A = await makeUser('A'); B = await makeUser('B');
  created.users.push(A.id, B.id);
  const hh = must(await A.db.rpc('create_household', { p_name: `QA race ${tag}` }));
  created.households.push(hh);
  const pet = must(await A.db.from('pets').insert({ household_id: hh, name: 'RacePet', species: 'dog' }).select().single());
  const m = must(await A.db.from('medications').insert({ pet_id: pet.id, name: 'RaceMed', quantity_on_hand: START_QTY, refill_alert_at: 5 }).select().single());
  med = m.id;
  must(await A.db.from('medication_versions').insert({ medication_id: med, dose_amount: 1 }));
  const inv = must(await A.db.from('household_invites').insert({ household_id: hh, role: 'caregiver' }).select().single());
  must(await B.db.rpc('accept_invite', { p_token: inv.token }));

  // ---------------------------------------------------------------- S1: 50 concurrent, same window, force=false (x3 windows)
  for (const [i, hoursAgo] of [30, 27, 24].entries()) {
    const at = iso(hoursAgo * H);
    const rs = await Promise.all(Array.from({ length: 50 }, (_, k) => logDose(k % 2 ? A : B, med, { at })));
    const t = tally(rs);
    check(`S1.${i + 1}a`, `window ${i + 1}: exactly 1 'logged' out of 50 concurrent`, t.logged === 1, JSON.stringify(t));
    check(`S1.${i + 1}b`, `window ${i + 1}: other 49 are 'needs_confirmation'`, t.needs_confirmation === 49, JSON.stringify(t));
    const withName = rs.filter((r) => r.status === 'needs_confirmation' && r.conflict?.logged_by_name).length;
    check(`S1.${i + 1}c`, `window ${i + 1}: every warning names who gave the dose`, withName === 49, `named=${withName}`);
  }
  let s = await inventoryInvariant('S1.inv');
  check('S1.rows', '3 windows => exactly 3 live dose rows and 97 on hand', s.live === 3 && s.qty === 97, JSON.stringify(s));

  // ---------------------------------------------------------------- S2: same UUID retried concurrently (flaky network / outbox double-flush)
  {
    const id = randomUUID(); const at = iso(20 * H);
    const rs = await Promise.all(Array.from({ length: 20 }, (_, k) => logDose(k % 2 ? A : B, med, { id, at })));
    const t = tally(rs);
    check('S2.a', 'same UUID x20 concurrent: exactly one write', t.logged === 1 && (t.already_logged ?? 0) === 19, JSON.stringify(t));
    const n = must(await admin.from('dose_events').select('id').eq('id', id)).length;
    check('S2.b', 'same UUID => 1 row', n === 1, `rows=${n}`);
    s = await inventoryInvariant('S2.inv');
    check('S2.c', 'inventory decremented once (97 -> 96)', s.qty === 96, JSON.stringify(s));
  }

  // ---------------------------------------------------------------- S3: forced duplicates are honoured, inventory stays consistent
  {
    const at = iso(17 * H);
    const rs = await Promise.all(Array.from({ length: 10 }, (_, k) => logDose(k % 2 ? A : B, med, { at, force: true })));
    const t = tally(rs);
    check('S3.a', 'force=true x10: all logged (explicit user override)', t.logged === 10, JSON.stringify(t));
    s = await inventoryInvariant('S3.inv');
    check('S3.b', 'inventory 96 -> 86', s.qty === 86, JSON.stringify(s));
  }

  // ---------------------------------------------------------------- S4: concurrent void of one dose restores inventory once
  {
    const at = iso(14 * H); const id = randomUUID();
    const first = await logDose(A, med, { id, at });
    check('S4.a', 'setup dose logged', first.status === 'logged', JSON.stringify(first));
    const before = (await stats()).qty;
    const rs = await Promise.all(Array.from({ length: 20 }, (_, k) => (k % 2 ? A : B).db.rpc('void_dose', { p_id: id, p_reason: 'race' })));
    const errs = rs.filter((r) => r.error).length;
    check('S4.b', '20 concurrent voids: none error', errs === 0, `errors=${errs}`);
    const after = (await stats()).qty;
    check('S4.c', 'inventory restored exactly once (+1)', after === before + 1, `before=${before} after=${after}`);
    await inventoryInvariant('S4.inv');
  }

  // ---------------------------------------------------------------- S5: log vs void storm in one window
  {
    const at = iso(11 * H);
    const seed = randomUUID();
    await logDose(A, med, { id: seed, at });
    const ops = [
      ...Array.from({ length: 25 }, (_, k) => logDose(k % 2 ? A : B, med, { at })),
      ...Array.from({ length: 10 }, (_, k) => (k % 2 ? A : B).db.rpc('void_dose', { p_id: seed }).then((r) => ({ status: r.error ? `error:${r.error.code}` : 'voided' }))),
    ];
    const t = tally(await Promise.all(ops));
    check('S5.a', 'log/void storm: no unexpected errors', Object.keys(t).every((k) => ['logged', 'needs_confirmation', 'voided'].includes(k)), JSON.stringify(t));
    const live = must(await admin.from('dose_events').select('id').eq('medication_id', med).is('voided_at', null).gte('given_at', iso(11 * H + 1000)).lte('given_at', iso(11 * H - 1000)));
    check('S5.b', 'at most one live (unvoided) dose in the window', live.length <= 1, `live=${live.length}`);
    await inventoryInvariant('S5.inv');
  }

  // ---------------------------------------------------------------- S6: offline device A, online device B, A reconnects
  {
    const at8 = iso(8 * H);                 // the scheduled 8:00 dose
    const at802 = new Date(Date.parse(at8) + 2 * 60_000).toISOString();
    const idA = randomUUID();               // generated on device A while offline
    const before = (await stats()).qty;
    const rb = await logDose(B, med, { at: at802 });       // device B logs while A is offline
    check('S6.a', 'device B logs 8:02 while A is offline', rb.status === 'logged', JSON.stringify(rb));
    const ra = await logDose(A, med, { id: idA, at: at8 });  // A reconnects, flushes its queue (no force)
    check('S6.b', 'A flush returns needs_confirmation (never silently double-doses)', ra.status === 'needs_confirmation', JSON.stringify(ra));
    check('S6.c', 'warning identifies B and 8:02', ra.conflict?.logged_by_name === B.name && Math.abs(Date.parse(ra.conflict.given_at) - Date.parse(at802)) < 1000, JSON.stringify(ra.conflict));
    const stillThere = must(await admin.from('dose_events').select('id').eq('id', idA)).length;
    check('S6.d', 'A\'s queued dose is NOT in the database yet', stillThere === 0, `rows=${stillThere}`);
    check('S6.e', 'inventory decremented only for B (-1)', (await stats()).qty === before - 1);
    // user reviews and chooses "Give anyway"
    const rf = await logDose(A, med, { id: idA, at: at8, force: true });
    check('S6.f', 'after review, force flush logs it', rf.status === 'logged', JSON.stringify(rf));
    // outbox retries the same request (response lost)
    const rr = await Promise.all([logDose(A, med, { id: idA, at: at8, force: true }), logDose(A, med, { id: idA, at: at8 })]);
    check('S6.g', 'replayed flush (with and without force) => already_logged', rr.every((r) => r.status === 'already_logged'), JSON.stringify(rr.map((r) => r.status)));
    check('S6.h', 'inventory not decremented by the replays (-2 total)', (await stats()).qty === before - 2);
    await inventoryInvariant('S6.inv');
  }

  // ---------------------------------------------------------------- S7: offline outbox of mixed outcomes flushed in parallel with live traffic
  {
    const queue = [
      { id: randomUUID(), at: iso(5 * H), outcome: 'given' },
      { id: randomUUID(), at: iso(5 * H - 10 * 60_000), outcome: 'skipped' },   // skip does not conflict
      { id: randomUUID(), at: iso(2 * H), outcome: 'given' },
      { id: randomUUID(), at: iso(2 * H - 30 * 60_000), outcome: 'given' },      // 30 min after previous => must conflict with it or its sibling, never both logged
    ];
    const live = Array.from({ length: 10 }, () => logDose(B, med, { at: iso(2 * H - 15 * 60_000) }));
    const flushed = await Promise.all([...queue.map((q) => logDose(A, med, { id: q.id, at: q.at, outcome: q.outcome })), ...live]);
    const given2h = must(await admin.from('dose_events').select('id,given_at').eq('medication_id', med).eq('outcome', 'given').is('voided_at', null)
      .gte('given_at', iso(2 * H + 45 * 60_000)).lte('given_at', iso(2 * H - 45 * 60_000)));
    // all candidate times fall inside one 45-min span, so at most 1 live 'given' may exist without force
    const spread = given2h.length ? Math.max(...given2h.map((g) => Date.parse(g.given_at))) - Math.min(...given2h.map((g) => Date.parse(g.given_at))) : 0;
    check('S7.a', 'parallel outbox flush + live taps: no two un-forced doses < 60 min apart', given2h.length <= 1 || spread >= 3_600_000, `live=${given2h.length} spreadMin=${Math.round(spread / 60000)}`);
    check('S7.b', 'skipped entry in the queue was logged', flushed[1].status === 'logged', JSON.stringify(flushed[1]));
    await inventoryInvariant('S7.inv');
  }

  // ---------------------------------------------------------------- S8: outbox upserts for feeding/observation (what apps/mobile/src/lib/outbox.ts sends)
  {
    const fid = randomUUID(), oid = randomUUID();
    const feed = { id: fid, pet_id: pet.id, logged_by: B.id, portion_eaten: 0.5, logged_at: iso(H) };
    const obs = { id: oid, pet_id: pet.id, logged_by: B.id, kind: 'rrr', observed_at: iso(H), value_num: 24, unit: 'breaths/min', is_urgent: false };
    const up = (t, row, user = B) => user.db.from(t).upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    const r1 = await Promise.all([up('feeding_events', feed), up('feeding_events', feed), up('feeding_events', feed)]);
    check('S8.a', 'feeding upsert x3 (outbox replay): no error', r1.every((r) => !r.error), JSON.stringify(r1.map((r) => r.error?.code)));
    check('S8.b', 'feeding upsert x3 => exactly 1 row', must(await admin.from('feeding_events').select('id').eq('id', fid)).length === 1);
    const r2 = await Promise.all([up('observation_events', obs), up('observation_events', obs)]);
    check('S8.c', 'observation upsert x2: no error, 1 row', r2.every((r) => !r.error) && must(await admin.from('observation_events').select('id').eq('id', oid)).length === 1);
    // replay with CHANGED content must not rewrite history (append-only)
    await up('feeding_events', { ...feed, portion_eaten: 1 });
    const kept = must(await admin.from('feeding_events').select('portion_eaten').eq('id', fid).single());
    check('S8.d', 'replay with different portion does NOT overwrite the original (append-only)', Number(kept.portion_eaten) === 0.5, JSON.stringify(kept));
    // account switch on a shared phone: A's queued entry (logged_by=A) flushed while B is signed in
    const spoof = await up('feeding_events', { ...feed, id: randomUUID(), logged_by: A.id });
    check('S8.e', 'entry queued by A but flushed under B is rejected by RLS (-> outbox must not lose it silently)', spoof.error?.code === '42501', JSON.stringify(spoof.error));
    // dose queued by A but flushed while B is signed in is attributed to B
    const did = randomUUID();
    await logDose(B, med, { id: did, at: iso(3 * H) });   // simulates A's queued dose flushed from B's session
    const who = must(await admin.from('dose_events').select('logged_by').eq('id', did).single());
    check('S8.f', 'INFO: dose flushed from another user\'s session is attributed to that session (outbox is not per-user)', who.logged_by === B.id, JSON.stringify(who));
  }
} catch (e) {
  check('FATAL', 'test run aborted', false, e.message);
} finally {
  // ---------------------------------------------------------------- cleanup (service role)
  for (const h of created.households) await admin.from('households').delete().eq('id', h);
  for (const u of created.users) await admin.auth.admin.deleteUser(u);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
