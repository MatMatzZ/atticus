/**
 * Compatibility layer for the existing src/ui components.
 * Values now come from @atticus/core (single source of truth, contrast-tested).
 * New code should import from '@/constants/theme'.
 */
import {
  fontFamily as coreFonts, MAX_FONT_SCALE, palettes as corePalettes, radius as coreRadius,
  space as coreSpace, statusColors as coreStatus, tap as coreTap, typeScale,
  type Palette as CorePalette, type StatusColors, type TextVariant,
} from '@atticus/core';

export type Palette = CorePalette;
export type { StatusColors, TextVariant };
export { MAX_FONT_SCALE };

/** Legacy camelCase key; maps to core's `due_soon`. */
export type StatusKey = 'upcoming' | 'dueSoon' | 'overdue' | 'urgent' | 'done' | 'voided';

export const palettes: Record<'light' | 'night', Palette> = corePalettes;

const legacyStatus = (t: 'light' | 'night'): Record<StatusKey, StatusColors> => {
  const { due_soon, ...rest } = coreStatus[t];
  return { ...rest, dueSoon: due_soon };
};
export const statusColors: Record<'light' | 'night', Record<StatusKey, StatusColors>> = {
  light: legacyStatus('light'),
  night: legacyStatus('night'),
};

export const space = coreSpace;
export const radius = coreRadius;
export const tap = coreTap;

export const type: Record<TextVariant, { size: number; line: number; weight: '400' | '600' | '700'; tnum?: boolean }> =
  Object.fromEntries(
    Object.entries(typeScale).map(([k, v]) => [k, { size: v.size, line: v.lineHeight, weight: String(v.weight) as '400' | '600' | '700', tnum: v.tabular }]),
  ) as Record<TextVariant, { size: number; line: number; weight: '400' | '600' | '700'; tnum?: boolean }>;

export const fontFamily = coreFonts.native;
