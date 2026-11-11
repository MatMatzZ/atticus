import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '@/design/theme';
import { fontFamily, MAX_FONT_SCALE, type Palette, type TextVariant, type } from '@/design/tokens';

export type TextColor = keyof Pick<Palette, 'ink' | 'ink2' | 'muted' | 'accent' | 'onAccent' | 'accentInk' | 'onUrgent' | 'urgent'>;

export function Text({
  variant = 'body', color = 'ink', weight, style, ...rest
}: TextProps & { variant?: TextVariant; color?: TextColor; weight?: 400 | 600 | 700 }) {
  const { c } = useTheme();
  const t = type[variant];
  const w = weight ?? Number(t.weight);
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        { fontFamily: fontFamily[w as 400 | 600 | 700], fontSize: t.size, lineHeight: t.line, color: c[color] },
        t.tnum ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
