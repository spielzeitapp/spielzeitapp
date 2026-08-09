/**
 * TURNIER.1 – Public team tournament page logic tests (no DB).
 */
import assert from 'assert';
import {
  normalizeOefbImportedTeamName,
  isValidPublicTournamentId,
  splitPublicTeamDisplay,
  sortSlotsChronologically,
  pickNextOpenSlot,
  buildPublicTeamTournamentDto,
  assertPublicDtoSafe,
  toPublicMatchDto,
} from '../api/_lib/publicTeamTournamentLogic.js';

assert.strictEqual(normalizeOefbImportedTeamName('U11 SPG Rohrbach'), 'SPG Rohrbach');
assert.strictEqual(normalizeOefbImportedTeamName('SV U11dorf'), 'SV U11dorf');

{
  const a = splitPublicTeamDisplay('U11 SPG Rohrbach', 'U11');
  assert.strictEqual(a.teamName, 'SPG Rohrbach');
  assert.strictEqual(a.ageGroupLabel, 'U11');
  const b = splitPublicTeamDisplay('SPG Rohrbach', 'U12');
  assert.strictEqual(b.teamName, 'SPG Rohrbach');
  assert.strictEqual(b.ageGroupLabel, 'U12');
}

assert.strictEqual(isValidPublicTournamentId(''), false);
assert.strictEqual(isValidPublicTournamentId('not-a-uuid'), false);
assert.strictEqual(isValidPublicTournamentId('ev-tournament'), true);
assert.strictEqual(isValidPublicTournamentId('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'), true);

const teamSeasonA = 'ts-a';
const slotsRaw = [
  {
    id: 's1',
    match_id: 'm1',
    opponent_name: 'U11 ASK Loosdorf',
    kickoff_at: '2026-09-06T10:00:00.000Z',
    sort_order: 2,
    pitch: 'Platz 1',
    group_label: 'A',
    match_status: 'upcoming',
    score_home: 0,
    score_away: 0,
    _team_season_id: teamSeasonA,
  },
  {
    id: 's0',
    match_id: 'm0',
    opponent_name: 'FC Demo',
    kickoff_at: '2026-09-06T08:00:00.000Z',
    sort_order: 1,
    pitch: null,
    group_label: 'A',
    match_status: 'finished',
    score_home: 2,
    score_away: 1,
    _team_season_id: teamSeasonA,
  },
  {
    id: 's2',
    match_id: 'm2',
    opponent_name: 'SC Live',
    kickoff_at: '2026-09-06T12:00:00.000Z',
    sort_order: 3,
    pitch: 'Hauptplatz',
    group_label: null,
    match_status: 'live',
    score_home: 1,
    score_away: 0,
    _team_season_id: teamSeasonA,
  },
  {
    id: 's3',
    match_id: 'm3',
    opponent_name: 'Abgesagt FC',
    kickoff_at: '2026-09-06T14:00:00.000Z',
    sort_order: 4,
    pitch: null,
    group_label: null,
    match_status: 'canceled',
    score_home: 0,
    score_away: 0,
    _team_season_id: teamSeasonA,
  },
];

const onlyOurs = slotsRaw.filter((s) => s._team_season_id === teamSeasonA);
assert.strictEqual(onlyOurs.length, 4);

const sorted = sortSlotsChronologically(onlyOurs);
assert.strictEqual(sorted[0].match_id, 'm0');
assert.strictEqual(sorted[1].match_id, 'm1');
assert.strictEqual(sorted[2].match_id, 'm2');

const next = pickNextOpenSlot(onlyOurs);
assert.strictEqual(next.match_id, 'm2');
assert.strictEqual(String(next.match_status), 'live');

const homeDto = toPublicMatchDto(sorted[1], 'U11 SPG Rohrbach');
assert.strictEqual(homeDto.homeName, 'SPG Rohrbach');
assert.strictEqual(homeDto.awayName, 'ASK Loosdorf');
assert.strictEqual(homeDto.ourIsHome, true);

const page = buildPublicTeamTournamentDto({
  publicId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  tournamentName: 'Sommercup',
  startsAt: '2026-09-06T07:00:00.000Z',
  venue: 'Sportanlage',
  teamName: 'U11 SPG Rohrbach',
  ageGroup: 'U11',
  eventStatus: 'upcoming',
  slots: onlyOurs,
});

assert.strictEqual(page.teamName, 'SPG Rohrbach');
assert.strictEqual(page.ageGroupLabel, 'U11');
assert.strictEqual(page.nextMatch?.id, 'm2');
assert.strictEqual(page.nextMatch?.isLive, true);
assert.strictEqual(page.results.length, 1);
assert.strictEqual(page.results[0].id, 'm0');
assert.strictEqual(page.results[0].scoreOur, 2);
assert.ok(page.allMatches.some((m) => m.status === 'canceled' && m.statusLabel === 'Abgesagt'));

assert.strictEqual(assertPublicDtoSafe(page), true);
assert.throws(() => assertPublicDtoSafe({ ...page, notes: 'geheim' }));

const finishedPage = buildPublicTeamTournamentDto({
  publicId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  tournamentName: 'Sommercup',
  startsAt: '2026-09-06T07:00:00.000Z',
  venue: null,
  teamName: 'SPG Rohrbach',
  ageGroup: 'U12',
  eventStatus: 'upcoming',
  slots: onlyOurs.map((s) =>
    s.match_status === 'canceled' ? s : { ...s, match_status: 'finished', score_home: 1, score_away: 0 },
  ),
});
assert.strictEqual(finishedPage.nextMatch, null);
assert.strictEqual(finishedPage.tournamentStatus, 'finished');

function publicTeamTournamentPath(publicId) {
  return `/turnier/${encodeURIComponent(String(publicId).trim())}`;
}
assert.strictEqual(
  publicTeamTournamentPath('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'),
  '/turnier/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
);

assert.strictEqual(page.allMatches.length, onlyOurs.length);

console.log('public team tournament logic OK');
