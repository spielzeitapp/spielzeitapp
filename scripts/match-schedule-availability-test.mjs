import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchScheduleCardCounts } from '../src/lib/playerAvailability.ts';

const rosterPlayerIds = Array.from({ length: 12 }, (_, i) => `player-${i}`);
const availabilityByPlayerId = Object.fromEntries(rosterPlayerIds.slice(0, 9).map(id => [id, 'yes']));
const startsAtIso = '2026-10-06T16:00:00Z';
const nowMs = Date.parse('2026-10-05T18:14:00Z');
const injured = { is_injured: true, injured_since: '2026-10-01T00:00:00Z' };
const params = { rosterPlayerIds, availabilityByPlayerId, startsAtIso, nowMs,
  playerAvailabilityById: { 'player-11': injured } };
assert.deepEqual(matchScheduleCardCounts(params), { yes: 9, no: 0, open: 2, injured: 1 });
// An explicit injury also stays separate, with or without the long-term flag.
assert.deepEqual(matchScheduleCardCounts({ ...params, playerAvailabilityById: {},
  availabilityByPlayerId: { ...availabilityByPlayerId, 'player-11': 'injured' } }),
  { yes: 9, no: 0, open: 2, injured: 1 });
for (const flags of [{ is_injured: false }, { ...injured, injured_until: '2026-10-05T23:59:59Z' },
  { ...injured, injured_since: '2026-10-07T00:00:00Z' }]) {
  assert.deepEqual(matchScheduleCardCounts({ ...params, playerAvailabilityById: { 'player-11': flags } }),
    { yes: 9, no: 0, open: 3, injured: 0 });
}
// A dated injury remains in effect when the event has started/passed.
assert.deepEqual(matchScheduleCardCounts({ ...params, nowMs: Date.parse('2026-10-07T00:00:00Z') }),
  { yes: 9, no: 0, open: 2, injured: 1 });
for (const status of ['no', 'sick', 'external_training']) {
  assert.deepEqual(matchScheduleCardCounts({ ...params,
    availabilityByPlayerId: { ...availabilityByPlayerId, 'player-9': status } }),
    { yes: 9, no: 1, open: 1, injured: 1 });
}
// A stale yes cannot override the injury interval.
assert.deepEqual(matchScheduleCardCounts({ ...params,
  availabilityByPlayerId: { ...availabilityByPlayerId, 'player-11': 'yes' } }),
  { yes: 9, no: 0, open: 2, injured: 1 });
// Stale attendance from players outside the active roster cannot inflate counts.
assert.deepEqual(matchScheduleCardCounts({ ...params,
  rosterPlayerIds: [...rosterPlayerIds, 'PLAYER-0'],
  availabilityByPlayerId: { ...availabilityByPlayerId, departed: 'yes' } }),
  { yes: 9, no: 0, open: 2, injured: 1 });
const page = readFileSync(new URL('../src/pages/SchedulePage.tsx', import.meta.url), 'utf8');
assert.equal((page.match(/: matchScheduleCardCounts\(\{/g) ?? []).length, 2,
  'Both hero and remaining event cards must use injury-aware counts');
assert.doesNotMatch(page, /rosterPlayerIds.length - yesRaw - no/);
console.log('PASS: 9 yes / 2 open / 1 injured, recovery, history, absences, active roster, both card paths');
