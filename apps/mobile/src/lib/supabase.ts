import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import { AppState } from 'react-native';
import { createAtticusClient } from '@atticus/db';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

export const supabase = createAtticusClient(url, key, { storage: localStorage });

// Refresh tokens only while the app is in the foreground
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
