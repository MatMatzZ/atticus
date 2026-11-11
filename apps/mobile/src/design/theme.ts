import { useColorScheme } from 'react-native';
import { palettes, statusColors } from './tokens';

export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'night' : 'light';
  return { scheme, c: palettes[scheme], status: statusColors[scheme] } as const;
}
