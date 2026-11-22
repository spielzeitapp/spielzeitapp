import assert from 'node:assert/strict';
import { parseMeinTurnierplanModel, resolveMeinTurnierplanFinalStandings } from '../server/lib/meinTurnierplanModel.js';

const makeMatch = (gameId, match, homeParticipant, awayParticipant, score1, score2, isActive) => ({
  gameId, modeMapping: { round: 1, match }, homeParticipant, awayParticipant, score1, score2, isActive,
  dateAndTime: `2026-11-22 14:${gameId}`,
});
const data = {
  participants: {
    1: { name: 'SV Gablitz' },
    2: { name: 'SC Red Star Penzing' },
    3: { name: 'SPG Rabenstein-Pielachtal' },
    4: { name: 'SV Langenrohr' },
    5: { name: 'NSG Gölsental' },
    6: { name: 'ASK Peham Wilhelmsburg' },
  },
  groups: [{ displayId: 'A' }],
  groupParticipants: [[1, 2, 3, 4, 5, 6]],
  finalMatches: [
    makeMatch(17, 3, 5, 6, 1, 3, false),
    makeMatch(18, 2, 3, 4, 2, 1, false),
    makeMatch(19, 1, 1, 2, 1, 0, true),
  ],
  finalRankTable: [{ rank: 5, participant: 6 }, { rank: 1, participant: null }, { rank: 0, participant: 1 }],
};
const parsed = parseMeinTurnierplanModel(data);
assert.deepEqual(parsed.finalStandings, [
  { rank: 3, teamName: 'SPG Rabenstein-Pielachtal' },
  { rank: 4, teamName: 'SV Langenrohr' },
  { rank: 5, teamName: 'ASK Peham Wilhelmsburg' },
  { rank: 6, teamName: 'NSG Gölsental' },
]);
assert.deepEqual(resolveMeinTurnierplanFinalStandings({ ...parsed, finalStandings: [] }), parsed.finalStandings);
const published = parseMeinTurnierplanModel({
  ...data, finalRankTable: [...data.finalRankTable, { rank: 1, participant: 1 }, { rank: 2, participant: 2 }],
});
assert.deepEqual(published.finalStandings.slice(0, 2), [
  { rank: 1, teamName: 'SV Gablitz' }, { rank: 2, teamName: 'SC Red Star Penzing' },
]);
const completed = parseMeinTurnierplanModel({
  ...data, finalMatches: data.finalMatches.map(match => ({ ...match, isActive: false })),
});
assert.deepEqual(completed.finalStandings, published.finalStandings);
const tied = parseMeinTurnierplanModel({
  ...data, finalMatches: [makeMatch(19, 1, 1, 2, 0, 0, false)],
  finalRankTable: [],
});
assert.deepEqual(tied.finalStandings, []);
console.log('PASS partial, published and completed rankings, saved snapshots, and draws');
