import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/design/theme';
import { radius, type StatusKey } from '@/design/tokens';
import { Text } from './Text';

export const ICON = {
  upcoming: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2',
  dueSoon: 'M6 3h12M6 21h12M7 3v3a5 5 0 0 0 10 0V3M7 21v-3a5 5 0 0 1 10 0v3',
  overdue: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 8v5M12 16.5v.01',
  urgent: 'M12 3L2 20h20zM12 9v5M12 17v.01',
  done: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8 12.5l3 3 5-6',
  voided: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM5.6 5.6l12.8 12.8',
  pill: 'M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7zM7 7l7 7',
  bowl: 'M3 11h18a9 9 0 0 1-18 0zM8 7c0-1 1-1.5 1-2.5M12 7c0-1 1-1.5 1-2.5M16 7c0-1 1-1.5 1-2.5',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  lungs: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7',
  check: 'M5 12.5l4.5 4.5L19 7',
  plus: 'M12 5v14M5 12h14',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
} as const;

export function Icon({ d, size = 22, color, sw = 2 }: { d: string; size?: number; color: string; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
      <Path d={d} />
    </Svg>
  );
}

export function StatusBadge({ status, label }: { status: StatusKey; label: string }) {
  const { status: s } = useTheme();
  const k = s[status];
  return (
    <View
      accessible accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingLeft: 8, paddingRight: 12, borderRadius: radius.pill, backgroundColor: k.bg, borderColor: k.edge, borderWidth: 1, alignSelf: 'flex-start' }}
    >
      <Icon d={ICON[status]} size={18} color={k.fg} sw={2.2} />
      <Text variant="meta" style={{ color: k.fg, letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}
