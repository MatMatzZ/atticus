/**
 * Writes the tokens as CSS variables for apps/web.
 *   npm run tokens:css --workspace @atticus/core
 */
import { writeFileSync } from 'node:fs';
import { tokens } from '../src/design/tokens.ts';
import { toCssVariables } from '../src/design/css.ts';

const out = new URL('../../../apps/web/src/app/atticus-tokens.css', import.meta.url);
writeFileSync(out, toCssVariables(tokens));
console.log(`Wrote ${out.pathname}`);
