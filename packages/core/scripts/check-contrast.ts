/**
 * Prints the WCAG contrast report for every token pair; exits 1 on any failure.
 *   npm run contrast --workspace @atticus/core
 * Runs on Node ≥ 22.6 with type stripping (no build step).
 */
import { palettes, statusColors } from '../src/design/tokens.ts';
import { auditContrast, contrastPairs, formatContrastReport } from '../src/design/contrast.ts';

const results = auditContrast(contrastPairs(palettes, statusColors));
console.log(formatContrastReport(results));
process.exit(results.every((r) => r.pass) ? 0 : 1);
