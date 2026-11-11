import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/design/theme';
import { radius } from '@/design/tokens';

export function Card({ style, ...rest }: ViewProps) {
  const { c } = useTheme();
  return <View {...rest} style={[{ backgroundColor: c.surface, borderColor: c.hair, borderWidth: 1, borderRadius: radius.card, padding: 16, gap: 12 }, style]} />;
}
