import assert from 'node:assert/strict';
import { build } from 'esbuild';
const compiled = await build({ entryPoints: ['src/lib/sprintChallenge.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { parseSprintSeconds, bestSprintTime, formatSprintTime, rankSprintResults } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
assert.equal(parseSprintSeconds('3,42'), 3420);
assert.equal(parseSprintSeconds(' 3.421 '), 3421);
for (const invalid of ['', 'abc', '-2', '0', '60,001', '3,1234', '1e2', '3,2,1']) assert.equal(parseSprintSeconds(invalid), null);
assert.equal(bestSprintTime([4100, 3900, 4050]), 3900);
assert.equal(bestSprintTime([null, 4100, null]), 4100);
assert.equal(bestSprintTime([null, null, null]), null);
assert.equal(bestSprintTime([0, -1, 60001]), null);
const ranking = rankSprintResults([
 { playerId: 'a', playerName: 'A', attempts: [4100, 3900, 4050] },
 { playerId: 'b', playerName: 'B', attempts: [3900, 4200, null] },
 { playerId: 'c', playerName: 'C', attempts: [null, null, null] },
 { playerId: 'd', playerName: 'D', attempts: [4200, 4100, 4000] }
]);
assert.deepEqual(ranking.map(row => [row.playerId, row.rank, row.best]), [['a',1,3900],['b',1,3900],['d',3,4000]]);
assert.equal(formatSprintTime(3420), '3,42 s');
console.log('Sprint scoring OK: decimal input, invalid values, partial trials, fastest result, equal ranks.');
