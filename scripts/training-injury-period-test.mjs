import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { isPlayerAutoInjuredForEvent } from '../src/lib/playerAvailability.ts';

// Execute production modules without initializing a Supabase client.
function loadModule(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = stripTypeScriptTypes(source).replace(/^import[\s\S]*?;\n/gm, '').replace(/\bexport /g, '');
  return new Function(...Object.keys(dependencies), `${code}\nreturn {
    ${path.includes('trainingAttendance.ts') ? 'resolveTrainingAttendanceStatus, resolveTrainingAttendanceStatusForStats, computeTrainingAttendanceStats, trainingScheduleCardCounts, countTrainingAttendanceByStatus, computeSessionParticipationPct, computeSessionParticipationPctExact' : path.includes('trainingStatsLoader') ? 'computeTrainingHistoryForPlayer, fetchTrainingPlayerAvailability' : 'buildSessionParticipations'}
  };`)(...Object.values(dependencies));
}
const training = loadModule('../src/lib/trainingAttendance.ts', { isPlayerAutoInjuredForEvent });
const starts = '2026-10-05T15:00:00Z';
const since = '2026-10-01T08:00:00Z';
const player = { is_injured: true, injured_since: since, injured_until: null };
for (const now of ['2026-10-05T09:00:00Z', starts, '2026-10-05T18:28:00Z']) {
  for (const raw of [undefined, 'yes', 'no', 'sick', 'external_training']) {
    assert.equal(training.resolveTrainingAttendanceStatus(raw, { player, eventStartsAtIso: starts, nowMs: Date.parse(now) }), 'injured');
    assert.equal(training.resolveTrainingAttendanceStatusForStats(raw, starts, Date.parse(now), player), 'injured');
  }
}
const nowMs = Date.parse('2026-10-10T18:00:00Z');
const recovered = { ...player, is_injured: false, injured_until: '2026-10-07T08:00:00Z' };
for (const p of [player, recovered]) {
  assert.equal(training.resolveTrainingAttendanceStatus('yes', { player: p, eventStartsAtIso: '2026-09-30T15:00:00Z', nowMs }), 'present');
  assert.equal(training.resolveTrainingAttendanceStatus('yes', { player: p, eventStartsAtIso: starts, nowMs }), 'injured');
}
assert.equal(training.resolveTrainingAttendanceStatus(undefined, { player: recovered, eventStartsAtIso: '2026-10-08T15:00:00Z', nowMs }), 'present');
assert.equal(training.resolveTrainingAttendanceStatus(undefined, { player: { is_injured: true }, eventStartsAtIso: starts, nowMs }), 'present', 'Unknown injury start must not rewrite history');
assert.deepEqual(training.trainingScheduleCardCounts({ rosterPlayerIds: ['theo', 'healthy'], playerAvailabilityById: { theo: player }, startsAtIso: starts, nowMs }), { yes: 1, no: 1, open: 0 });
const rows = [{ id: 'before', starts_at: '2026-09-30T15:00:00Z' }, { id: 'during', starts_at: starts }];
const mockSupabase = { from(table) {
  assert.equal(table, 'players');
  return { select(columns) { assert.match(columns, /injured_since/); return this; },
    async in(column, ids) { assert.equal(column, 'id'); assert.deepEqual(ids, ['theo']); return { data: [{ id: 'theo', ...player }], error: null }; } };
} };
const loader = loadModule('../src/lib/trainingStatsLoader.ts', { ...training, supabase: mockSupabase });
const history = loader.computeTrainingHistoryForPlayer(rows, new Map([['during', 'yes']]), nowMs, recovered);
assert.deepEqual(history.sessions.map(s => s.status), ['present', 'injured']);
assert.equal(history.stats.present, 1);
assert.equal(history.stats.injured, 1);
assert.equal(history.stats.teamRatePct, 100);
assert.deepEqual(await loader.fetchTrainingPlayerAvailability(['theo']), { theo: player });
const squad = loadModule('../src/lib/teamTrainingParticipationStats.ts', { ...training });
const sessions = squad.buildSessionParticipations(rows, ['theo', 'healthy'], new Map(), nowMs, { theo: recovered });
assert.equal(sessions[0].counts.present, 2);
assert.equal(sessions[1].counts.present, 1);
assert.equal(sessions[1].counts.injured, 1);
console.log('PASS: before/during/after training, stale yes, injury period, recovery, card counts, history, squad stats, data query');
