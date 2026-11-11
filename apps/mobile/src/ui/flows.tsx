import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  PORTION_CHOICES, breathsPerMinute, crossedThresholds, formatAmount, type NextUpCard,
} from '@atticus/core';
import { enqueue, type OutboxEntry } from '@/lib/outbox';
import { newId } from '@/lib/uuid';
import { clock } from '@/lib/format';
import { useCare, type Contact } from '@/data/care';
import { useTheme } from '@/design/theme';
import { fontFamily, radius, tap, type } from '@/design/tokens';
import { Text } from './Text';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { ICON, Icon, StatusBadge } from './StatusBadge';

type Needs = Extract<OutboxEntry, { kind: 'dose' }>;

function useNoteInput() {
  const { c } = useTheme();
  return {
    minHeight: tap.primary, borderRadius: radius.input, borderWidth: 1.5, borderColor: c.strong, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: c.surface, color: c.ink, fontFamily: fontFamily[400], fontSize: type.body.size,
  } as const;
}

/* ------------------------------------------------------------------ Confirm sheet (M-3a) */
export function ConfirmSheet({ card, onClose, onMealPending, onOther }: {
  card: NextUpCard | null; onClose: () => void;
  onMealPending: (m: { scheduleId: string; scheduledFor: string; food: string | null }) => void; onOther: () => void;
}) {
  const care = useCare();
  const { c } = useTheme();
  const [off, setOff] = useState<Set<string>>(new Set());
  useEffect(() => setOff(new Set()), [card?.scheduledFor.getTime()]);
  if (!card || !care.pet) return <Sheet visible={false}>{null}</Sheet>;
  const pet = care.pet;

  async function confirm() {
    const now = new Date();
    for (const it of card!.items) {
      if (off.has(it.kind + it.refId)) continue;
      if (it.kind === 'med') {
        const med = care.meds.find((m) => m.id === it.refId);
        if (!med) continue;
        await enqueue({ id: newId(), kind: 'dose', payload: {
          petId: pet.id, medicationId: med.id, outcome: 'given', givenAt: now.toISOString(),
          scheduledFor: it.scheduledFor.toISOString(), amount: med.doseAmount, note: null, force: false,
        } });
      } else {
        onMealPending({ scheduleId: it.refId, scheduledFor: it.scheduledFor.toISOString(), food: care.meals.find((m) => m.id === it.refId)?.food ?? null });
      }
    }
    onClose();
  }

  return (
    <Sheet visible onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="title" accessibilityRole="header">Confirm {clock(card.scheduledFor, care.timeZone)}</Text>
        <Text variant="meta" color="muted">Now {clock(new Date(), care.timeZone)}</Text>
      </View>
      {card.items.map((it) => {
        const key = it.kind + it.refId;
        const on = !off.has(key);
        return (
          <Pressable
            key={key} accessibilityRole="checkbox" accessibilityLabel={it.label} accessibilityState={{ checked: on }}
            onPress={() => setOff((s) => { const n = new Set(s); on ? n.add(key) : n.delete(key); return n; })}
            style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, borderRadius: radius.input, backgroundColor: c.sunken }}
          >
            <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: on ? c.accent : c.strong, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {on ? <Icon d={ICON.check} size={20} color={c.onAccent} sw={3} /> : null}
            </View>
            <Text weight={600} style={{ flex: 1 }}>{it.label}</Text>
          </Pressable>
        );
      })}
      <Text color="ink2">Given by {care.userName}, now</Text>
      <Button label="Confirm done" onPress={confirm} icon={<Icon d={ICON.check} size={24} color={c.onAccent} sw={2.4} />} disabled={off.size === card.items.length} />
      <Button kind="text" label="Something else happened" onPress={onOther} />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Duplicate-dose dialog (M-3b) */
