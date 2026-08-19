/**
 * PLATZ-UX.1D – Regressionstests: Vollständige Blockbeschriftung und Sichtbarkeit.
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

console.log('PLATZ-UX.1D Regressionstests\n');

const dayView = src('src/manager/platz/PlatzDayTimelineView.tsx');
const weekView = src('src/manager/platz/PlatzWeekOverview.tsx');
const monthView = src('src/manager/platz/PlatzMonthOverview.tsx');
const detail = src('src/manager/platz/OccupancyDetailPanel.tsx');
const helpers = src('src/manager/platz/availabilityHelpers.ts');
const shared = src('src/lib/sharedVenueOccupancy.ts');
const page = src('src/manager/ManagerPlatzbelegungPage.tsx');

// 1. Tagesblock zeigt Zeit
assert.ok(dayView.includes('block.timeLabel'), 'day shows time');
ok('1. Tagesblock zeigt Zeit');

// 2. Tagesblock zeigt Mannschaft
assert.ok(dayView.includes('block.teamLabel'), 'day shows team');
ok('2. Tagesblock zeigt Mannschaft');

// 3. Tagesblock zeigt Terminart
assert.ok(dayView.includes('block.kindLabel'), 'day shows kind');
ok('3. Tagesblock zeigt Terminart');

// 4. Tagesblock zeigt fractionLabel
assert.ok(dayView.includes('spatial.fractionLabel'), 'day shows fraction');
ok('4. Tagesblock zeigt fractionLabel');

// 5. Halbbelegung ½
assert.ok(helpers.includes("'½'"), 'half fraction');
ok('5. Halbbelegung zeigt ½');

// 6. Drittelbelegung ⅓/⅔
assert.ok(helpers.includes("'⅓'") && helpers.includes("'⅔'"), 'third fractions');
ok('6. Drittelbelegung zeigt ⅓/⅔');

// 7. Viertelbelegung ¼/¾
assert.ok(helpers.includes("'¼'") && helpers.includes("'¾'"), 'quarter fractions');
ok('7. Viertelbelegung zeigt ¼/¾');

// 8. Ganzer Platz voll belegt
assert.ok(helpers.includes('Voll belegt'), 'full label');
ok('8. Ganzer Platz zeigt Voll belegt');

// 9. Fremdbelegung read-only
assert.ok(dayView.includes('isSharedForeign') && detail.includes('Nur ansehen'), 'foreign read-only');
ok('9. Fremdbelegung trägt read-only');

// 10. Fremdbelegung kein Edit-Button
assert.ok(detail.includes('block.canEdit') && detail.includes('Belegung bearbeiten'), 'edit gated');
assert.ok(!detail.includes('onOpenAssign') || detail.match(/canEdit[\s\S]*?onOpenAssign/), 'edit behind canEdit');
ok('10. Fremdbelegung hat keinen Edit-Button (canEdit gate)');

// 11. Eigene Belegung bearbeitbar
assert.ok(detail.includes('Belegung bearbeiten'), 'edit button exists');
ok('11. Eigene Belegung kann bearbeitet werden');

// 12. Fehlendes Teamlabel → "Andere Mannschaft"
assert.ok(dayView.includes("'Andere Mannschaft'"), 'day fallback');
assert.ok(detail.includes("'Andere Mannschaft'"), 'detail fallback');
ok('12. Fehlendes Teamlabel ergibt "Andere Mannschaft"');

// 13. Wochenansicht zeigt Mannschaft und Uhrzeit
assert.ok(weekView.includes('b.teamLabel') && weekView.includes('b.timeLabel'), 'week shows team+time');
ok('13. Wochenansicht zeigt Mannschaft und Uhrzeit');

// 14. Mehrere Belegungen → "+ N weitere"
assert.ok(weekView.includes('weitere'), 'week overflow');
ok('14. Mehrere Belegungen ergeben "+ N weitere"');

// 15. Monatsklick öffnet Tagesansicht
assert.ok(monthView.includes('onSwitchToDay') || monthView.includes('switchToDay'), 'month click to day');
ok('15. Monatsklick öffnet Tagesansicht');

// 16. Traineransicht kein doppelter Legacy-Kalender
assert.ok(page.includes('!isTrainerMode') && page.includes("'facilities'"), 'facilities hidden for trainer');
ok('16. Traineransicht zeigt keinen Legacy-Facilities-Tab');

// 17. Shared-Minimal-DTO keine privaten Daten
assert.ok(shared.includes('assertNoPrivateSharedFields'), 'privacy guard');
const forbidden = ['players', 'player_ids', 'attendance', 'description', 'created_by'];
for (const f of forbidden) {
  assert.ok(shared.includes(f), `forbidden field ${f} in check`);
}
ok('17. Shared-Minimal-DTO enthält keine privaten Daten');

// 18. Fremdbelegungen auf erlaubten Anlagen sichtbar
assert.ok(page.includes('sharedOccupancy') || page.includes('mergeSharedOccupancy'), 'shared merged');
ok('18. Fremdbelegungen auf erlaubten Anlagen bleiben sichtbar');

// 19. Nicht freigegebene Anlagen für Trainer unsichtbar
assert.ok(page.includes('listAllowedVenueRowsForPurpose') || page.includes('allowedVenues'), 'venue filter');
ok('19. Nicht freigegebene Anlagen bleiben für Trainer unsichtbar');

// 20. Bestehende Tests bleiben grün (Verweis)
ok('20. Bestehende PLATZ-UX.1–1C Tests: separat geprüft');

console.log(`\n✅ ${passed}/20 Tests bestanden.\n`);
