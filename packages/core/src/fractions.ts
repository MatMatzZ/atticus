/**
 * Fractional amounts, exactly as prescribed ("1 3/4 tablets").
 * Stored in the DB as numeric (1.75); shown to people as fractions.
 * Supports halves, quarters and eighths — the splits pill cutters make.
 */

const DENOMS = [2, 4, 8] as const;
const EPS = 1e-6;

/** "1 3/4" | "3/4" | "1.75" | "2" → 1.75. Returns null for invalid input. */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s+/g, ' ');
  if (!s) return null;

  const mixed = /^(\d+) (\d+)\/(\d+)$/.exec(s);
  if (mixed) return frac(Number(mixed[1]), Number(mixed[2]), Number(mixed[3]));

  const simple = /^(\d+)\/(\d+)$/.exec(s);
  if (simple) return frac(0, Number(simple[1]), Number(simple[2]));

  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  return null;
}

function frac(whole: number, num: number, den: number): number | null {
  if (den === 0 || num >= den) return null;
  return whole + num / den;
}

/** 1.75 → "1 3/4", 0.5 → "1/2", 2 → "2". Falls back to decimals (max 3 dp). */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '';
  const whole = Math.floor(value + EPS);
  const rest = value - whole;
  if (rest < EPS) return String(whole);

  for (const den of DENOMS) {
    const num = Math.round(rest * den);
    if (Math.abs(rest - num / den) < EPS && num > 0 && num < den) {
      const g = gcd(num, den);
      const f = `${num / g}/${den / g}`;
      return whole ? `${whole} ${f}` : f;
    }
  }
  return String(Number(value.toFixed(3)));
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** Choices for the "Did [Pet] finish their food?" picker (spec C). */
export const PORTION_CHOICES = [
  { label: 'All', value: 1 },
  { label: '¾', value: 0.75 },
  { label: '½', value: 0.5 },
  { label: '¼', value: 0.25 },
  { label: '⅛', value: 0.125 },
  { label: 'None', value: 0 },
] as const;
