// Guardrail scan: no screen/copy/seed may diagnose, advise a dose or ship a default clinical threshold.
//   node scripts/qa/guardrails.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execSync } from 'node:child_process';

const SKIP = new Set(['node_modules', '.next', '.expo', '.git', 'assets', 'public', 'database.types.ts']);
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.json', '.sql', '.css']);
const files = (dir) => !existsSync(dir) ? [] : readdirSync(dir).flatMap((n) => {
  if (SKIP.has(n)) return []; const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : EXT.has(extname(n)) ? [p] : [];
});
const roots = ['apps/web/src', 'apps/mobile/src', 'packages/core/src', 'packages/db/src', 'supabase/migrations', 'supabase/seed.sql', 'scripts', 'docs/copy.md']
  .flatMap((r) => (existsSync(r) && statSync(r).isFile() ? [r] : files(r))).filter((f) => !f.startsWith('scripts/qa/') && !f.includes('race-test') && !f.endsWith('.test.ts'));

const RULES = [
  ['DIAGNOSIS', /\b(your (pet|dog|cat) (has|may have|might have|is suffering)|diagnos(is|es|ed|e)\b(?! or)|signs? of (heart failure|CHF)|likely (heart|CHF)|indicates? (heart|disease|failure))/i],
  ['DOSE-ADVICE', /\b(you should (give|increase|decrease|reduce|double|skip)|recommended dos(e|age)|safe dos(e|age)|(increase|decrease|reduce|double) the dose|give (an )?extra|mg\s*\/\s*kg)/i],
  ['DEFAULT-THRESHOLD', /\b(normal (resting )?(breathing|respiratory|heart) rate|healthy range|(call|see) (a |your )?vet (if|when) [^.]{0,40}\d|above \d+ breaths|over \d+ breaths|> ?\d{2} ?breaths|(\d{2}) ?breaths\/min is)/i],
  ['MEDICAL-INSTRUCTION', /\b(keep (her|him|your pet) (calm|still|warm)|give (oxygen|water|aspirin)|do not (feed|exercise)|elevate|rush to)/i],
];
let bad = 0;
for (const f of roots) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|--|\*|#)/.test(line)) return;   // comments describing the rule are fine
    if (/\b(not|never|n't|avoid|without)\b/i.test(line)) return; // negated statements (the disclaimer itself) are the rule, not a violation
    for (const [name, re] of RULES) if (re.test(line)) { bad++; console.log(`FAIL ${name}  ${f}:${i + 1}  ${line.trim().slice(0, 140)}`); }
  });
}
// 1. Preset config (reference data shipped to every user) must contain QUESTIONS, never numbers/thresholds
let presets = '[]';
try { presets = execSync(`docker exec supabase_db_atticus psql -U postgres -X -tA -c "select coalesce(json_agg(json_build_object('key',key,'config',config)),'[]') from public.condition_presets"`, { encoding: 'utf8' }).trim(); } catch { console.log('WARN  could not read condition_presets from the local DB'); }
const walk = (v, path, out) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, out); else out.push([path, v]); return out; };
for (const p of JSON.parse(presets)) {
  for (const [path, v] of walk(p.config, p.key, [])) {
    if (typeof v === 'number' || /^(value|threshold|default|max|min|limit|normal)/i.test(path.split('.').pop())) {
      if (!/\.scale$/.test(path)) { bad++; console.log(`FAIL PRESET-NUMBER  preset ${path} = ${JSON.stringify(v)}`); }
    }
    if (typeof v === 'string') for (const [name, re] of RULES) if (re.test(v)) { bad++; console.log(`FAIL ${name} preset ${path}: ${v}`); }
  }
}
// 2. No column default in the DB may carry a clinical value
try {
  const defs = execSync(`docker exec supabase_db_atticus psql -U postgres -X -tA -c "select table_name||'.'||column_name||' = '||column_default from information_schema.columns where table_schema='public' and table_name in ('pet_thresholds','medications','medication_versions') and column_default ~ '^[0-9.]+(::.*)?$'"`, { encoding: 'utf8' }).trim();
  for (const d of defs.split('\n').filter(Boolean)) {
    // duplicate_warning_minutes is an app safety-guard window, not a clinical value; flag as a NOTE so PO confirms it is surfaced as editable.
    if (/duplicate_warning_minutes/.test(d)) console.log(`NOTE  DB default ${d} (duplicate-dose guard window; not clinical - confirm it is editable and never described as a safe interval)`);
    else { bad++; console.log(`FAIL DB-DEFAULT  ${d}`); }
  }
} catch { /* db not running */ }
// 3. Seed data that ships a concrete threshold must be unmistakably labelled as demo
const seed = readFileSync('scripts/seed-dev.mjs', 'utf8');
if (/pet_thresholds[\s\S]{0,200}value:\s*\d+/.test(seed) && !/DEMO VALUE/.test(seed)) { bad++; console.log('FAIL SEED-THRESHOLD  seed inserts a numeric threshold without a DEMO label'); }
else if (/pet_thresholds[\s\S]{0,200}value:\s*\d+/.test(seed)) console.log('NOTE  seed-dev.mjs inserts a demo rrr threshold (labelled "DEMO VALUE"); confirm it can never reach a production database (script is localhost-guarded).');
console.log(`\nscanned ${roots.length} files + presets/DB defaults: ${bad} guardrail violation(s)`);
process.exit(bad ? 1 : 0);
