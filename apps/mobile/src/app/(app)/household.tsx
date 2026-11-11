import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useCare } from '@/data/care';
import { requestExactAlarms } from '@/lib/reminders';
import { useTheme } from '@/design/theme';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';

export default function Household() {
  const care = useCare();
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} refreshControl={<RefreshControl refreshing={false} onRefresh={care.refresh} />}>
        <Text variant="title" accessibilityRole="header">Household</Text>
        <Card>
          {care.members.map((m) => (
            <View key={m.userId} style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text weight={600}>{m.name}{m.userId === care.userId ? ' (you)' : ''}</Text>
              <Text variant="meta" color="muted">{m.role[0].toUpperCase() + m.role.slice(1)}{m.expiresAt ? ` · until ${new Date(m.expiresAt).toLocaleDateString()}` : ''}</Text>
            </View>
          ))}
        </Card>
        <Card>
          <Text variant="heading">Vet contacts</Text>
          {care.contacts.length === 0 ? <Text color="ink2">None saved yet.</Text> : null}
          {care.contacts.map((k) => (
            <Button key={k.id} kind="secondary" label={`${k.kind === 'emergency_clinic' ? 'Emergency' : 'Vet'}: ${k.clinic ?? k.name}${k.phone ? ` · ${k.phone}` : ''}`}
              disabled={!k.phone} onPress={() => void Linking.openURL(`tel:${k.phone!.replace(/[^\d+]/g, '')}`)} />
          ))}
        </Card>
        <Card>
          <Text variant="heading">Reminders</Text>
          <Text color="ink2">Reminders for the next 48 hours are scheduled on this phone.</Text>
          <Button kind="secondary" label="Allow exact alarm times (Android)" onPress={() => void requestExactAlarms()} />
        </Card>
        <Button kind="secondary" label="Sign out" onPress={() => void supabase.auth.signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}
