import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/design/theme';
import { radius, tap } from '@/design/tokens';
import { fontFamily, type } from '@/design/tokens';
import { Text } from '@/ui/Text';
import { Button } from '@/ui/Button';

export default function SignIn() {
  const { c } = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const input = {
    minHeight: tap.primary, borderRadius: radius.input, borderWidth: 1.5, borderColor: c.strong, paddingHorizontal: 14,
    backgroundColor: c.surface, color: c.ink, fontFamily: fontFamily[400], fontSize: type.bodyL.size,
  } as const;

  async function send() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) setMsg('We couldn’t send a code to that address. Check it and try again.');
    else setSent(true);
  }
  async function verify() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMsg('That code didn’t work. Check the newest email and try again.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <Text variant="meta" color="muted" style={{ letterSpacing: 3 }}>ATTICUS</Text>
          <Text variant="title" accessibilityRole="header">Sign in</Text>
          <Text color="ink2">ATTICUS records and organizes your pet’s care. It does not give medical advice. Follow your licensed vet.</Text>
          <View style={{ gap: 8 }}>
            <Text variant="meta" color="muted">Email</Text>
            <TextInput
              accessibilityLabel="Email address" style={input} value={email} onChangeText={setEmail} editable={!sent}
              autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
              placeholderTextColor={c.muted}
            />
          </View>
          {sent ? (
            <View style={{ gap: 8 }}>
              <Text variant="meta" color="muted">Code from your email</Text>
              <TextInput
                accessibilityLabel="Sign-in code" style={input} value={code} onChangeText={setCode}
                keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={8}
                placeholderTextColor={c.muted}
              />
            </View>
          ) : null}
          {msg ? <Text color="urgent" accessibilityLiveRegion="polite">{msg}</Text> : null}
          {sent
            ? <Button label="Sign in" onPress={verify} busy={busy} disabled={code.trim().length < 6} />
            : <Button label="Send me a code" onPress={send} busy={busy} disabled={!email.includes('@')} />}
          {sent ? <Button kind="text" label="Use a different email" onPress={() => { setSent(false); setCode(''); }} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
