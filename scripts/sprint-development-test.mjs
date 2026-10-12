import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({entryPoints:['src/lib/sprintChallenge.ts'],bundle:true,format:'esm',platform:'node',write:false});
const { sprintProgress, sprintDevelopmentRanking, rankSprintResults } = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const entry=(id,date,times,method='light_gate',participation=null,playerId='p')=>({testId:id,date,createdAt:date+'T12:00:00Z',attempts:times,method,participation,playerId});
const history=[
 entry('old','2025-10-01',[3400,3320,3390]),
 entry('absent','2026-09-10',[null,null,null],'light_gate','absent'),
 entry('hand','2026-09-11',[2900,2800,2850],'hand'),
 entry('latest','2026-10-01',[3300,3250,3310]),
 entry('future','2026-12-01',[3000,2990,2980])
];
const current=entry('now','2026-10-12',[3230,3200,3240]);
const progress=sprintProgress(history,current);
assert.equal(progress.previousTime,3250,'last comparable measurement, skip absence and hand timing');
assert.equal(progress.previousBest,3250,'exclude future tests');
assert.equal(progress.improvementMs,50);
assert.equal(progress.newPersonalBest,true);
assert(Math.abs(progress.improvementPercent-50/3250*100)<0.0001);
const first=sprintProgress(history,entry('first','2025-01-01',[3500,null,null]));
assert.equal(first.improvementMs,null); assert.equal(first.newPersonalBest,false);
const absent=sprintProgress(history,entry('abs','2026-10-12',[null,null,null],'light_gate','absent'));
assert.equal(absent.best,null); assert.equal(absent.improvementMs,null);
const empty=sprintProgress(history,entry('empty','2026-10-12',[null,null,null]));
assert.equal(empty.best,null); assert.equal(empty.newPersonalBest,false);
assert.equal(sprintProgress(history,entry('unknown','2026-10-12',[3100,null,null],null)).previousTime,null);
assert.equal(sprintProgress(history,entry('slow','2026-10-12',[3500,null,null])).newPersonalBest,false);
assert.equal(sprintProgress([...history,current],current).previousTime,3250,'editing current test must not compare against itself');
assert.equal(rankSprintResults([{playerId:'absent',playerName:'Absent',attempts:[null,null,null]}]).length,0);
const rows=[
 {playerId:'a',playerName:'A',improvementMs:120,improvementPercent:3.6},
 {playerId:'b',playerName:'B',improvementMs:150,improvementPercent:3.0},
 {playerId:'c',playerName:'C',improvementMs:null,improvementPercent:null},
 {playerId:'d',playerName:'D',improvementMs:-20,improvementPercent:-1}
];
assert.deepEqual(sprintDevelopmentRanking(rows,'seconds').map(r=>r.playerId),['b','a']);
assert.deepEqual(sprintDevelopmentRanking(rows,'percent').map(r=>r.playerId),['a','b']);
console.log('Sprint development OK: previous comparable test, across seasons, absent/empty exclusion, no future/self comparison, improvement awards.');
