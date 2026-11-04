/**
 * Sanity for split Production SQL:
 * - preflight_only: read-only, READY/BLOCKED, no writes
 * - apply_only: transactional, field seed, no early hard field-missing guard
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const preflight = read('supabase/queries/prod_trainer_venue_platz_preflight_only.sql');
const applyOnly = read('supabase/queries/prod_trainer_venue_platz_apply_only.sql');

// Preflight: no writes / no transaction
assert.ok(!/\bBEGIN\s*;/.test(preflight), 'preflight must not BEGIN');
assert.ok(!/\bCOMMIT\s*;/.test(preflight), 'preflight must not COMMIT');
assert.ok(!/\bINSERT\b/i.test(preflight), 'preflight must not INSERT');
assert.ok(!/\bUPDATE\b/i.test(preflight), 'preflight must not UPDATE');
assert.ok(!/\bDELETE\b/i.test(preflight), 'preflight must not DELETE');
assert.ok(!/\bDO\s+\$\$/.test(preflight), 'preflight must not use DO blocks');
assert.ok(preflight.includes("'READY'"), 'preflight READY verdict missing');
assert.ok(preflight.includes("'BLOCKED'"), 'preflight BLOCKED verdict missing');
assert.ok(preflight.includes('missing_will_create'), 'expected field status missing');
assert.ok(preflight.includes('Hauptplatz/Matchplatz'), 'Rohrbach main expected');
assert.ok(preflight.includes('Trainingsplatz'), 'Rohrbach training expected');
assert.ok(preflight.includes('Kleiner Nebenplatz'), 'St.Veit side expected');
assert.ok(
  !/FROM\s+public\.team_season_training_venues\b/.test(preflight),
  'preflight must not FROM grant table (missing on live)',
);

// Apply-only: transaction + field seed + soft guard
assert.ok(/\bBEGIN\s*;/.test(applyOnly), 'apply_only needs BEGIN');
assert.ok(/\bCOMMIT\s*;/.test(applyOnly), 'apply_only needs COMMIT');
assert.ok(applyOnly.includes('FIELD-SEED OK'), 'field seed missing');
assert.ok(applyOnly.includes('INSERT INTO public.venue_fields'), 'field insert missing');
assert.ok(
  !applyOnly.includes('Rohrbach hat keinen aktiven Platz'),
  'old hard field guard must be removed',
);
assert.ok(
  applyOnly.includes('nicht automatisch reaktiviert'),
  'inactive field stop missing',
);
assert.ok(applyOnly.includes('ZONE-SEED: % neue Standardzonen'), 'insert-only zone seed missing');
assert.ok(
  !/SET\s+name = r\.zname/.test(applyOnly.split('ZONE-SEED')[1]?.split('LEGACY')[0] || ''),
  'zone seed must not UPDATE existing zones',
);
assert.ok(applyOnly.includes('POSTFLIGHT: events verändert'), 'events guard missing');
assert.ok(applyOnly.includes('U12-GRANTS OK'), 'u12 grants missing');

// Catalog columns if present
if (applyOnly.includes('FROM pg_policies')) {
  assert.ok(/SELECT\s+policyname\s*,\s*tablename/.test(applyOnly));
  assert.ok(!/SELECT\s+polname\b/.test(applyOnly));
}

console.log('prod-trainer-venue-platz-split-sql-test: OK');
