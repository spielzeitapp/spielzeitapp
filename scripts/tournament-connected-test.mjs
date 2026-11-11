import assert from "node:assert/strict";
import { parseMeinTurnierplanModel } from "../server/lib/meinTurnierplanModel.js";
const j = {
  name: "Testturnier",
  groups: [{ displayId: "A" }, { displayId: "B" }],
  participants: {
    1: { name: "Rohrbach" },
    2: { name: "Rohrbach U11" },
    3: { name: "Team C" },
    4: { name: "Team D" },
  },
  groupParticipants: [
    [1, 3],
    [2, 4],
  ],
  groupRankTables: [
    [{ participant: 1, rank: "1", points: "3" }],
    [
      { participant: 2, rank: "2", points: "0" },
      { participant: 4, rank: "1", points: "3" },
    ],
  ],
  groupMatches: [
    {
      gameId: "1",
      groupId: 0,
      homeParticipant: 1,
      awayParticipant: 3,
      dateAndTime: "2026-02-21 17:00:00",
      score1: "1",
      score2: "0",
    },
  ],
  finalMatches: [
    {
      gameId: "2",
      modeMapping: { round: 2, match: 1 },
      sourceTeam1: { type: "group", group: 0, rank: 1 },
      sourceTeam2: { type: "group", group: 1, rank: 2 },
      homeParticipant: null,
      awayParticipant: null,
      dateAndTime: "2026-02-21 18:00:00",
      score1: "",
      score2: "",
    },
    {
      gameId: "3",
      modeMapping: { round: 1, match: 2 },
      sourceTeam1: { type: "knockout", round: 2, match: 1, rank: 2 },
      sourceTeam2: { type: "knockout", round: 2, match: 2, rank: 2 },
      homeParticipant: 3,
      awayParticipant: 4,
      dateAndTime: "2026-02-21 19:00:00",
      score1: "0",
      score2: "0",
    },
  ],
};
const a = parseMeinTurnierplanModel(j);
assert.equal(a.matchCount, 3);
assert.equal(a.rawMatches[1].homeTeam, "1. Gruppe A");
assert.equal(a.rawMatches[1].homeProjection, "Rohrbach");
assert.equal(a.rawMatches[1].awayProjection, "Rohrbach U11");
assert.equal(a.rawMatches[1].homeConfirmed, false);
assert.equal(a.rawMatches[1].hasResult, false);
assert.equal(a.rawMatches[2].phase, "placement");
assert.equal(a.rawMatches[2].roundLabel, "Spiel um Platz 3");
assert.equal(a.rawMatches[2].hasResult, true);
const changed = structuredClone(j);
changed.finalMatches[0].homeParticipant = 1;
changed.finalMatches[0].awayParticipant = 2;
changed.finalMatches[0].dateAndTime = "2026-02-21 18:10:00";
const b = parseMeinTurnierplanModel(changed);
assert.equal(b.rawMatches[1].externalMatchId, a.rawMatches[1].externalMatchId);
assert.equal(b.rawMatches[1].homeConfirmed, true);
assert.equal(b.rawMatches[1].awayConfirmed, false); // no finished group B matches: prefilled is provisional
assert.equal(b.rawMatches[1].kickoffTimeHHmm, "18:10");
assert.deepEqual(parseMeinTurnierplanModel(null), null);
console.log(
  "Connected tournament: stable identities, unresolved pairings, projections, placement and scores OK",
);
