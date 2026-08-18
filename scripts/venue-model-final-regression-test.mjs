import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const seasonLifecycle = read('src/lib/seasonLifecycle.ts');
const activeTeamSeasonHook = read('src/hooks/useActiveTeamSeason.ts');
const managerHeader = read('src/manager/components/ManagerHeader.tsx');
const managerFacility = read('src/manager/ManagerPlatzbelegungPage.tsx');
const createModal = read('src/app/components/CreateEventModal.tsx');
const eventDetail = read('src/pages/EventDetailPage.tsx');
const schedulePage = read('src/pages/SchedulePage.tsx');
const stagingScript = read('scripts/venue-model-final-staging-grants.mjs');

assert.ok(seasonLifecycle.includes('formatTeamSeasonContextLabel'), 'context label helper missing');
assert.ok(seasonLifecycle.includes('clubNameWithoutAgeGroup'), 'club cleanup helper must stay central');
assert.ok(
  seasonLifecycle.includes("[club, age, season && season !== '—' ? season : ''].filter(Boolean).join(' · ')"),
  'context order must be club · age · season',
);

assert.ok(activeTeamSeasonHook.includes('formatTeamSeasonContextLabel'), 'active team season hook must use context helper');
assert.ok(managerHeader.includes('formatTeamSeasonContextLabel'), 'manager header must use context helper');
assert.ok(managerFacility.includes('formatTeamSeasonContextLabel'), 'manager facility labels must use context helper');

assert.ok(createModal.includes("eventTypeLocal === 'game' && form.is_home"), 'home match assignment missing in create modal');
assert.ok(createModal.includes('useExternalLocation'), 'external location toggle missing in create modal');
assert.ok(createModal.includes('TrainingFacilityFields'), 'facility picker missing in create modal');
assert.ok(createModal.includes('upsertEventFieldAssignment'), 'create modal must write assignments');

for (const src of [eventDetail, schedulePage]) {
  assert.ok(src.includes('getAssignmentForEvent'), 'edit path must load assignment');
  assert.ok(src.includes('upsertEventFieldAssignment'), 'edit path must upsert assignment');
  assert.ok(src.includes('deleteEventFieldAssignment'), 'edit path must remove assignment');
  assert.ok(src.includes('TrainingFacilityFields'), 'edit path must offer field selection');
  assert.ok(src.includes('editUseExternalLocation'), 'edit path must support external location');
}

assert.ok(stagingScript.includes("const STAGING_REF = 'acbaecjzoabafbsjrzvr'"), 'staging ref guard missing');
assert.ok(stagingScript.includes("purpose: 'home_match', sort_order: 11"), 'NSG St. Veit home_match grant missing');
assert.ok(stagingScript.includes("const USC_CLUB_NAME = 'USC Rohrbach'"), 'USC staging guard missing');
assert.ok(stagingScript.includes('hardStops.push'), 'staging script must stop on duplicates');

console.log('venue-model-final-regression-test: OK');
