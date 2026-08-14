/**
 * STEP 17J — Top-match removal + post-match sync path checks (static).
 * Run: node scripts/tournament-17j-topmatch-sync-test.mjs
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
const card = fs.readFileSync(
  path.join(root, 'src/components/live/MatchCenterTournamentCard.tsx'),
  'utf8',
);
const live = fs.readFileSync(path.join(root, 'src/pages/live/LiveMatchScreen.tsx'), 'utf8');
const detail = fs.readFileSync(
  path.join(root, 'src/components/tournament/TournamentDetailSections.tsx'),
  'utf8',
);
const cta = fs.readFileSync(
  path.join(root, 'src/components/tournament/TournamentNextMatchWorkflowCta.tsx'),
  'utf8',
);
const sync = fs.readFileSync(path.join(root, 'src/lib/tournamentPlanSync.ts'), 'utf8');
const importSrc = fs.readFileSync(path.join(root, 'src/lib/tournamentPlanImport.ts'), 'utf8');
const poster = fs.readFileSync(
  path.join(root, 'src/components/live/TournamentMatchCenterPoster.tsx'),
  'utf8',
);

assert(!card.includes('Top-Spiel des Turniers'), 'Top-Spiel label removed from Match Center');
assert(!card.includes('pickTournamentTopMatch'), 'pickTournamentTopMatch not used in Match Center');
assert(
  !card.includes('<TournamentMatchCenterPoster'),
  'Top poster JSX not rendered in Match Center',
);
assert(card.includes('TournamentFirstMatchPreview'), 'First-match preview kept');
assert(poster.includes('export function TournamentMatchCenterPoster'), 'Poster generator kept for other uses');

assert(
  live.includes('syncOfficialPlanAfterTournamentMatchFinish'),
  'Live finish triggers official plan sync',
);
assert(detail.includes("reason: 'post_match'"), 'DetailSections post_match force sync');
assert(detail.includes("reason: 'broadcast'"), 'DetailSections broadcast force sync');
assert(detail.includes('awaitingNextRound'), '60s sync keeps awaiting next round');
assert(detail.includes('standingsRefreshToken'), 'table refresh after post-match sync');
assert(cta.includes('Turnierplan aktualisieren'), 'manual refresh CTA present');

assert(sync.includes('force: true'), 'post-match finish sync forces');
assert(
  importSrc.includes('existingIsOwn') && importSrc.includes('skippedMatches'),
  'own scores protected (skip own match_id slots)',
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall 17j checks passed');
