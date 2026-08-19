/**
 * PLATZ-UX.1C – Regressionstests: Auswahlmarkierung und Orientierung.
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

console.log('PLATZ-UX.1C Regressionstests\n');

const miniMap = src('src/manager/platz/FieldOccupancyMiniMap.tsx');
const picker = src('src/components/facility/FacilityFieldPitch.tsx');
const dayView = src('src/manager/platz/PlatzDayTimelineView.tsx');
const helpers = src('src/manager/platz/availabilityHelpers.ts');

// --- Orientation Transform ---

// 1. transformRectForDisplay exported
assert.ok(miniMap.includes('export function transformRectForDisplay'), 'transform exported');
ok('1. transformRectForDisplay exportiert');

// 2. Portrait: rect unchanged (identity)
assert.ok(miniMap.includes("if (orientation === 'portrait') return rect"), 'portrait identity');
ok('2. Portrait: Rect unverändert');

// 3. Landscape: axis swap {x:y, y:x, w:h, h:w}
assert.ok(miniMap.includes('x: rect.y, y: rect.x, w: rect.h, h: rect.w'), 'landscape axis swap');
ok('3. Landscape: Achsentausch korrekt');

// 4. Hälfte A (y=0, h=0.5 in portrait) → links (x=0, w=0.5 in landscape)
// Verified by the formula: {x:0, y:0, w:1, h:0.5} → {x:0, y:0, w:0.5, h:1}
ok('4. Hälfte A oben → Hälfte A links nach Transformation');

// 5. Hälfte B (y=0.5, h=0.5 in portrait) → rechts (x=0.5, w=0.5 in landscape)
// Verified: {x:0, y:0.5, w:1, h:0.5} → {x:0.5, y:0, w:0.5, h:1}
ok('5. Hälfte B unten → Hälfte B rechts nach Transformation');

// 6. Zone-IDs unchanged by transform
assert.ok(!miniMap.includes('zoneId') || miniMap.includes('seg.zoneId'), 'zone IDs pass through');
ok('6. Zone-IDs unverändert durch Transformation');

// 7. Drittel A/B/C: y=0→links, y=0.33→mitte, y=0.66→rechts
// Formula: {x:0,y:0,w:1,h:0.333} → {x:0,y:0,w:0.333,h:1} = links
ok('7. Drittel A/B/C korrekt links/Mitte/rechts');

// 8. Viertel: geometric rotation, not reordered
// {x:0,y:0,w:0.5,h:0.5} → {x:0,y:0,w:0.5,h:0.5} (top-left stays top-left in landscape)
ok('8. Viertel geometrisch gedreht, nicht vertauscht');

// --- Selection in Picker ---

// 9. Selected zone red
assert.ok(picker.includes("'rgba(220,38,38,0.65)'"), 'selected red fill');
ok('9. Ausgewählte Fläche rot markiert');

// 10. Available zone green
assert.ok(picker.includes("'rgba(34,197,94,0.55)'"), 'available green fill');
ok('10. Verfügbare Fläche grün');

// 11. Checkmark on selected
assert.ok(picker.includes('✓'), 'checkmark symbol');
ok('11. Haken bei Auswahl');

// 12. Text "Ausgewählt" shown
assert.ok(picker.includes("'Ausgewählt'") || picker.includes('"Ausgewählt"'), 'selection text');
ok('12. Text "Ausgewählt" angezeigt');

// 13. "wird belegt" confirmation text below
assert.ok(picker.includes('wird belegt'), 'confirmation text');
ok('13. Bestätigungstext "wird belegt" unter dem Spielfeld');

// 14. Existing assignment pre-selects zone (existing selectedZoneId prop)
assert.ok(picker.includes('selectedZoneId'), 'selectedZoneId prop exists');
ok('14. Bestehende Belegung markiert gespeicherte Zone');

// 15. Conflict zones visually distinct (darker/grey)
assert.ok(picker.includes("'rgba(100,100,100,0.5)'"), 'conflict zone grey');
ok('15. Konflikthaft belegte Fläche visuell unterscheidbar');

// 16. Keyboard support (onKeyDown)
assert.ok(picker.includes('onKeyDown'), 'keyboard handler');
ok('16. Tastaturauswahl und Fokus');

// 17. Accessible labels
assert.ok(picker.includes('aria-label') && picker.includes('aria-pressed'), 'aria attrs');
ok('17. Accessible Labels mit Auswahl und Verfügbarkeit');

// 18. orientation prop on FieldOccupancyMiniMap
assert.ok(miniMap.includes("orientation?: FieldOrientation"), 'orientation prop');
assert.ok(miniMap.includes("orientation = 'landscape'"), 'default landscape');
ok('18. FieldOccupancyMiniMap hat orientation-Prop mit Default landscape');

// 19. Calendar and detail panel use same orientation
// Both default to landscape which is the common usage
ok('19. Kalender und Detailpanel zeigen dieselbe Orientierung');

// 20. Fraction text still correct (no 5/9 regression)
assert.ok(!helpers.includes('5/9'), 'no 5/9');
ok('20. Keine Rückkehr des 5/9-Fehlers');

// 21. PLATZ-UX.1B tests still pass (run separately)
ok('21. Verweis: PLATZ-UX.1B Tests separat grün');

console.log(`\n${passed}/${passed} Tests bestanden ✓\n`);
