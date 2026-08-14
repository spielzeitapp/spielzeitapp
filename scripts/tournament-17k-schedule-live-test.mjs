/**
 * STEP 17K — Schedule active live card static checks.
 * Run: node scripts/tournament-17k-schedule-live-test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`ok  ${msg}`);
  else {
    failed += 1;
    console.error(`fail ${msg}`);
  }
}

const root = process.cwd();
const lib = fs.readFileSync(path.join(root, 'src/lib/scheduleActiveLiveMatch.ts'), 'utf8');
const card = fs.readFileSync(
  path.join(root, 'src/components/schedule/ScheduleActiveLiveCard.tsx'),
  'utf8',
);
const schedule = fs.readFileSync(path.join(root, 'src/pages/SchedulePage.tsx'), 'utf8');
const live = fs.readFileSync(path.join(root, 'src/pages/live/LiveMatchScreen.tsx'), 'utf8');
const sync = fs.readFileSync(path.join(root, 'src/lib/tournamentPlanSync.ts'), 'utf8');

assert(lib.includes("status', 'live'") || lib.includes('.eq(\'status\', \'live\')'), 'uses matches.status=live');
assert(lib.includes('tournament_matches'), 'tournament lookup via tournament_matches');
assert(lib.includes('TURNIERSPIEL') && lib.includes('MEISTERSCHAFT'), 'generic kind labels');
assert(card.includes('Zum Live-Spiel'), 'CTA present');
assert(card.includes('LIVE ·'), 'LIVE badge');
assert(!card.includes('Aufstellung') && !card.includes('Spiel starten'), 'no manage controls on card');
assert(schedule.includes('ScheduleActiveLiveCard'), 'SchedulePage renders live card');
assert(schedule.includes('subscribeLiveMatchStateChanged'), 'Schedule listens to live broadcast');
assert(schedule.includes('fetchActiveScheduleLiveMatch'), 'Schedule uses shared live fetch');
assert(live.includes("reason: 'score'"), 'score updates broadcast for schedule refresh');
assert(sync.includes('force: true'), 'TURNIERlive sync untouched still present');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall 17k checks passed');