export function DuplicateDoseDialog({ entry, onDecide }: { entry: Needs | null; onDecide: (giveAnyway: boolean) => void }) {
  const care = useCare();
  const { c } = useTheme();
  if (!entry) return <Sheet visible={false}>{null}</Sheet>;
  const med = care.meds.find((m) => m.id === entry.payload.medicationId);
  const who = entry.conflict?.logged_by_name ?? 'someone';
  const when = entry.conflict ? clock(entry.conflict.given_at, care.timeZone) : '';
  return (
    <Sheet visible alert>
      <StatusBadge status="overdue" label="Possible double dose" />
      <Text variant="title" accessibilityRole="header">{med ? `${med.name} · ${formatAmount(entry.payload.amount ?? med.doseAmount)} ${med.unit}` : 'Medication'}</Text>
      <Text variant="bodyL" accessibilityLiveRegion="assertive">Already given by {who} at {when}. Give anyway?</Text>
      <View style={{ gap: 20, marginTop: 8 }}>
        <Button label="Don’t give" onPress={() => onDecide(false)} />
        <Button kind="secondary" label="Give anyway" onPress={() => onDecide(true)} hint="Logs this dose as well" />
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Feeding (M-4) */
export function FeedingSheet({ meal, onClose }: { meal: { scheduleId: string | null; scheduledFor: string | null; food: string | null } | null; onClose: () => void }) {
  const care = useCare();
  const { c } = useTheme();
  const [eighths, setEighths] = useState<number | null>(null);
  useEffect(() => setEighths(null), [meal]);
  if (!meal || !care.pet) return <Sheet visible={false}>{null}</Sheet>;
  const pet = care.pet;
  async function save(portion: number) {
    await enqueue({ id: newId(), kind: 'feeding', payload: {
      petId: pet.id, loggedBy: care.userId, portion, loggedAt: new Date().toISOString(),
      scheduledFor: meal!.scheduledFor, mealScheduleId: meal!.scheduleId, food: meal!.food,
    } });
    onClose();
  }
  return (
    <Sheet visible onClose={onClose}>
      <Text variant="title" accessibilityRole="header">Did {pet.name} finish their food?</Text>
      <Button label="Yes, all of it" onPress={() => save(1)} />
      <Text variant="meta" color="muted">Or how much was eaten</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PORTION_CHOICES.filter((p) => p.value !== 1).map((p) => (
          <Pressable key={p.label} accessibilityRole="button" accessibilityLabel={p.label === 'None' ? 'Ate none' : `Ate ${p.label}`} onPress={() => save(p.value)}
            style={{ minWidth: 88, minHeight: tap.primary, flexGrow: 1, borderRadius: radius.button, borderWidth: 1.5, borderColor: c.strong, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
            <Text variant="heading">{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text variant="meta" color="muted">Custom, in eighths</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Stepper label="Less" onPress={() => setEighths((e) => Math.max(0, (e ?? 4) - 1))} sign="−" />
        <Text variant="numeralL" style={{ minWidth: 96, textAlign: 'center' }} accessibilityLiveRegion="polite">{eighths == null ? '–' : `${eighths}/8`}</Text>
        <Stepper label="More" onPress={() => setEighths((e) => Math.min(8, (e ?? 4) + 1))} sign="+" />
        <View style={{ flex: 1 }}><Button kind="secondary" label="Save" disabled={eighths == null} onPress={() => save((eighths ?? 0) / 8)} /></View>
      </View>
    </Sheet>
  );
}
function Stepper({ label, onPress, sign }: { label: string; onPress: () => void; sign: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ width: tap.primary, height: tap.primary, borderRadius: radius.button, borderWidth: 1.5, borderColor: c.strong, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="heading">{sign}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Dose outcomes (M-5) */
export function OutcomeSheet({ card, visible, onClose }: { card: NextUpCard | null; visible: boolean; onClose: () => void }) {
  const care = useCare();
  const input = useNoteInput();
  const [outcome, setOutcome] = useState<'skipped' | 'refused' | 'vomited_after'>('skipped');
  const [note, setNote] = useState('');
  const { c } = useTheme();
  if (!visible || !card || !care.pet) return <Sheet visible={false}>{null}</Sheet>;
  const pet = care.pet;
  const meds = card.items.filter((i) => i.kind === 'med');
  async function save() {
    for (const it of meds) {
      const med = care.meds.find((m) => m.id === it.refId);
      if (!med) continue;
      await enqueue({ id: newId(), kind: 'dose', payload: {
        petId: pet.id, medicationId: med.id, outcome, givenAt: new Date().toISOString(),
        scheduledFor: it.scheduledFor.toISOString(), amount: outcome === 'vomited_after' ? med.doseAmount : null, note: note.trim() || null, force: false,
      } });
    }
    setNote(''); onClose();
  }
  const opts: { v: typeof outcome; l: string }[] = [{ v: 'skipped', l: 'Skipped' }, { v: 'refused', l: 'Refused' }, { v: 'vomited_after', l: 'Vomited after' }];
  return (
    <Sheet visible onClose={onClose}>
      <Text variant="title" accessibilityRole="header">What happened?</Text>
      {meds.map((m) => <Text key={m.refId} color="ink2">{m.label}</Text>)}
      {opts.map((o) => (
        <Pressable key={o.v} accessibilityRole="radio" accessibilityLabel={o.l} accessibilityState={{ selected: outcome === o.v }} onPress={() => setOutcome(o.v)}
          style={{ minHeight: 56, borderRadius: radius.button, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: outcome === o.v ? c.accent : c.strong, backgroundColor: outcome === o.v ? c.accentSoft : c.surface }}>
          <Icon d={outcome === o.v ? ICON.done : ICON.upcoming} color={outcome === o.v ? c.accentInk : c.muted} />
          <Text weight={600}>{o.l}</Text>
        </Pressable>
      ))}
      <TextInput accessibilityLabel="Note, optional" placeholder="Note (optional)" placeholderTextColor={c.muted} value={note} onChangeText={setNote} multiline style={input} />
      <Button label="Save" onPress={save} disabled={meds.length === 0} />
      <Button kind="text" label="Cancel" onPress={onClose} />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Quick logs (preset-driven) */
export type QuickLog = { kind: string; label: string; input?: string; options?: string[]; scale?: string; unit?: string };
export function QuickLogSheet({ q, onClose }: { q: QuickLog | null; onClose: () => void }) {
  const care = useCare();
  const { c } = useTheme();
  if (!q || !care.pet) return <Sheet visible={false}>{null}</Sheet>;
  const pet = care.pet;
  async function save(text: string | null, scale: number | null) {
    await enqueue({ id: newId(), kind: 'observation', payload: {
      petId: pet.id, loggedBy: care.userId, kind: q!.kind, observedAt: new Date().toISOString(), isUrgent: false,
      valueNum: null, valueText: text, scaleValue: scale, unit: q!.unit ?? null, note: null,
    } });
    onClose();
  }
  const scale = q.input === 'scale' || q.input === 'visual_scale' ? [0, 1, 2, 3] : [];
  return (
    <Sheet visible onClose={onClose}>
      <Text variant="title" accessibilityRole="header">{q.label}</Text>
      {(q.options ?? []).map((o) => <Button key={o} kind="secondary" label={o} onPress={() => save(o, null)} />)}
      {scale.length ? (
        <>
          <Text color="ink2">Your own rating, 0 to 3</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {scale.map((n) => (
              <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${q.label} ${n}`} onPress={() => save(null, n)}
                style={{ flex: 1, minHeight: tap.primary, borderRadius: radius.button, borderWidth: 1.5, borderColor: c.strong, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="numeralL">{n}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <Button kind="text" label="Cancel" onPress={onClose} />
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Call buttons (tel: only, no advice) */
export function CallButtons({ contacts }: { contacts: Contact[] }) {
  const list = contacts.filter((c) => c.phone && (c.kind === 'regular_vet' || c.kind === 'emergency_clinic'));
  const { c } = useTheme();
  if (!list.length) return <Text color="ink2">No vet or emergency clinic number saved yet.</Text>;
  return (
    <View style={{ gap: 12 }}>
      {list.map((k) => (
        <Button key={k.id} kind={k.kind === 'emergency_clinic' ? 'urgent' : 'primary'}
          label={`Call ${k.kind === 'emergency_clinic' ? 'emergency clinic' : 'vet'}: ${k.clinic ?? k.name}`}
          icon={<Icon d={ICON.phone} color={k.kind === 'emergency_clinic' ? c.onUrgent : c.onAccent} />}
          onPress={() => void Linking.openURL(`tel:${k.phone!.replace(/[^\d+]/g, '')}`)} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ Urgent log (M-7) */
export function UrgentSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const care = useCare();
  const { c } = useTheme();
  const input = useNoteInput();
  const [kind, setKind] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!visible) { setKind(null); setNote(''); setSaved(false); } }, [visible]);
  if (!visible || !care.pet) return <Sheet visible={false}>{null}</Sheet>;
  const pet = care.pet;
  const kinds = [...(care.preset.urgent_logs ?? []).map((u) => ({ kind: u.kind, label: u.label })), { kind: 'other', label: 'Other' }];
  async function save() {
    await enqueue({ id: newId(), kind: 'observation', payload: {
      petId: pet.id, loggedBy: care.userId, kind: kind!, observedAt: new Date().toISOString(), isUrgent: true,
      valueNum: null, valueText: kinds.find((k) => k.kind === kind)?.label ?? null, scaleValue: null, unit: null, note: note.trim() || null,
    } });
    setSaved(true);
  }
  return (
    <Sheet visible onClose={onClose}>
      {saved ? (
        <>
          <StatusBadge status="done" label="Saved with the time" />
          <Text variant="title" accessibilityRole="header">Logged for {pet.name}</Text>
          <CallButtons contacts={care.contacts} />
          <Button kind="secondary" label="Done" onPress={onClose} />
        </>
      ) : (
        <>
          <Text variant="title" accessibilityRole="header">Urgent log</Text>
          <Text color="ink2">Pick what you saw. The time is saved automatically.</Text>
          {kinds.map((k) => (
            <Pressable key={k.kind} accessibilityRole="radio" accessibilityLabel={k.label} accessibilityState={{ selected: kind === k.kind }} onPress={() => setKind(k.kind)}
              style={{ minHeight: 56, borderRadius: radius.button, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1.5, borderColor: kind === k.kind ? c.urgent : c.strong, backgroundColor: kind === k.kind ? c.sunken : c.surface }}>
              <Text weight={600}>{k.label}</Text>
            </Pressable>
          ))}
          <TextInput accessibilityLabel="Note, optional" placeholder="Note (optional)" placeholderTextColor={c.muted} value={note} onChangeText={setNote} multiline style={input} />
          <Button kind="urgent" label="Save urgent log" onPress={save} disabled={!kind} />
          <Button kind="text" label="Cancel" onPress={onClose} />
        </>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ Breathing counter (M-6) */
export function BreathingSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const care = useCare();
  const { c } = useTheme();
  const [win, setWin] = useState<30 | 60>(30);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [taps, setTaps] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<number | null>(null);
  const saved = useRef(false);

  useEffect(() => { if (!visible) { setStartedAt(null); setTaps([]); setResult(null); saved.current = false; } }, [visible]);
  useEffect(() => {
    if (startedAt == null || result != null) return;
    const t = setInterval(() => {
      const n = Date.now(); setNow(n);
      if (n >= startedAt + win * 1000) { setResult(breathsPerMinute(taps, win, startedAt)); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    }, 250);
    return () => clearInterval(t);
  }, [startedAt, win, taps, result]);

  const crossed = useMemo(() => (result == null ? [] : crossedThresholds('rrr', result, care.thresholds)), [result, care.thresholds]);
  const hasThreshold = care.thresholds.some((t) => t.metric === 'rrr');
  if (!visible || !care.pet) return <Sheet visible={false}>{null}</Sheet>;
  const pet = care.pet;
  const left = startedAt == null ? win : Math.max(0, Math.ceil((startedAt + win * 1000 - now) / 1000));

  async function save() {
    if (saved.current || result == null) return;
    saved.current = true;
    await enqueue({ id: newId(), kind: 'observation', payload: {
      petId: pet.id, loggedBy: care.userId, kind: 'rrr', observedAt: new Date().toISOString(), isUrgent: false,
      valueNum: result, valueText: null, scaleValue: null, unit: 'breaths/min', note: null,
    } });
    onClose();
  }

  return (
    <Sheet visible onClose={onClose}>
      <Text variant="title" accessibilityRole="header">Breathing counter</Text>
      {result == null ? (
        <>
          {startedAt == null ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([30, 60] as const).map((w) => (
                <View key={w} style={{ flex: 1 }}>
                  <Button kind={win === w ? 'primary' : 'secondary'} label={`${w} seconds`} onPress={() => setWin(w)} />
                </View>
              ))}
            </View>
          ) : null}
          <Text color="ink2">While {pet.name} rests, tap once for every breath (chest rise and fall).</Text>
          <Pressable
            accessibilityRole="button" accessibilityLabel={startedAt == null ? 'Start counting' : `Tap for each breath. ${taps.length} counted, ${left} seconds left`}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (startedAt == null) { setStartedAt(Date.now()); setNow(Date.now()); return; }
              setTaps((t) => [...t, Date.now()]);
            }}
            style={{ minHeight: 260, borderRadius: radius.card, backgroundColor: c.accentSoft, borderWidth: 1.5, borderColor: c.accent, alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Text variant="numeralXL" color="accentInk">{startedAt == null ? 'Start' : taps.length}</Text>
            <Text variant="bodyL" color="accentInk">{startedAt == null ? 'Tap to begin' : `${left} s left`}</Text>
          </Pressable>
          <Button kind="text" label="Cancel" onPress={onClose} />
        </>
      ) : (
        <>
          <Text variant="numeralXL" accessibilityLiveRegion="polite">{result} <Text variant="heading" color="ink2">breaths/min</Text></Text>
          {crossed.length ? crossed.map((t, i) => (
            <View key={i} style={{ gap: 8 }}>
              <StatusBadge status="overdue" label={`Above the ${t.value} you set`} />
              {t.vetInstruction ? <Text variant="bodyL">Your vet’s instruction: “{t.vetInstruction}”</Text> : null}
            </View>
          )) : hasThreshold ? <Text color="ink2">Not above the limit you entered from your vet.</Text>
            : <Text color="ink2">No limit saved yet. Ask your vet what resting rate they want you to call about, then enter it.</Text>}
          {crossed.length ? <CallButtons contacts={care.contacts} /> : null}
          <Button label="Save reading" onPress={save} />
          <Button kind="text" label="Discard" onPress={onClose} />
        </>
      )}
    </Sheet>
  );
}
