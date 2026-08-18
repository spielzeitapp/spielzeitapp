/**
 * MANAGER-PLATZ.7 — static guards for create/manage occupancy in Manager.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const page = read('src/manager/ManagerPlatzbelegungPage.tsx');
const modal = read('src/manager/CreateOccupancyModal.tsx');
const createLib = read('src/lib/createFacilityOccupancy.ts');

// 1) Create button visible in Manager
assert.ok(page.includes('Belegung anlegen'), 'header CTA "+ Belegung anlegen" missing');
assert.ok(page.includes("from 'lucide-react'") || page.includes('Plus'), 'Plus icon import');
assert.ok(page.includes('<CreateOccupancyModal'), 'CreateOccupancyModal must be mounted');
assert.ok(page.includes('onCreateForDay'), 'calendar day → create wiring');

// 2) Create path: event then assignment + rollback
assert.ok(createLib.includes('createFacilityOccupancy'), 'createFacilityOccupancy export');
assert.ok(createLib.includes("from('events')"), 'creates event');
assert.ok(createLib.includes('upsertEventFieldAssignment'), 'creates assignment');
assert.ok(
  /delete\(\)\s*\.eq\('id',\s*eventId\)/.test(createLib) || createLib.includes(".delete().eq('id', eventId)"),
  'rollback delete event on assignment failure',
);
assert.ok(createLib.includes('rolledBack'), 'rolledBack flag');
assert.ok(createLib.includes('findAssignmentConflicts') || createLib.includes('checkOccupancyConflicts'));
assert.ok(createLib.includes("type AttendanceMode = 'opt_in' | 'opt_out'"), 'attendance mode type narrowed');
assert.ok(createLib.includes('getOccupancyAttendanceMode'), 'occupancy attendance mode helper');
assert.ok(!createLib.includes("attendance_mode: 'optional'"), 'invalid attendance mode removed');
assert.ok(createLib.includes('attendance_mode: getOccupancyAttendanceMode(input.kind)'), 'occupancy uses normalized attendance mode');
assert.ok(createLib.includes("return 'opt_in';"), 'existing valid default reused for occupancies');
assert.ok(createLib.includes('toUserFacingCreateError'), 'friendly create error mapper present');
assert.ok(
  createLib.includes("Termin konnte nicht angelegt werden. Bitte erneut versuchen."),
  'friendly constraint error message present',
);

// 3) Purpose grants
assert.ok(createLib.includes("kind === 'match' ? 'home_match' : 'training'"));
assert.ok(createLib.includes('listAllowedVenueRowsForPurpose'));
assert.ok(modal.includes("occupancyPurposeForKind(kind)"));
assert.ok(modal.includes('Heimspiel'));
assert.ok(modal.includes('Training'));
assert.ok(modal.includes('Turnier'));
assert.ok(modal.includes('Sonstige Belegung'));
assert.ok(modal.includes('Belegung prüfen'));
assert.ok(modal.includes('Speichern'));
assert.ok(modal.includes('saving') && modal.includes('disabled={saving'));
assert.ok(modal.includes('if (saving) return;'), 'double click guard keeps working');

// 4) No away matches in create dialog
assert.ok(modal.includes('Auswärtsspiele gehören nicht hierher'));
assert.ok(!/is_home:\s*false/.test(createLib));
assert.ok(createLib.includes('is_home: eventKind === \'match\' ? true : null'));

// 5) Foreign stay read-only
assert.ok(page.includes('Nur ansehen'));
assert.ok(page.includes('canManage') && page.includes('Belegung bearbeiten'));

// 6) Edit syncs event title / time
assert.ok(page.includes('titleDraft'));
assert.ok(page.includes("from('events').update(eventPatch)"));

// 7) No new serverless API under api/ (cap 12 excl. helpers)
const apiDir = path.join(root, 'api');
function listApiEndpoints(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '_lib') continue;
      listApiEndpoints(p, acc);
    } else if (/\.(js|ts)$/.test(ent.name) && !ent.name.startsWith('_')) {
      acc.push(path.relative(apiDir, p).replace(/\\/g, '/'));
    }
  }
  return acc;
}
const apiFiles = listApiEndpoints(apiDir);
assert.ok(apiFiles.length <= 12, `expected ≤12 api endpoints, got ${apiFiles.length}: ${apiFiles.join(', ')}`);
assert.ok(!apiFiles.some((f) => /occupancy|platz|venue-assign/i.test(f)), 'must not add occupancy serverless endpoint');

// 8) App / demo surfaces untouched by this feature string
const demoHits = [];
for (const rel of ['src/pages/DemoPage.tsx', 'src/App.tsx', 'src/main.tsx']) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  if (src.includes('CreateOccupancyModal') || src.includes('createFacilityOccupancy')) {
    demoHits.push(rel);
  }
}
assert.deepEqual(demoHits, [], `app/demo must not import create occupancy: ${demoHits.join(', ')}`);

console.log('manager-platz7-create-occupancy-test: OK');
