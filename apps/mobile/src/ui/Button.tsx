import { Pressable, View, ActivityIndicator } from 'react-native';
import { useTheme } from '@/design/theme';
import { radius, tap } from '@/design/tokens';
import { Text } from './Text';

type Kind = 'primary' | 'secondary' | 'text' | 'urgent';

export function Button({
  label, onPress, kind = 'primary', icon, disabled, busy, hint, minHeight,
}: {
  label: string; onPress: () => void; kind?: Kind; icon?: React.ReactNode;
  disabled?: boolean; busy?: boolean; hint?: string; minHeight?: number;
}) {
  const { c } = useTheme();
  const filled = kind === 'primary' || kind === 'urgent';
  const bg = kind === 'urgent' ? c.urgent : kind === 'primary' ? c.accent : 'transparent';
  const fg = kind === 'urgent' ? 'onUrgent' : kind === 'primary' ? 'onAccent' : kind === 'text' ? 'accent' : 'ink';
  const h = minHeight ?? (kind === 'urgent' ? tap.urgent : kind === 'primary' ? tap.primary : tap.min);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: h, borderRadius: radius.button, paddingHorizontal: 16, paddingVertical: 8,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: bg, borderWidth: kind === 'secondary' ? 1.5 : 0, borderColor: c.strong,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? <ActivityIndicator color={filled ? c.onAccent : c.accent} /> : <>{icon ? <View>{icon}</View> : null}
        <Text variant={kind === 'primary' || kind === 'urgent' ? 'bodyL' : 'body'} weight={kind === 'text' || kind === 'secondary' ? 600 : 700} color={fg}>{label}</Text></>}
    </Pressable>
  );
}
