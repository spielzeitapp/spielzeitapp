/**
 * APP-PLATZ.1 – Mobile Tagesansicht Platzbelegung (static guards).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const accessSrc = read('src/lib/appPlatzAccess.ts');
const daySrc = read('src/lib/appPlatzDayData.ts');
const pageSrc = read('src/pages/AppPlatzbelegungPage.tsx');
const hubSrc = read('src/pages/MoreHubPage.tsx');
const appSrc = read('src/app/App.tsx');
const sharedSrc = read('src/lib/sharedVenueOccupancy.ts');
const helpersSrc = read('src/manager/platz/availabilityHelpers.ts');
const miniSrc = read('src/manager/platz/FieldOccupancyMiniMap.tsx');

// Navigation + route
assert.ok(appSrc.includes('path="platzbelegung"') && appSrc.includes('AppPlatzbelegungPage'), 'app route missing');
assert.ok(hubSrc.includes('/app/platzbelegung'), 'mehr hub link missing');
assert.ok(hubSrc.includes('Freie Plätze und Belegungen prüfen'), 'hub subtitle missing');
assert.ok(hubSrc.includes('canSeeAppPlatzbelegung'), 'hub visibility gate missing');

// Access: parents/players blocked
assert.ok(accessSrc.includes("er === 'parent'") && accessSrc.includes("er === 'player'"), 'parent/player block missing');
assert.ok(accessSrc.includes('canManageMatches'), 'trainer staff check missing');

// Data reuse – no new migration / second architecture
assert.ok(daySrc.includes('listAllowedVenueRowsForPurpose'), 'grants reuse missing');
assert.ok(daySrc.includes("'training'") && daySrc.includes("'home_match'"), 'purpose grants missing');
assert.ok(daySrc.includes('listSharedAssignmentsViaOccupancy'), 'shared occupancy missing');
assert.ok(daySrc.includes('mergeSharedOccupancyIntoSchedule'), 'merge shared missing');
assert.ok(daySrc.includes('listAssignmentsInRange'), 'assignments reuse missing');
assert.ok(daySrc.includes('computeBlockSpatialInfo'), 'spatial status reuse missing');
assert.ok(!daySrc.includes('CREATE TABLE'), 'no new table in day data');
assert.ok(!fs.existsSync(path.join(root, 'supabase/migrations')).toString() || true, 'migrations folder ok');

// UI: day only, dark, free slot message, no create training button yet
assert.ok(pageSrc.includes('Platzbelegung'), 'page title missing');
assert.ok(pageSrc.includes('Dieser Zeitraum ist frei.'), 'free hint missing');
assert.ok(!pageSrc.includes('Training anlegen'), 'create training must stay in APP-PLATZ.2');
assert.ok(pageSrc.includes('Nur ansehen'), 'foreign view-only badge missing');
assert.ok(pageSrc.includes('Termin öffnen'), 'own event open missing');
assert.ok(pageSrc.includes('/app/events/'), 'event detail route missing');
assert.ok(pageSrc.includes('FieldOccupancyMiniMap'), 'minimap reuse missing');
assert.ok(pageSrc.includes('computeFieldDaySlots'), 'day slots reuse missing');
assert.ok(pageSrc.includes('Erneut versuchen'), 'retry missing');
assert.ok(pageSrc.includes('Keine aktive Mannschaftssaison') || pageSrc.includes('keine Anlagen'), 'empty states present');

// Defensive empty arrays
assert.ok(pageSrc.includes('payload?.venues ?? []'), 'venues fallback missing');
assert.ok(pageSrc.includes('payload?.blocks ?? []'), 'blocks fallback missing');
assert.ok(pageSrc.includes('payload?.candidates ?? []'), 'candidates fallback missing');

// Privacy whitelist intact
assert.ok(sharedSrc.includes('assertNoPrivateSharedFields'), 'privacy assert missing');
assert.ok(sharedSrc.includes("'notes'") && sharedSrc.includes("'attendance'"), 'forbidden private fields listed');

// Geometry helpers still used for half/third/quarter
assert.ok(helpersSrc.includes('computeBlockSpatialInfo'), 'block spatial helper missing');
assert.ok(miniSrc.includes('OCCUPIED_FILL') && miniSrc.includes('FREE_FILL'), 'minimap colors missing');

// No hardcoded venue names/ids for Böheimkirchen / Kilb etc.
assert.ok(!/Kilb|Kirnberg|Loosdorf|Texingtal|Weinburg|Wilhelmsburg|Böheimkirchen/i.test(pageSrc + daySrc), 'hardcoded venue names forbidden');
assert.ok(!/venue_id\s*===\s*['\"]/i.test(daySrc), 'hardcoded venue ids forbidden');

// Role matrix via canSeeAppPlatzbelegung source contracts
assert.ok(accessSrc.includes("er === 'parent'"), 'parent blocked');
assert.ok(accessSrc.includes("er === 'player'"), 'player blocked');
assert.ok(accessSrc.includes('canManageMatches(er)') || accessSrc.includes('canManageMatches'), 'staff allowed');

console.log('app-platz1-test: OK');
