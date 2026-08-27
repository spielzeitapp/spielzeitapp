/**
 * SCHEDULE-FINISHED-MATCH-CARD – beendeter Hero zeigt Spielart statt redundanter Status-Badge.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const labels = read('src/components/match/matchCardLabels.ts');
const card = read('src/app/components/MatchCardLigaportal.tsx');
const core = read('src/components/match/MatchCardGameCore.tsx');
const schedule = read('src/pages/SchedulePage.tsx');

assert.ok(labels.includes("friendly: 'Testspiel'"), 'friendly matches must be labelled Testspiel');

const finishedStart = card.indexOf("matchPhase === 'finished' && scheduleNextMatchHero");
const finishedEnd = card.indexOf("isAudienceHeroRole && scheduleNextMatchHero", finishedStart);
const finishedHero = card.slice(finishedStart, finishedEnd);
assert.ok(finishedHero.includes('{matchTypeLabel}'), 'finished trainer hero must show match type');
assert.ok(finishedHero.includes('<Trophy'), 'finished trainer hero match type needs trophy icon');
assert.ok(!finishedHero.includes('BEENDET'), 'finished trainer hero must not repeat redundant ended badge');
assert.ok(finishedHero.includes('kickoffHeaderLabel="ENDSTAND"'), 'Endstand heading must remain');
assert.ok(finishedHero.includes('Spiel beendet'), 'finished helper text must remain');

assert.ok(
  core.includes("? `${homeScore}:${awayScore}`"),
  'compact schedule result must stay horizontal without spaces',
);
assert.ok(
  core.includes('whitespace-nowrap text-[34px]'),
  'compact result must not wrap on narrow phones',
);

assert.ok(
  schedule.includes("isFinishedMatch || matchReviewPending") && schedule.includes("? 'Letztes Spiel'"),
  'finished or review-pending hero must be labelled Letztes Spiel',
);

console.log('schedule-finished-match-card-test: OK');
