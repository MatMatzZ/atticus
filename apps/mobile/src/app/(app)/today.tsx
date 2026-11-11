import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCare, useNextUp, useOutbox } from '@/data/care';
import { dismissFailed, resolveReview } from '@/lib/outbox';
import { ago, clock } from '@/lib/format';
import { useTheme } from '@/design/theme';
import { radius, tap, type StatusKey } from '@/design/tokens';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { ICON, Icon, StatusBadge } from '@/ui/StatusBadge';
import {
  BreathingSheet, ConfirmSheet, DuplicateDoseDialog, FeedingSheet, OutcomeSheet, QuickLogSheet, UrgentSheet, type QuickLog,
} from '@/ui/flows';

const QUICK_ICON: Record<string, string> = { pee: ICON.drop, rrr: ICON.lungs, appetite: ICON.bowl };

export default function Today() {
  const care = useCare();
  const outbox = useOutbox();
  const { c } = useTheme();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  const cards = useNextUp(now);
  const card = cards[0] ?? null;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [meal, setMeal] = useState<{ scheduleId: string | null; scheduledFor: string | null; food: string | null } | null>(null);
  const [quick, setQuick] = useState<QuickLog | null>(null);
  const [urgentOpen, setUrgentOpen] = useState(false);
  const [breathOpen, setBreathOpen] = useState(false);

  const review = outbox.find((o) => o.kind === 'dose' && o.status === 'needs_review') as Extract<typeof outbox[number], { kind: 'dose' }> | undefined;
  const failed = outbox.filter((o) => o.status === 'failed');
  const waiting = outbox.filter((o) => o.status === 'pending').length;

  const tiles = useMemo<(QuickLog & { tool?: string })[]>(() => [
    ...(care.preset.quick_logs ?? []),
    { kind: '__food', label: 'Food', input: 'food' },
  ], [care.preset]);

  if (care.loading && !care.pet) return <Center text="Loading…" />;
  if (!care.pet) return <Center text="No pet found yet. Ask the household owner to add one, then pull down to refresh." onRefresh={care.refresh} />;
  const pet = care.pet;
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: care.timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const badge: { status: StatusKey; label: string } | null = card
    ? { status: card.status === 'upcoming' ? 'upcoming' : card.status === 'due_soon' ? 'dueSoon' : 'overdue', label: card.countdownLabel }
    : null;

  const recent = [
    ...outbox.filter((o) => o.status === 'pending').map((o) => ({ id: o.id, text: o.kind === 'dose' ? 'Dose' : o.kind === 'feeding' ? 'Meal' : o.payload.kind.toUpperCase(), when: 'saved on phone' })),
    ...care.activity.filter((a) => !a.voided).slice(0, 6).map((a) => ({ id: a.id, text: a.title, when: ago(a.occurredAt) })),
  ].slice(0, 6);

  const openQuick = (q: (typeof tiles)[number]) => {
    if (q.kind === '__food') return setMeal({ scheduleId: null, scheduledFor: null, food: null });
    if (q.tool === 'breath_counter') return setBreathOpen(true);
    setQuick(q);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} refreshControl={<RefreshControl refreshing={false} onRefresh={care.refresh} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40 }}>
          <Text weight={600}>{pet.name}</Text>
          <Text variant="meta" color="muted" accessibilityLiveRegion="polite">
            {waiting ? `${waiting} saved on this phone` : care.fromCache ? 'Offline' : 'Synced'}
          </Text>
        </View>
        <Text variant="title" accessibilityRole="header">{greeting}, {care.userName}.{'\n'}<Text variant="title" weight={400} color="ink2">Here is what {pet.name} needs next.</Text></Text>

        {failed.map((f) => (
          <Card key={f.id}>
            <StatusBadge status="overdue" label="Not saved" />
            <Text>The household couldn’t accept one {f.kind === 'dose' ? 'dose' : 'entry'}. It stays on this phone until you remove it.</Text>
            <Button kind="secondary" label="Remove from this phone" onPress={() => void dismissFailed(f.id)} />
          </Card>
        ))}

        {card && badge ? (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text variant="meta" color="muted">Next up · {clock(card.scheduledFor, care.timeZone)}</Text>
              <StatusBadge status={badge.status} label={badge.label} />
            </View>
            {card.items.map((it) => (
              <View key={it.kind + it.refId} accessible accessibilityLabel={it.label}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.sunken, borderRadius: radius.input, padding: 10, minHeight: tap.primary }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon d={it.kind === 'med' ? ICON.pill : ICON.bowl} color={c.accentInk} />
                </View>
                <Text variant="heading" style={{ flex: 1 }}>{it.label.replace(/ — (\d)/, ' · $1')}</Text>
              </View>
            ))}
            <Button label="Confirm done" onPress={() => setConfirmOpen(true)} icon={<Icon d={ICON.check} size={24} color={c.onAccent} sw={2.4} />} />
          </Card>
        ) : (
          <Card><Text variant="bodyL">Nothing scheduled yet. Add {pet.name}’s medications and meal times, and Next Up will show what’s due.</Text></Card>
        )}

        {recent.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Recent activity" contentContainerStyle={{ gap: 8 }}>
            {recent.map((r) => (
              <View key={r.id} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: radius.input, borderWidth: 1, borderColor: c.hair, backgroundColor: c.surface, justifyContent: 'center' }}>
                <Text variant="meta">{r.text} <Text variant="meta" weight={400} color="muted">{r.when}</Text></Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tiles.map((q) => (
            <Pressable key={q.kind} accessibilityRole="button" accessibilityLabel={`Log ${q.label}`} onPress={() => openQuick(q)}
              style={{ flexBasis: '31%', flexGrow: 1, minHeight: 64, borderRadius: radius.button, borderWidth: 1.5, borderColor: c.strong, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', padding: 6, gap: 4 }}>
              <Icon d={QUICK_ICON[q.kind] ?? ICON.plus} color={c.ink} />
              <Text variant="meta" style={{ textAlign: 'center' }}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={{ padding: 16, paddingTop: 8 }}>
        <Button kind="urgent" label="Urgent log" onPress={() => setUrgentOpen(true)} icon={<Icon d={ICON.urgent} size={26} color={c.onUrgent} sw={2.4} />} />
      </View>

      <ConfirmSheet card={confirmOpen ? card : null} onClose={() => setConfirmOpen(false)} onMealPending={setMeal} onOther={() => { setConfirmOpen(false); setOutcomeOpen(true); }} />
      <OutcomeSheet card={card} visible={outcomeOpen} onClose={() => setOutcomeOpen(false)} />
      <DuplicateDoseDialog entry={review ?? null} onDecide={(give) => void resolveReview(review!.id, give)} />
      <FeedingSheet meal={meal} onClose={() => setMeal(null)} />
      <QuickLogSheet q={quick} onClose={() => setQuick(null)} />
      <UrgentSheet visible={urgentOpen} onClose={() => setUrgentOpen(false)} />
      <BreathingSheet visible={breathOpen} onClose={() => setBreathOpen(false)} />
    </SafeAreaView>
  );
}

function Center({ text, onRefresh }: { text: string; onRefresh?: () => Promise<void> }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} refreshControl={onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} /> : undefined}>
        <Text variant="bodyL" color="ink2" style={{ textAlign: 'center' }}>{text}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
