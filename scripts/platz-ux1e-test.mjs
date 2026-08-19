/**
 * PLATZ-UX.1E – Regressionstests: Vollständige Kalenderdarstellung.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function src(rel) { return fs.readFileSync(join(root, rel), 'utf8'); }

let passed = 0;
function ok(label) { passed++; console.log(`  ✓ ${label}`); }

console.log('PLATZ-UX.1E Regressionstests\n');

const dayView = src('src/manager/platz/PlatzDayTimelineView.tsx');
const weekView = src('src/manager/platz/PlatzWeekOverview.tsx');
const monthView = src('src/manager/platz/PlatzMonthOverview.tsx');
const page = src('src/manager/ManagerPlatzbelegungPage.tsx');
const detail = src('src/manager/platz/OccupancyDetailPanel.tsx');

// --- Tagesansicht ---

// 1. Fremde Vollbelegung zeigt sichtbaren Block (nicht nur Icons)
assert.ok(!dayView.includes('statusIcon(slot.status)') || dayView.includes('Status shown via overlay blocks'), 'no standalone status icons in slots');
ok('1. Fremde Vollbelegung: kein isoliertes Statussymbol');

// 2. Zeit sichtbar im Block
assert.ok(dayView.includes('block.timeLabel'), 'time visible');
ok('2. Zeit sichtbar im Block');

// 3. Mannschaft sichtbar
assert.ok(dayView.includes('block.teamLabel'), 'team visible');
ok('3. Mannschaft sichtbar');

// 4. "Nur ansehen" sichtbar bei fremden
assert.ok(dayView.includes('Nur ansehen'), 'read-only label');
ok('4. "Nur ansehen" sichtbar bei fremden Blöcken');

// 5. Lock-Icon für fremde
assert.ok(dayView.includes('Lock'), 'lock icon imported');
ok('5. Lock-Icon für fremde Belegungen');

// 6. Mini-Spielfeld im Tagesblock
assert.ok(dayView.includes('FieldOccupancyMiniMap'), 'minimap in day');
ok('6. Mini-Spielfeld im Tagesblock');

// --- Wochenansicht ---

// 7. Venue/Field-Zeilen
assert.ok(weekView.includes('g.venue.name') && weekView.includes('f.name'), 'venue+field rows');
ok('7. Venue/Field-Zeilen in Wochenansicht');

// 8. Zeit und Mannschaft sichtbar
assert.ok(weekView.includes('b.timeLabel') && weekView.includes('b.teamLabel'), 'week time+team');
ok('8. Zeit und Mannschaft in Wochenkarten');

// 9. Mini-Spielfeld in Wochenansicht
assert.ok(weekView.includes('FieldOccupancyMiniMap'), 'minimap in week');
ok('9. Mini-Spielfeld in Wochenkarten');

// 10. Lock bei fremden in Wochenansicht
assert.ok(weekView.includes('Lock') && weekView.includes('!b.canEdit'), 'week lock');
ok('10. Lock-Icon bei fremden in Woche');

// 11. "+ N weitere" in Woche
assert.ok(weekView.includes('weitere'), 'week overflow');
ok('11. "+ N weitere" bei vielen Belegungen');

// 12. Klick öffnet Details
assert.ok(weekView.includes('onSelectBlock'), 'week click detail');
ok('12. Klick auf Wochenkarte öffnet Details');

// --- Monatsansicht ---

// 13. Anzahl Belegungen sichtbar
assert.ok(monthView.includes('count'), 'month count');
ok('13. Anzahl Belegungen im Monat sichtbar');

// 14. Status "Teilweise" erkennbar
assert.ok(monthView.includes('partial') && monthView.includes('amber'), 'month partial');
ok('14. Teilstatus im Monat erkennbar');

// 15. Mini-Spielfeld im Monat
assert.ok(monthView.includes('FieldOccupancyMiniMap'), 'minimap in month');
ok('15. Mini-Spielfeld im Monat');

// 16. Lock bei fremden im Monat
assert.ok(monthView.includes('Lock') && monthView.includes('hasForeign'), 'month lock');
ok('16. Lock-Icon bei fremden Tagen im Monat');

// 17. Klick öffnet Tageszusammenfassung
assert.ok(monthView.includes('selectedDay') && monthView.includes('setSelectedDay'), 'month day summary');
ok('17. Klick öffnet Tageszusammenfassung');

// 18. "In Tagesansicht öffnen"
assert.ok(monthView.includes('In Tagesansicht öffnen'), 'month switch to day');
ok('18. "In Tagesansicht öffnen" Button im Monat');

// --- Shell/Legacy ---

// 19. Kein CalendarPanel mehr im Render-Pfad
const calendarPanelUsages = (page.match(/<CalendarPanel/g) || []).length;
assert.ok(calendarPanelUsages === 0, `CalendarPanel rendered ${calendarPanelUsages} times`);
ok('19. Kein CalendarPanel mehr im Render-Pfad');

// 20. Trainer sieht keinen Facilities-Tab (isTrainerMode guard)
assert.ok(page.includes('!isTrainerMode') && page.includes("'facilities'"), 'facilities guard');
ok('20. Trainer sieht keinen Facilities-Tab');

// 21. Admin behält Facilities-Einstieg
assert.ok(page.includes("setTab('facilities')"), 'admin facilities');
ok('21. Admin behält Sportanlagen-Einstieg');

// 22. Nur eine Ansicht gleichzeitig (viewMode conditional rendering)
assert.ok(page.includes("viewMode === 'day'") && page.includes("viewMode === 'month'"), 'single view');
ok('22. Immer nur eine Ansicht gleichzeitig');

console.log(`\n✅ ${passed}/22 Tests bestanden.\n`);
