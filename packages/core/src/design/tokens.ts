/**
 * ATTICUS design tokens — the single source of truth for mobile and web.
 *
 * Calm, warm neutrals + one muted teal accent, in a light and a night theme.
 * Values come from the approved ATTICUS Design System. Every text/background
 * pair the apps use is listed in `contrast.ts` and verified by the test
 * suite (WCAG 2.x AA or better).
 *
 * This file has no runtime imports on purpose, so `scripts/*.ts` can load it
 * with Node's built-in type stripping.
 */

export type ThemeName = 'light' | 'night';

export interface Palette {
  /** Page background. */
  canvas: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** Inset rows inside cards, chips, secondary fills. */
  sunken: string;
  /** Primary text. */
  ink: string;
  /** Secondary text (body copy that is not the main line). */
  ink2: string;
  /** Tertiary text: timestamps, labels. Still AA on canvas/surface/sunken. */
  muted: string;
  /** Decorative hairlines ONLY. Never the only boundary of a control. */
  hair: string;
  /** Borders that define a control (inputs, outline buttons, tiles): ≥ 3:1. */
  strong: string;
  /** The one accent: primary buttons, links, selection. */
  accent: string;
  onAccent: string;
  /** Selected/tinted backgrounds. */
  accentSoft: string;
  /** Text on accentSoft. */
  accentInk: string;
  /** Urgent: the only solid red in the app. */
  urgent: string;
  onUrgent: string;
  /** Dims content behind bottom sheets and dialogs (may be translucent). */
  scrim: string;
  /** Text drawn directly on the scrim. */
  onScrim: string;
  /** Snackbar / offline banner. */
  toastBg: string;
  toastFg: string;
  /** Keyboard focus ring. */
  focus: string;
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    canvas: '#F6F4F0', surface: '#FFFFFF', sunken: '#ECE8E1',
    ink: '#1F2421', ink2: '#454C48', muted: '#5B625E',
    hair: '#D9D4CC', strong: '#857F75',
    accent: '#2B6660', onAccent: '#FFFFFF', accentSoft: '#DCEAE6', accentInk: '#1D4A45',
    urgent: '#A61B34', onUrgent: '#FFFFFF',
    // 0.72 (was 0.55): white text on the scrim needs ≥ 4.5:1 over white content.
    scrim: 'rgba(31,36,33,0.72)', onScrim: '#FFFFFF',
    toastBg: '#3B4240', toastFg: '#FFFFFF',
    focus: '#1D4ED8',
  },
  night: {
    canvas: '#111514', surface: '#1A201E', sunken: '#232B29',
    ink: '#E8ECEA', ink2: '#BAC3BF', muted: '#97A19C',
    hair: '#33403D', strong: '#6E7A76',
    accent: '#7CC3B9', onAccent: '#0D2421', accentSoft: '#1F3634', accentInk: '#BFE3DD',
    urgent: '#FF8A9B', onUrgent: '#2A0A10',
    scrim: 'rgba(0,0,0,0.7)', onScrim: '#BAC3BF',
    toastBg: '#D9DED9', toastFg: '#1A201E',
    focus: '#8AB4FF',
  },
};

/* ------------------------------------------------------------------ status */

/**
 * Semantic status keys. `upcoming | due_soon | overdue` match `NextUpItem.status`
 * from nextUp.ts; `urgent` is the Urgent Log; `done | voided` are log outcomes.
 */
export const STATUS_KEYS = ['upcoming', 'due_soon', 'overdue', 'urgent', 'done', 'voided'] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export interface StatusColors {
  /** Icon + label colour. */
  fg: string;
  /** Chip / banner fill. */
  bg: string;
  /** Chip outline (decorative; the icon + label carry the meaning). */
  edge: string;
}

export const statusColors: Record<ThemeName, Record<StatusKey, StatusColors>> = {
  light: {
    upcoming: { fg: '#34557A', bg: '#E5ECF4', edge: '#C9D6E6' },
    due_soon: { fg: '#7A4F00', bg: '#FAEED3', edge: '#EED9A8' },
    overdue: { fg: '#9A3412', bg: '#FBE4DA', edge: '#F1C6B4' },
    urgent: { fg: '#FFFFFF', bg: '#A61B34', edge: '#A61B34' },
    done: { fg: '#2C6440', bg: '#E0EFE3', edge: '#C3DEC9' },
    voided: { fg: '#585C59', bg: '#ECEAE6', edge: '#D9D4CC' },
  },
  night: {
    upcoming: { fg: '#A9C4E6', bg: '#1C2734', edge: '#2C3D52' },
    due_soon: { fg: '#F2C46B', bg: '#2E2615', edge: '#4A3D1E' },
    overdue: { fg: '#F4A383', bg: '#35201A', edge: '#55322A' },
    urgent: { fg: '#2A0A10', bg: '#FF8A9B', edge: '#FF8A9B' },
    done: { fg: '#9FD3AE', bg: '#1A2C20', edge: '#2A4532' },
    voided: { fg: '#AEB4B1', bg: '#262A29', edge: '#3A403E' },
  },
};

