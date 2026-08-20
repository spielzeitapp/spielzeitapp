/**
 * APP-PLATZ.2 – Freien Zeitraum direkt belegen (static + helper guards).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const page = read('src/pages/AppPlatzbelegungPage.tsx');
const modal = read('src/components/platz/AppCreateOccupancyModal.tsx');
const createLib = read('src/lib/createFacilityOccupancy.ts');
const appPlatz1 = read('scripts/app-platz1-test.mjs');

// Free-tap opens create flow
assert.ok(page.includes('AppCreateOccupancyModal'), 'create modal wired');
assert.ok(page.includes('openFreeSlot'), 'free slot handler missing');
assert.ok(page.includes('setCreatePrefill'), 'create prefill missing');
assert.ok(page.includes('canCreateOccupancy'), 'create permission gate missing');

// Prefill + 90 minutes
assert.ok(modal.includes('occupancyEndLocalFromStart'), '90min helper missing');
assert.ok(modal.includes('90 * 60 * 1000'), '90 minute duration missing');
assert.ok(modal.includes('props.prefill.venueId'), 'venue prefill missing');
assert.ok(modal.includes('props.prefill.fieldId'), 'field prefill missing');
assert.ok(modal.includes('props.prefill.startMs'), 'start prefill missing');

// Training / home_match grants only; no away
assert.ok(modal.includes("value: 'training'") || modal.includes("value: 'training'"), 'training kind');
assert.ok(modal.includes("'match'") && modal.includes('Heimspiel'), 'home match kind');
assert.ok(!/Auswärts|away|is_home:\s*false/.test(modal), 'away must not be offered');
assert.ok(!modal.includes("value=\"tournament\""), 'tournament not in app dialog');
assert.ok(modal.includes('listVenuesForOccupancyCreate'), 'grant-filtered venues');
assert.ok(modal.includes('occupancyPurposeForKind'), 'purpose from kind');

// Split demands + pitch
assert.ok(modal.includes('half') || modal.includes("'half'"), 'half demand');
assert.ok(modal.includes('FacilityFieldPitch'), 'pitch picker');
assert.ok(modal.includes('SPLIT_DEMAND_LABELS'), 'split labels');

// Conflicts + double-click + keep form
assert.ok(modal.includes('checkOccupancyConflicts'), 'conflict check');
assert.ok(modal.includes('if (saving || checking) return'), 'double-click guard');
assert.ok(modal.includes('createFacilityOccupancy'), 'shared create path');
assert.ok(modal.includes('setSaving(false)'), 'keeps dialog on error');

// Rollback path in shared lib
assert.ok(createLib.includes(".delete().eq('id', eventId)"), 'event rollback on assign fail');
assert.ok(createLib.includes('rolledBack'), 'rolledBack flag');
assert.ok(createLib.includes('assertVenuePurposeAllowed'), 'server grant assert');
assert.ok(createLib.includes('assertTeamSeasonWritable'), 'writable season assert');

// Success reloads day view
assert.ok(page.includes('await reload()'), 'reload after create');

// No migration
assert.ok(!fs.existsSync(path.join(root, 'supabase/migrations/APP_PLATZ_2')), 'no new migration folder');
const migNames = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((f) => /platz.?2|app.?platz.?2/i.test(f));
assert.strictEqual(migNames.length, 0, 'no APP-PLATZ.2 migration files');

// APP-PLATZ.1 still has free hint fallback for non-writers
assert.ok(page.includes('Dieser Zeitraum ist frei.'), 'read-only free hint remains');

console.log('app-platz2-test: OK');
