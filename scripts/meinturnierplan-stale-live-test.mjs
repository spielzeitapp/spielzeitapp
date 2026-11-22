import assert from 'node:assert/strict';
import {
  meinTurnierplanLiveByMatchId,
  normalizeMeinTurnierplanLiveMatches,
  parseMeinTurnierplanModel,
  supersededLiveMatches,
} from '../server/lib/meinTurnierplanModel.js';

const fixture = (id, time, courtId, score1, score2, isActive = true) => ({
  gameId: id,
  dateAndTime: `2026-11-22 ${time}`,
  courtId,
  homeParticipant: 1,
  awayParticipant: 2,
  score1,
  score2,
  isActive,
});
const group = fixture(12, '12:04', 0, 5, 3);
const placement = { ...fixture(17, '13:22', 0, 7, 2), modeMapping: { round: 1, match: 4 } };
const final = { ...fixture(20, '14:04', 0, null, null, false), modeMapping: { round: 1, match: 1 } };
const data = {
  participants: { 1: { name: 'ASV Hinterbrühl' }, 2: { name: 'SPG Oberes Traisental' } },
  groups: [{ displayId: 'B' }],
  groupParticipants: [[1, 2]],
  courts: [{ displayId: '1' }, { displayId: '2' }],
  groupMatches: [group],
  finalMatches: [placement, final],
};

const parsed = parseMeinTurnierplanModel(data);
const [finishedGroup, livePlacement, upcomingFinal] = parsed.rawMatches;
assert.deepEqual([finishedGroup.hasResult, finishedGroup.homeGoals, finishedGroup.awayGoals], [true, 5, 3]);
assert.equal(finishedGroup.isLive, undefined);
assert.equal(livePlacement.isLive, true);
assert.deepEqual([livePlacement.liveHomeGoals, livePlacement.liveAwayGoals], [7, 2]);
assert.equal(upcomingFinal.isLive, undefined);

const ended = parseMeinTurnierplanModel({ ...data, finalMatches: [{ ...placement, isActive: false }, final] });
assert.equal(ended.rawMatches.filter(match => match.isLive).length, 0);

const parallel = parseMeinTurnierplanModel({ ...data, finalMatches: [{ ...placement, courtId: 1 }, final] });
assert.deepEqual(parallel.rawMatches.filter(match => match.isLive).map(match => match.pitch), ['Platz 1', 'Platz 2']);

const staleGroup = {
  ...finishedGroup, kickoffDate: undefined, isLive: true, hasResult: false, homeGoals: null,
  awayGoals: null, liveHomeGoals: 5, liveAwayGoals: 3,
};
const saved = { provider: 'meinturnierplan', rawMatches: [staleGroup, livePlacement, upcomingFinal] };
assert.equal(meinTurnierplanLiveByMatchId(saved).has('mtp-game-12'), false);
const localLive = { pitch: 'Platz 1', kickoffTimeHHmm: '13:36', isLive: true };
const corrected = normalizeMeinTurnierplanLiveMatches(saved, [localLive]);
assert.equal(corrected.rawMatches.some(match => match.isLive), false);
assert.equal(corrected.rawMatches[0].homeGoals, 5);
assert.equal(corrected.rawMatches[1].homeGoals, 7);
assert.equal(saved.rawMatches[0].isLive, true);
assert.equal(supersededLiveMatches([localLive], [{
  pitch: 'Platz 1', kickoffTimeHHmm: '13:50', isLive: true,
}]).has(localLive), true);

const nextDay = { ...placement, dateAndTime: '2026-11-23 09:00' };
const multiDay = parseMeinTurnierplanModel({ ...data, finalMatches: [nextDay] });
assert.equal(multiDay.rawMatches[0].isLive, undefined);
assert.equal(multiDay.rawMatches[1].isLive, true);

const sameTime = { ...livePlacement, kickoffTimeHHmm: '13:36' };
const linkedLocal = { ...localLive, local: true, externalMatchId: sameTime.externalMatchId };
assert.equal(supersededLiveMatches([sameTime], [linkedLocal]).size, 0);
const unrelatedLocal = { ...linkedLocal, externalMatchId: 'different-fixture' };
assert.equal(supersededLiveMatches([sameTime], [unrelatedLocal]).has(sameTime), true);

console.log('PASS stale group and placement scores, live court separation, stored snapshots and local matches');