export interface StatusMeta {
  /** Visible word shown next to the icon. Never omit it. */
  label: string;
  /** Icon token name (unique silhouette per status, survives grayscale). */
  icon: 'clock' | 'hourglass' | 'alert-circle' | 'alert-triangle' | 'check-circle' | 'slash-circle';
  /** 24×24 stroke path for the icon (stroke-width 2–2.4, round caps/joins). */
  iconPath: string;
  /** Severity order for sorting: higher = more pressing. */
  severity: number;
  /** Voided entries are also struck through. */
  strike?: boolean;
}

/**
 * Status is never colour alone: every status carries an icon AND a label.
 * Components must render `iconPath` + `label` (or a more specific label such
 * as "DUE IN 15 MIN") together with `statusColors`.
 */
export const statusMeta: Record<StatusKey, StatusMeta> = {
  upcoming: { label: 'Upcoming', icon: 'clock', severity: 1, iconPath: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2' },
  due_soon: { label: 'Due soon', icon: 'hourglass', severity: 2, iconPath: 'M6 3h12M6 21h12M7 3v3a5 5 0 0 0 10 0V3M7 21v-3a5 5 0 0 1 10 0v3' },
  overdue: { label: 'Overdue', icon: 'alert-circle', severity: 3, iconPath: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 8v5M12 16.5v.01' },
  urgent: { label: 'Urgent', icon: 'alert-triangle', severity: 4, iconPath: 'M12 3L2 20h20zM12 9v5M12 17v.01' },
  done: { label: 'Done', icon: 'check-circle', severity: 0, iconPath: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8 12.5l3 3 5-6' },
  voided: { label: 'Voided', icon: 'slash-circle', severity: 0, strike: true, iconPath: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM5.6 5.6l12.8 12.8' },
};

/* -------------------------------------------------------------- typography */

export type TextVariant = 'numeralXL' | 'numeralL' | 'title' | 'heading' | 'bodyL' | 'body' | 'meta';

export interface TextStyleToken {
  /** px (React Native dp). */
  size: number;
  lineHeight: number;
  weight: 400 | 600 | 700;
  /** Tabular figures, so countdowns and doses don't jitter. */
  tabular?: boolean;
}

/**
 * Large defaults: body is 18 and nothing a caregiver must read is smaller.
 * `meta` (16) is for chips and timestamps only, never sentences.
 */
export const typeScale: Record<TextVariant, TextStyleToken> = {
  numeralXL: { size: 64, lineHeight: 68, weight: 700, tabular: true },
  numeralL: { size: 40, lineHeight: 44, weight: 700, tabular: true },
  title: { size: 28, lineHeight: 34, weight: 600 },
  heading: { size: 22, lineHeight: 28, weight: 600 },
  bodyL: { size: 20, lineHeight: 30, weight: 400 },
  body: { size: 18, lineHeight: 28, weight: 400 },
  meta: { size: 16, lineHeight: 22, weight: 600 },
};

/** Minimum size for any sentence-style text. */
export const MIN_BODY_SIZE = 18;
/** Largest dynamic-type multiplier layouts must survive before scrolling. */
export const MAX_FONT_SCALE = 2;

export const fontFamily = {
  /** Expo Google Fonts names (mobile). */
  native: {
    400: 'AtkinsonHyperlegibleNext_400Regular',
    600: 'AtkinsonHyperlegibleNext_600SemiBold',
    700: 'AtkinsonHyperlegibleNext_700Bold',
  },
  /** CSS stack (web). */
  web: "'Atkinson Hyperlegible Next', 'Atkinson Hyperlegible', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

/* ------------------------------------------------- spacing, radius, targets */

/** 8 px scale (4 only for hairline nudges). */
export const space = { half: 4, s1: 8, s1h: 12, s2: 16, s3: 24, s4: 32, s5: 40, s6: 48, s8: 64, s10: 80 } as const;

/** Nested radius = outer − padding, never below 12 (except pill). */
export const radius = { input: 12, chip: 12, button: 14, tile: 14, card: 16, dialog: 16, sheet: 24, pill: 999 } as const;

/** Touch targets in px/dp. Nothing tappable is smaller than `min`. */
export const tap = { min: 48, primary: 56, urgent: 64, gap: 8 } as const;

/** Thicknesses for borders that define controls and focus rings. */
export const stroke = { hair: 1, control: 1.5, selected: 2, focus: 3 } as const;

export const tokens = { palettes, statusColors, statusMeta, typeScale, space, radius, tap, stroke, fontFamily } as const;
export type Tokens = typeof tokens;
