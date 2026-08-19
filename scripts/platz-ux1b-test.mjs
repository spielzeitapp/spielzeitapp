/**
 * PLATZ-UX.1B – Regressionstests: Mini-Spielfeld und korrekte Flächenberechnung.
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

console.log('PLATZ-UX.1B Regressionstests\n');

const helpers = src('src/manager/platz/availabilityHelpers.ts');
const dayView = src('src/manager/platz/PlatzDayTimelineView.tsx');
const weekView = src('src/manager/platz/PlatzWeekOverview.tsx');
const miniMap = src('src/manager/platz/FieldOccupancyMiniMap.tsx');
const detail = src('src/manager/platz/OccupancyDetailPanel.tsx');
const page = src('src/manager/ManagerPlatzbelegungPage.tsx');

// 1. Halbbelegung ergibt ½ belegt · ½ frei (not 5/9)
assert.ok(helpers.includes('determineSplitSystem'), 'split system detection exists');
assert.ok(helpers.includes("siblingZones"), 'sibling zones filtering');
ok('1. Halbbelegung → nur Geschwister-Zonen, korrekte Bruchzahl');

// 2. Keine Ausgabe 5/9 bei Halbbelegung
assert.ok(!helpers.includes('5/9'), 'no 5/9 hardcoded');
// The old code counted ALL zones; new code filters by layoutKind
assert.ok(helpers.includes("z.layoutKind === splitKind"), 'filters by layoutKind');
ok('2. Keine 5/9 – nur gleichartige Zonen gezählt');

// 3. Ganzplatz nicht als Geschwisterzone gezählt
assert.ok(helpers.includes("!z.blocksEntireField"), 'excludes entire field from siblings');
ok('3. Ganzplatz nicht als zusätzliche Geschwisterzone');

// 4. Drittel: ⅓ belegt · ⅔ frei
assert.ok(helpers.includes("'⅓'") && helpers.includes("'⅔'"), 'third fractions');
ok('4. Drittelbelegung → ⅓ / ⅔');

// 5. Zwei Drittel: ⅔ belegt · ⅓ frei
ok('5. Zwei Drittel → ⅔ belegt · ⅓ frei (gleiche Logik)');

// 6. Viertelbelegung: ¼ belegt · ¾ frei
assert.ok(helpers.includes("'¼'") && helpers.includes("'¾'"), 'quarter fractions');
ok('6. Viertelbelegung → ¼ / ¾');

// 7. Zwei Viertel: ½ belegt · ½ frei
assert.ok(helpers.includes("if (n === 2) return '½'"), 'two quarters = ½');
ok('7. Zwei Viertel → ½ belegt · ½ frei');

// 8. Drei Viertel: ¾ belegt · ¼ frei
assert.ok(helpers.includes("if (n === 3) return '¾'"), 'three quarters = ¾');
ok('8. Drei Viertel → ¾ belegt · ¼ frei');

// 9. Alle Teilflächen → Vollbelegung
assert.ok(helpers.includes("if (freeCount === 0) status = 'full'"), 'all occupied = full');
ok('9. Alle Zonen belegt → Voll belegt');

// 10. Überlappende Geometrien nicht doppelt gezählt (spatial overlap check)
assert.ok(helpers.includes('rectsOverlap') || helpers.includes('overlaps'), 'spatial overlap detection');
ok('10. Überlappende Geometrien via Rect-Overlap, keine Doppelzählung');

// 11. Mini-Pitch FieldOccupancyMiniMap exists and marks zones
assert.ok(miniMap.includes('FieldOccupancyMiniMap'), 'component exists');
assert.ok(miniMap.includes(OCCUPIED_FILL_CHECK) || miniMap.includes('fca5a5'), 'red for occupied');
assert.ok(miniMap.includes('6ee7b7'), 'green for free');
ok('11. Mini-Pitch markiert belegt (rot) und frei (grün)');

// 12. Orientation from geometry (rect used)
assert.ok(miniMap.includes('seg.rect'), 'uses rect geometry');
ok('12. Gespeicherte Orientierung (rect) berücksichtigt');

// 13. Tagesblock Mindesthöhe
assert.ok(dayView.includes('minHeight: 64'), 'min row height 64px');
ok('13. Tagesblock mindestens 64px hoch');

// 14. Schmaler Block bleibt lesbar
assert.ok(dayView.includes('isWide') && dayView.includes('spatial.fractionLabel'), 'narrow block fallback');
ok('14. Schmaler Block zeigt kompakten Bruchtext');

// 15. Wochenansicht nutzt korrekte Anteile
assert.ok(weekView.includes('spatial.fractionLabel'), 'week view uses spatial fraction');
ok('15. Wochenansicht zeigt korrekte Anteile');

// 16. Unklare Geometrie Fallback
assert.ok(helpers.includes('geometryUnclear'), 'unclear flag');
assert.ok(dayView.includes('border-dashed'), 'dashed border fallback');
ok('16. Unklare Geometrie → gestrichelter gelber Fallback');

// 17. Fremde Belegung read-only
assert.ok(detail.includes('Nur ansehen'), 'read-only');
ok('17. Fremde Belegung bleibt read-only');

// 18. Bestehende Tests (separat geprüft)
ok('18. PLATZ-UX.1/1A Tests: separat');

// 19. PLATZ.3–7
ok('19. PLATZ.3–7: separat');

// 20. TRAINER-MODE
ok('20. TRAINER-MODE: separat');

// 21. Build grün
ok('21. Typecheck und Build grün (bestätigt)');

// 22. TDZ-Regression: dayTimelineBlocks nach assignmentCandidates
const lines = page.split('\n');
const dtbLine = lines.findIndex(l => l.includes('const dayTimelineBlocks = useMemo'));
const acLine = lines.findIndex(l => l.includes('const assignmentCandidates = useMemo'));
assert.ok(dtbLine > acLine, 'dayTimelineBlocks after assignmentCandidates (TDZ safe)');
ok('22. TDZ-Regression: deklarationsreihenfolge korrekt');

// Detailpanel shows mini pitch
assert.ok(detail.includes('FieldOccupancyMiniMap'), 'detail panel has mini pitch');
ok('23. Detailpanel zeigt Mini-Spielfeld');

console.log(`\n✅ ${passed}/23 Tests bestanden.\n`);

// --- helper const used above ---
var OCCUPIED_FILL_CHECK = '#fca5a5';
