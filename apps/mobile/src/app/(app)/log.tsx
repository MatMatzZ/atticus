import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCare, useOutbox } from '@/data/care';
import { ago, clock } from '@/lib/format';
import { useTheme } from '@/design/theme';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { StatusBadge } from '@/ui/StatusBadge';

export default function Log() {
  const care = useCare();
  const outbox = useOutbox().filter((o) => o.status === 'pending');
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} refreshControl={<RefreshControl refreshing={false} onRefresh={care.refresh} />}>
        <Text variant="title" accessibilityRole="header">Log</Text>
        {outbox.length ? <Card><StatusBadge status="upcoming" label="Saved on this phone" /><Text color="ink2">{outbox.length} entries will sync when you’re online.</Text></Card> : null}
        <Card style={{ paddingVertical: 8 }}>
          {care.activity.length === 0 ? <Text style={{ paddingVertical: 12 }}>No activity yet.</Text> : null}
          {care.activity.map((a, i) => (
            <View key={a.id || i} style={{ paddingVertical: 12, gap: 4, borderTopWidth: i ? 1 : 0, borderTopColor: c.hair }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text variant="meta">{a.who ?? 'Someone'}</Text>
                <Text variant="meta" color="muted">{clock(a.occurredAt, care.timeZone)} · {ago(a.occurredAt)}</Text>
              </View>
              <Text style={a.voided ? { textDecorationLine: 'line-through' } : undefined}>{a.title}{a.detail ? ` · ${a.detail}` : ''}</Text>
              {a.voided ? <StatusBadge status="voided" label="Voided" /> : null}
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
