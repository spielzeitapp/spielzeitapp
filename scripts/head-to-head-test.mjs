import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('../src/lib/headToHead.ts', import.meta.url), 'utf8');
const { summarizeHeadToHead, filterHeadToHead } = new Function(
  stripTypeScriptTypes(source).replaceAll('export ', '') + '\nreturn { summarizeHeadToHead, filterHeadToHead };'
)();
const match = (id, season, home, a, b) => ({ id, team_season_id: season, is_home: home, team_goals: a, opponent_goals: b });
const matches = [match('1', 'archived', true, 3, 1), match('2', 'current', false, 2, 2),
  match('3', 'current', null, 0, 1), match('4', 'archived', null, null, null)];
assert.deepEqual(summarizeHeadToHead(matches), { wins: 1, draws: 1, losses: 1, goals: 5, conceded: 4, unresolved: 1, total: 4 });
assert.deepEqual(filterHeadToHead(matches, 'archived', 'all').map(m => m.id), ['1', '4']);
assert.deepEqual(filterHeadToHead(matches, '', 'away').map(m => m.id), ['2']);
assert.deepEqual(filterHeadToHead(matches, '', 'home').map(m => m.id), ['1']);
assert.equal(summarizeHeadToHead([match('bad', 'current', true, null, 0)]).draws, 0);
assert.equal(summarizeHeadToHead([match('bad', 'current', true, -1, 0)]).unresolved, 1);
assert.equal(summarizeHeadToHead([]).total, 0);
console.log('PASS: archived seasons, own-team results, venue filters, tournament venue exclusion, incomplete scores and empty history');
