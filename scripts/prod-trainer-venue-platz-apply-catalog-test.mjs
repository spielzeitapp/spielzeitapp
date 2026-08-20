/**
 * Catalog-column sanity for prod_trainer_venue_platz_apply.sql (Abschnitt A/G).
 * Verhindert 42703 durch falsche Systemkatalog-Spaltennamen (z. B. polname vs policyname).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = path.join(root, 'supabase/queries/prod_trainer_venue_platz_apply.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

assert.ok(sql.includes('FROM pg_policies'), 'pg_policies query missing');
assert.ok(
  /SELECT\s+policyname\s*,\s*tablename\s*\nFROM pg_policies/m.test(sql) ||
    /SELECT\s+policyname\s*,\s*tablename\s+FROM pg_policies/m.test(sql),
  'pg_policies must select policyname, tablename',
);
assert.ok(!/SELECT\s+polname\b/.test(sql), 'must not SELECT polname (use policyname on pg_policies)');
assert.ok(!/ORDER BY\s+[^\n]*\bpolname\b/.test(sql), 'must not ORDER BY polname on pg_policies');

// Stable catalog columns used in A/G preflight/postflight
const requiredSnippets = [
  'FROM pg_proc',
  'proname',
  'FROM pg_trigger',
  'tgname',
  'tgisinternal',
  'FROM pg_policies',
  'policyname',
  'tablename',
  'schemaname',
  'information_schema.columns',
  'to_regclass(',
];
for (const snip of requiredSnippets) {
  assert.ok(sql.includes(snip), `expected catalog usage missing: ${snip}`);
}

// No known wrong aliases for these views in A9 / G
assert.ok(!/\bpolname\b/.test(sql.split('BEGIN;')[0]), 'Abschnitt A must not reference polname');
const afterBegin = sql.split('BEGIN;').slice(1).join('BEGIN;');
const sectionG = afterBegin.includes('-- G. POSTFLIGHT')
  ? afterBegin.slice(afterBegin.indexOf('-- G. POSTFLIGHT'))
  : '';
assert.ok(!/\bpolname\b/.test(sectionG), 'Abschnitt G must not reference polname');

console.log('prod-trainer-venue-platz-apply-catalog-test: OK');
