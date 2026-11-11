import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  AtkinsonHyperlegibleNext_400Regular, AtkinsonHyperlegibleNext_600SemiBold, AtkinsonHyperlegibleNext_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/data/session';
import { useTheme } from '@/design/theme';

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { session, ready } = useSession();
  const { c } = useTheme();
  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.canvas } }}>
      <Stack.Protected guard={!!session}><Stack.Screen name="(app)" /></Stack.Protected>
      <Stack.Protected guard={!session}><Stack.Screen name="(auth)" /></Stack.Protected>
    </Stack>
  );
}

export default function Root() {
  const { scheme } = useTheme();
  const [loaded] = useFonts({ AtkinsonHyperlegibleNext_400Regular, AtkinsonHyperlegibleNext_600SemiBold, AtkinsonHyperlegibleNext_700Bold });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'night' ? 'light' : 'dark'} />
      <SessionProvider><Routes /></SessionProvider>
    </SafeAreaProvider>
  );
}
