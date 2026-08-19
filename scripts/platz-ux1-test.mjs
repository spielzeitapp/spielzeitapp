/**
 * PLATZ-UX.1 – Statische Regressionstests für den visuellen Verfügbarkeitskalender.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function src(rel) {
  return fs.readFileSync(join(root, rel), 'utf8');
}

let passed = 0;
function ok(label) { passed++; console.log(`  ✓ ${label}`); }

console.log('PLATZ-UX.1 Regressionstests\n');

// ── 1. availabilityHelpers.ts existiert und exportiert korrekt ──
const helpers = src('src/manager/platz/availabilityHelpers.ts');
assert.ok(helpers.includes('export function computeFieldSlotStatus'), 'computeFieldSlotStatus export');
ok('1. computeFieldSlotStatus export');
assert.ok(helpers.includes('export function computeFieldDaySlots'), 'computeFieldDaySlots export');
ok('2. computeFieldDaySlots export');
assert.ok(helpers.includes('export function computeVenueDaySummary'), 'computeVenueDaySummary export');
ok('3. computeVenueDaySummary export');
assert.ok(helpers.includes('export function computeFieldMonthSummary'), 'computeFieldMonthSummary export');
ok('4. computeFieldMonthSummary export');

// ── 2. Status-Typen vorhanden ──
assert.ok(helpers.includes("'free'"), 'free status');
assert.ok(helpers.includes("'partial'"), 'partial status');
assert.ok(helpers.includes("'full'"), 'full status');
ok('5. SlotStatus-Typen vorhanden (free/partial/full)');

// ── 3. fieldUtilizationInInterval-Delegation ──
assert.ok(helpers.includes('fieldUtilizationInInterval'), 'delegates to fieldUtilizationInInterval');
ok('6. Delegation an fieldUtilizationInInterval');

// ── 4. suggestFreeZones-Integration ──
assert.ok(helpers.includes('suggestFreeZones'), 'uses suggestFreeZones');
ok('7. suggestFreeZones-Integration für freie Teilflächen');

// ── 5. Quick-Info berechnet "Nächste Belegung um ..." ──
assert.ok(helpers.includes('Nächste Belegung um'), 'quick info label');
ok('8. Quick-Info "Nächste Belegung um ..."');

// ── 6. VIEW_STORAGE_KEY ──
assert.ok(helpers.includes('spielzeit_platz_view'), 'storage key');
ok('9. VIEW_STORAGE_KEY enthält spielzeit_platz_view');

// ── 7. PlatzDayTimelineView enthält Statusfarben und Jetzt-Linie ──
const dayView = src('src/manager/platz/PlatzDayTimelineView.tsx');
assert.ok(dayView.includes('bg-emerald'), 'green status color');
assert.ok(dayView.includes('bg-amber'), 'yellow status color');
assert.ok(dayView.includes('bg-red'), 'red status color');
ok('10. PlatzDayTimelineView Statusfarben (grün/gelb/rot)');
assert.ok(dayView.includes('Jetzt'), 'Now line');
ok('11. PlatzDayTimelineView Jetzt-Linie');

// ── 8. OccupancyDetailPanel enthält "Nur ansehen" ──
const detail = src('src/manager/platz/OccupancyDetailPanel.tsx');
assert.ok(detail.includes('Nur ansehen'), 'read-only label');
ok('12. OccupancyDetailPanel "Nur ansehen"');
assert.ok(detail.includes('Belegung bearbeiten'), 'edit button');
ok('13. OccupancyDetailPanel "Belegung bearbeiten"');

// ── 9. CreateOccupancyModal akzeptiert neue Props ──
const createModal = src('src/manager/CreateOccupancyModal.tsx');
assert.ok(createModal.includes('initialHour'), 'initialHour prop');
assert.ok(createModal.includes('initialVenueId'), 'initialVenueId prop');
assert.ok(createModal.includes('initialFieldId'), 'initialFieldId prop');
ok('14. CreateOccupancyModal neue Props (initialHour/VenueId/FieldId)');

// ── 10. PlatzWeekOverview existiert ──
const weekView = src('src/manager/platz/PlatzWeekOverview.tsx');
assert.ok(weekView.includes('PlatzWeekOverview'), 'week view export');
ok('15. PlatzWeekOverview existiert');

// ── 11. PlatzMonthOverview existiert ──
const monthView = src('src/manager/platz/PlatzMonthOverview.tsx');
assert.ok(monthView.includes('PlatzMonthOverview'), 'month view export');
ok('16. PlatzMonthOverview existiert');

// ── 12. Page-Integration: View-Switcher ──
const page = src('src/manager/ManagerPlatzbelegungPage.tsx');
assert.ok(page.includes("'day'") && page.includes("'week'") && page.includes("'month'"), 'view mode switcher');
ok('17. Page: View-Switcher Tag/Woche/Monat');
assert.ok(page.includes('PlatzDayTimelineView'), 'day view rendered');
ok('18. Page: PlatzDayTimelineView eingebunden');
assert.ok(page.includes('PlatzWeekOverview'), 'week view rendered');
ok('19. Page: PlatzWeekOverview eingebunden');
assert.ok(page.includes('PlatzMonthOverview'), 'month view rendered');
ok('20. Page: PlatzMonthOverview eingebunden');
assert.ok(page.includes('OccupancyDetailPanel'), 'detail panel rendered');
ok('21. Page: OccupancyDetailPanel eingebunden');

// ── 13. Accessibility ──
assert.ok(dayView.includes('aria-label'), 'aria-label on slots');
ok('22. Accessibility: aria-label auf Slots');
assert.ok(dayView.includes('tabIndex'), 'keyboard nav');
ok('23. Accessibility: Tastatur-Navigation');

// ── 14. Vienna-TZ-Integration ──
assert.ok(helpers.includes('VIENNA_TZ'), 'Vienna timezone used');
ok('24. Vienna-TZ-Integration');

// ── 15. Responsive Mobile-Ansicht ──
assert.ok(weekView.includes('lg:hidden') || weekView.includes('lg:block'), 'responsive breakpoints');
ok('25. Responsive Design (lg: Breakpoints)');

console.log(`\n✅ ${passed}/25 Tests bestanden.\n`);
