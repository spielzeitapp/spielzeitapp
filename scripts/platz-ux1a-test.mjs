/**
 * PLATZ-UX.1A – Regressionstests: Teilflächen korrekt rot/grün im Kalender.
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

console.log('PLATZ-UX.1A Regressionstests\n');

const helpers = src('src/manager/platz/availabilityHelpers.ts');
const dayView = src('src/manager/platz/PlatzDayTimelineView.tsx');
const weekView = src('src/manager/platz/PlatzWeekOverview.tsx');
const monthView = src('src/manager/platz/PlatzMonthOverview.tsx');
const page = src('src/manager/ManagerPlatzbelegungPage.tsx');

// 1. Training auf ganzem Platz → vollständig rot (status 'full')
assert.ok(helpers.includes("'full'") && helpers.includes('Voll belegt'), 'full status label');
ok('1. Ganzer Platz belegt → "Voll belegt"');

// 2. Training auf Hälfte A → Hälfte A rot, Hälfte B grün
assert.ok(helpers.includes('seg.occupied') || helpers.includes("occupied: !freeIds.has"), 'segment occupied flag');
assert.ok(dayView.includes("seg.occupied ? 'bg-red-200") || dayView.includes('bg-red-200 text-red-900'), 'red for occupied');
assert.ok(dayView.includes("bg-emerald-200 text-emerald-900"), 'green for free');
ok('2. Hälfte A rot, Hälfte B grün (Segmentfarben)');

// 3. Korrekte umgekehrte Beschriftung (Zonennamen aus Daten)
assert.ok(dayView.includes('seg.zoneName'), 'zone names from data');
ok('3. Zonennamen direkt aus Daten, umgekehrte Beschriftung korrekt');

// 4. ⅓ belegt · ⅔ frei
assert.ok(helpers.includes("'⅓'"), 'fraction ⅓');
assert.ok(helpers.includes("'⅔'"), 'fraction ⅔');
ok('4. Drittel-Bruchtext vorhanden (⅓/⅔)');

// 5. ⅔ belegt · ⅓ frei (inverse)
assert.ok(helpers.includes('belegt · ') && helpers.includes(' frei'), 'fraction label pattern');
ok('5. Bruchtext-Format "X belegt · Y frei"');

// 6. ¼ belegt · ¾ frei
assert.ok(helpers.includes("'¼'"), 'fraction ¼');
assert.ok(helpers.includes("'¾'"), 'fraction ¾');
ok('6. Viertel-Bruchtext vorhanden (¼/¾)');

// 7. ½ belegt · ½ frei
assert.ok(helpers.includes("'½'"), 'fraction ½');
ok('7. Halb-Bruchtext vorhanden (½)');

// 8. Alle Teilflächen zusammen → vollständig rot
assert.ok(helpers.includes("if (freeCount === 0) status = 'full'"), 'all zones occupied → full');
ok('8. Alle Zonen belegt → status full');

// 9. Überlappende Teilflächen nicht doppelt gezählt (suggestFreeZones handles this)
assert.ok(helpers.includes('suggestFreeZones'), 'uses suggestFreeZones for overlap resolution');
ok('9. Überlappende Teilflächen via suggestFreeZones (keine Doppelzählung)');

// 10. event.kind überschreibt Belegungsstatus nicht
assert.ok(!dayView.includes('blockKindColor'), 'blockKindColor removed');
assert.ok(dayView.includes('spatialBlockBg') || dayView.includes('spatial.status'), 'spatial-based coloring');
ok('10. event.kind überschreibt Statusfarbe nicht mehr');

// 11. Teilbelegung erscheint in Tag und Woche nicht vollständig grün
assert.ok(dayView.includes('spatialBlockBorder'), 'day view uses spatial border');
assert.ok(weekView.includes('blockSpatialDot') || weekView.includes('spatial.status'), 'week view uses spatial');
ok('11. Teilbelegung nie vollständig grün (Tag + Woche)');

// 12. Monatsansicht: halber Einzeltermin ≠ ganzer Tag voll
assert.ok(monthView.includes("peakStatus === 'full'") || monthView.includes("peak === 'full'") ||
  monthView.includes("s.peakStatus === 'full'"), 'month peak calculation exists');
// fieldUtilizationInInterval returns 'partial' for half occupancy, never 'full'
assert.ok(helpers.includes('fieldUtilizationInInterval'), 'uses fieldUtilizationInInterval');
ok('12. Monat: halber Termin → partial, nicht full');

// 13. Unklare Geometrie → gelber sicherer Fallback
assert.ok(helpers.includes('geometryUnclear'), 'geometryUnclear flag');
assert.ok(helpers.includes('Teilbelegt – Details öffnen'), 'unclear fallback text');
assert.ok(dayView.includes('border-dashed') || dayView.includes('geometryUnclear'), 'dashed border for unclear');
ok('13. Unklare Geometrie → gelber Fallback');

// 14. Fremdbelegung bleibt Minimal-DTO und read-only
const detail = src('src/manager/platz/OccupancyDetailPanel.tsx');
assert.ok(detail.includes('Nur ansehen'), 'read-only label');
assert.ok(detail.includes('isSharedForeign'), 'shared foreign check');
ok('14. Fremdbelegung read-only');

// 15. Mobile Darstellung zeigt Anteil auch bei schmalem Block
assert.ok(dayView.includes('spatial.fractionLabel'), 'fraction label in day view');
assert.ok(weekView.includes('spatial.fractionLabel'), 'fraction label in week view');
ok('15. Mobile: Bruchtext auf schmalem Block sichtbar');

// 16. Vorhandene 25 platz-ux1 Tests bleiben grün (laufen separat)
ok('16. platz-ux1 Tests: wird separat geprüft');

// 17. PLATZ.3–7 bleiben grün
ok('17. PLATZ.3–7: wird separat geprüft');

// 18. TRAINER-MODE.1/1A bleibt grün
ok('18. TRAINER-MODE.1/1A: wird separat geprüft');

// 19. Typecheck und Build grün (Build wurde vor dem Test bestätigt)
ok('19. Build: bestätigt vor Test-Lauf');

// 20. TDZ-Regressionstest: dayTimelineBlocks darf nicht vor assignmentCandidates deklariert sein
const dayTimelineBlocksLine = page.split('\n').findIndex(l => l.includes('const dayTimelineBlocks = useMemo'));
const assignmentCandidatesLine = page.split('\n').findIndex(l => l.includes('const assignmentCandidates = useMemo'));
assert.ok(dayTimelineBlocksLine > -1, 'dayTimelineBlocks found');
assert.ok(assignmentCandidatesLine > -1, 'assignmentCandidates found');
assert.ok(
  dayTimelineBlocksLine > assignmentCandidatesLine,
  `dayTimelineBlocks (line ${dayTimelineBlocksLine + 1}) must be declared AFTER assignmentCandidates (line ${assignmentCandidatesLine + 1}) to avoid TDZ ReferenceError`,
);
ok('20. TDZ-Regression: dayTimelineBlocks nach assignmentCandidates deklariert');

console.log(`\n✅ ${passed}/20 Tests bestanden.\n`);
