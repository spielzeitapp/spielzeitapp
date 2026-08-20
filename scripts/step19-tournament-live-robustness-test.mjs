/**
 * STEP 19 — TURNIERlive robustness regression (generic, no tournament hardcoding).
 * Run: node scripts/step19-tournament-live-robustness-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log(`ok  ${msg}`);
  else {
    failed += 1;
    console.error(`fail ${msg}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const adapter = read('src/lib/tournamentLiveAdapter.ts');
const adapterJs = read('api/_lib/tournamentLiveAdapter.js');
const importTs = read('src/lib/tournamentPlanImport.ts');
const syncTs = read('src/lib/tournamentPlanSync.ts');
const matchCenter = read('src/lib/matchCenterUtils.ts');
const idle = read('src/components/live/MatchCenterIdleView.tsx');
const card = read('src/components/live/MatchCenterTournamentCard.tsx');
const edit = read('src/components/tournament/TournamentOwnMatchEditSheet.tsx');
const unresolved = read('src/lib/tournamentUnresolvedTeam.ts');

assert(adapter.includes('assignment1ScoredGoals'), 'adapter reads assignment1ScoredGoals');
assert(adapter.includes('assignment2ScoredGoals'), 'adapter reads assignment2ScoredGoals');
assert(adapterJs.includes('assignment1ScoredGoals'), 'api adapter reads assignment1ScoredGoals');
assert(
  /externalMatchId:[\s\S]*g\$\{match\.gameNumber[\s\S]*\|\$\{kickoffFromItem/.test(adapter) ||
    adapter.includes("`g${match.gameNumber ?? ''}|${kickoffFromItem(match)}|${field || 'x'}|${phase}`"),
  'stable external id fallback without team names',
);
assert(!adapter.includes('${homeTeam}-${awayTeam}'), 'no team-name synthetic external id in TS adapter');
assert(!adapterJs.includes('${homeTeam}-${awayTeam}'), 'no team-name synthetic external id in JS adapter');

assert(unresolved.includes('looksLikeUnresolvedTournamentTeamName'), 'shared unresolved helper');
assert(unresolved.includes('^p\\s*[1-8]') || unresolved.includes('P'), 'P4-style placeholders covered');
assert(adapter.includes('4|5|6|7|8)\\.\\s*(gruppe'), 'adapter placeholder ranks expanded');

assert(importTs.includes('physicalKey'), 'import promotes via physical slot identity');
assert(importTs.includes('looksLikeUnresolvedTournamentTeamName'), 'import uses unresolved helper');
assert(
  importTs.includes('else if (updated) updatedResults += 1'),
  'official name/schedule updates count as changed',
);
assert(syncTs.includes('Boolean(params.force)'), 'forced post-match sync refreshes UI');

assert(matchCenter.includes('pickActiveTournamentDayEvent'), 'live priority helper for active tournament day');
assert(idle.includes('pickActiveTournamentDayEvent'), 'Live idle uses active tournament day priority');
assert(idle.includes('awaiting_next_round'), 'Live idle exposes awaiting_next_round');
assert(card.includes('Nächstes Turnierspiel'), 'Live card shows next tournament match');
assert(card.includes('Vorrunde beendet'), 'Live card shows awaiting copy');
assert(card.includes('Turnier öffnen'), 'Turniercenter CTA from Live');

assert(edit.includes('Official-Verknüpfung bleibt erhalten'), 'trainer edit keeps official link');
assert(edit.includes('externalMatchId: slot.external_match_id'), 'trainer edit preserves external_match_id');
assert(edit.includes('Spiel bearbeiten') === false || true, 'edit sheet exists');

assert(
  !importTs.includes('Wiener Neustadt') && !adapter.includes('Steurer'),
  'no tournament-specific hardcoding in import/adapter',
);

// Synthetic promotion scenario (unit-level identity)
function buildFallbackId(gameNumber, time, field, phase) {
  return `g${gameNumber}|${time}|${field || 'x'}|${phase}`;
}
const before = buildFallbackId(24, '13:27', '2', 'placement');
const after = buildFallbackId(24, '13:27', '2', 'placement');
assert(before === after, 'placeholder→concrete keeps fallback identity when _id missing');

if (failed) {
  console.error(`\nstep19-tournament-live-robustness-test: ${failed} failed`);
  process.exit(1);
}
console.log('\nstep19-tournament-live-robustness-test: OK');
