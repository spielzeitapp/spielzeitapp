import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/lib/tournamentPlaytime.ts'],
  write: false,
  bundle: true,
  platform: 'node',
  format: 'esm',
  define: { 'import.meta.env': '{}' },
});
const { sumTournamentPlaytime, tournamentMatchPlaytime } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);
let eventOrder = 0;
const event = (type, timestamp, fields) => ({
  id: `${type}-${timestamp}`,
  type,
  timestamp,
  createdAt: new Date(eventOrder++ * 1000).toISOString(),
  ...fields,
});
const timing = {
  kickoffPlayerIds: ['a', 'b'],
  squadPlayerIds: ['a', 'b', 'c', 'bench'],
  elapsedSeconds: 720,
  liveStartedAt: null,
  events: [
    event('start', 0),
    event('pause', 240),
    event('resume', 240),
    event('substitution', 360, { playerId: 'a', swapWithPlayerId: 'c' }),
    event('time_penalty', 480, { playerId: 'b', penaltySeconds: 60 }),
    event('end', 600),
  ],
};
const group = tournamentMatchPlaytime(timing);
assert.deepEqual(group, { a: 360, b: 540, c: 240, bench: 0 });

const final = tournamentMatchPlaytime({
  ...timing,
  kickoffPlayerIds: ['a', 'c'],
  elapsedSeconds: 660,
  events: [event('start', 0), event('end', 660)],
});
assert.deepEqual(sumTournamentPlaytime([group, final]), [
  { playerId: 'a', seconds: 1020, appearances: 2 },
  { playerId: 'b', seconds: 540, appearances: 1 },
  { playerId: 'c', seconds: 900, appearances: 2 },
  { playerId: 'bench', seconds: 0, appearances: 0 },
]);
assert.equal(tournamentMatchPlaytime({ ...timing, kickoffPlayerIds: [] }), null);
assert.equal(tournamentMatchPlaytime({ ...timing, events: [event('end', 720)] }), null);
assert.equal(tournamentMatchPlaytime({ ...timing, elapsedSeconds: 0, events: [event('start', 0)] }), null);
const liveStartedAt = '2026-11-27T16:00:00Z';
const recoveredGroup = tournamentMatchPlaytime({
  ...timing,
  liveStartedAt,
  elapsedSeconds: 600,
  events: timing.events.filter(({ type }) => type === 'substitution' || type === 'time_penalty'),
});
assert.deepEqual(recoveredGroup, group);
assert.deepEqual(tournamentMatchPlaytime({
  ...timing,
  liveStartedAt,
  events: timing.events.filter(({ type }) => type !== 'start'),
}), group);
assert.equal(tournamentMatchPlaytime({
  ...timing, liveStartedAt, elapsedSeconds: 0, events: [],
}), null);
console.log('PASS real seconds, substitutions, penalties, and coverage across tournament matches');
