/**
 * ATTICUS Design System tokens (light + night), transcribed from the
 * approved Design System artifact. Screens must use these; no raw hex or
 * font sizes elsewhere.
 */
export interface Palette {
  canvas: string; surface: string; sunken: string;
  ink: string; ink2: string; muted: string;
  hair: string; strong: string;
  accent: string; onAccent: string; accentSoft: string; accentInk: string;
  urgent: string; onUrgent: string;
  scrim: string; onScrim: string; toastBg: string; toastFg: string;
}

export type StatusKey = 'upcoming' | 'dueSoon' | 'overdue' | 'urgent' | 'done' | 'voided';
export interface StatusColors { fg: string; bg: string; edge: string }

export const palettes: Record<'light' | 'night', Palette> = {
  light: {
    canvas: '#F6F4F0', surface: '#FFFFFF', sunken: '#ECE8E1',
    ink: '#1F2421', ink2: '#454C48', muted: '#5B625E',
    hair: '#D9D4CC', strong: '#857F75',
    accent: '#2B6660', onAccent: '#FFFFFF', accentSoft: '#DCEAE6', accentInk: '#1D4A45',
    urgent: '#A61B34', onUrgent: '#FFFFFF',
    scrim: 'rgba(31,36,33,0.55)', onScrim: '#FFFFFF', toastBg: '#3B4240', toastFg: '#FFFFFF',
  },
  night: {
    canvas: '#111514', surface: '#1A201E', sunken: '#232B29',
    ink: '#E8ECEA', ink2: '#BAC3BF', muted: '#97A19C',
    hair: '#33403D', strong: '#6E7A76',
    accent: '#7CC3B9', onAccent: '#0D2421', accentSoft: '#1F3634', accentInk: '#BFE3DD',
    urgent: '#FF8A9B', onUrgent: '#2A0A10',
    scrim: 'rgba(0,0,0,0.7)', onScrim: '#97A19C', toastBg: '#D9DED9', toastFg: '#1A201E',
  },
};

export const statusColors: Record<'light' | 'night', Record<StatusKey, StatusColors>> = {
  light: {
    upcoming: { fg: '#34557A', bg: '#E5ECF4', edge: '#C9D6E6' },
    dueSoon: { fg: '#7A4F00', bg: '#FAEED3', edge: '#EED9A8' },
    overdue: { fg: '#9A3412', bg: '#FBE4DA', edge: '#F1C6B4' },
    urgent: { fg: '#FFFFFF', bg: '#A61B34', edge: '#A61B34' },
    done: { fg: '#2C6440', bg: '#E0EFE3', edge: '#C3DEC9' },
    voided: { fg: '#585C59', bg: '#ECEAE6', edge: '#D9D4CC' },
  },
  night: {
    upcoming: { fg: '#A9C4E6', bg: '#1C2734', edge: '#2C3D52' },
    dueSoon: { fg: '#F2C46B', bg: '#2E2615', edge: '#4A3D1E' },
    overdue: { fg: '#F4A383', bg: '#35201A', edge: '#55322A' },
    urgent: { fg: '#2A0A10', bg: '#FF8A9B', edge: '#FF8A9B' },
    done: { fg: '#9FD3AE', bg: '#1A2C20', edge: '#2A4532' },
    voided: { fg: '#AEB4B1', bg: '#262A29', edge: '#3A403E' },
  },
};

/** 8 px scale. */
export const space = { half: 4, s1: 8, s1h: 12, s2: 16, s3: 24, s4: 32, s5: 40, s6: 48, s8: 64 } as const;
export const radius = { input: 12, button: 14, card: 16, pill: 999, sheet: 24 } as const;
export const tap = { min: 48, primary: 56, urgent: 64 } as const;

export type TextVariant = 'numeralXL' | 'numeralL' | 'title' | 'heading' | 'bodyL' | 'body' | 'meta';
export const type: Record<TextVariant, { size: number; line: number; weight: '400' | '600' | '700'; tnum?: boolean }> = {
  numeralXL: { size: 64, line: 68, weight: '700', tnum: true },
  numeralL: { size: 40, line: 44, weight: '700', tnum: true },
  title: { size: 28, line: 34, weight: '600' },
  heading: { size: 22, line: 28, weight: '600' },
  bodyL: { size: 20, line: 30, weight: '400' },
  body: { size: 18, line: 28, weight: '400' },
  meta: { size: 16, line: 22, weight: '600' },
};

/** Largest dynamic-type multiplier we let layouts grow to before they scroll. */
export const MAX_FONT_SCALE = 2;

export const fontFamily = {
  400: 'AtkinsonHyperlegibleNext_400Regular',
  600: 'AtkinsonHyperlegibleNext_600SemiBold',
  700: 'AtkinsonHyperlegibleNext_700Bold',
} as const;
