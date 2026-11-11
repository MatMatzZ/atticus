import { useState } from 'react';
import { RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { daysOfSupply, formatAmount, localDate, needsRefill, parseAmount, zonedInstant } from '@atticus/core';
import { rpc } from '@atticus/db';
import { supabase } from '@/lib/supabase';
import { useCare, type Med } from '@/data/care';
import { clock } from '@/lib/format';
import { useTheme } from '@/design/theme';
import { fontFamily, radius, tap, type } from '@/design/tokens';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { StatusBadge } from '@/ui/StatusBadge';
import { Sheet } from '@/ui/Sheet';


export default function Meds() {
  const care = useCare();
  const { c } = useTheme();
  const [edit, setEdit] = useState<Med | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const v = parseAmount(text);
    if (v == null || v <= 0 || !edit) return setErr('Enter an amount like 1 3/4, 1/2 or 2.');
    setBusy(true); setErr(null);
    const { error } = await rpc.changeDose(supabase, edit.id, v);
    setBusy(false);
    if (error) return setErr('The dose change didn’t save. Check your connection and try again.');
    setEdit(null); await care.refresh();
  }

  const nextTime = (m: Med) => {
    const today = localDate(new Date(), care.timeZone);
    const upcoming = m.schedules.map((s) => zonedInstant(today, s.timeOfDay, care.timeZone)).filter((d) => d.getTime() > Date.now()).sort((a, b) => +a - +b)[0];
    return upcoming ? `Next ${clock(upcoming, care.timeZone)}` : m.schedules[0] ? `Next ${m.schedules[0].timeOfDay} tomorrow` : 'No times set';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} refreshControl={<RefreshControl refreshing={false} onRefresh={care.refresh} />}>
        <Text variant="title" accessibilityRole="header">Meds</Text>
        <Text color="ink2">Doses and supply as entered from your vet’s instructions.</Text>
        {care.meds.length === 0 ? <Card><Text>No medications yet.</Text></Card> : null}
        {care.meds.map((m) => {
          const left = daysOfSupply(m.quantityOnHand, m.doseAmount, m.schedules.length);
          const refill = needsRefill(m.quantityOnHand, m.refillAlertAt);
          return (
            <Card key={m.id}>
              <Text variant="heading">{m.name}{m.strength ? ` ${m.strength}` : ''}</Text>
              <Text variant="numeralL">{formatAmount(m.doseAmount)} <Text variant="heading" color="ink2">{m.unit}</Text></Text>
              <Text color="ink2">{nextTime(m)}{m.withFood ? ' · with food' : ''}</Text>
              <Text color="ink2">{m.quantityOnHand == null ? 'Supply not entered' : `${formatAmount(m.quantityOnHand)} ${m.unit} on hand${left != null ? ` · about ${left} days` : ''}`}</Text>
              {refill ? <StatusBadge status="dueSoon" label="Refill reminder" /> : null}
              <Button kind="secondary" label={`Change ${m.name} dose`} onPress={() => { setEdit(m); setText(formatAmount(m.doseAmount)); setErr(null); }} />
            </Card>
          );
        })}
      </ScrollView>
      <Sheet visible={!!edit} onClose={() => setEdit(null)}>
        <Text variant="title" accessibilityRole="header">Change dose</Text>
        <Text color="ink2">Enter the new amount exactly as your vet gave it. The old dose stays in history.</Text>
        <TextInput accessibilityLabel="New dose amount" value={text} onChangeText={setText} placeholder="1 3/4" placeholderTextColor={c.muted}
          style={{ minHeight: tap.primary, borderRadius: radius.input, borderWidth: 1.5, borderColor: c.strong, paddingHorizontal: 14, backgroundColor: c.surface, color: c.ink, fontFamily: fontFamily[400], fontSize: type.bodyL.size }} />
        {err ? <Text color="urgent" accessibilityLiveRegion="polite">{err}</Text> : null}
        <View style={{ gap: 12 }}>
          <Button label="Save dose" onPress={save} busy={busy} />
          <Button kind="text" label="Cancel" onPress={() => setEdit(null)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
