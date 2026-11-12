import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url), tmp = mkdtempSync(join(tmpdir(), 'hall-training-'));
try {
 buildSync({ entryPoints:['src/lib/hallTraining.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(tmp,'hall.cjs'),logLevel:'silent' });
 const h = require(join(tmp,'hall.cjs'));
 const three=h.calculateHallSchedule(3,3600,120);assert.equal(three.cycles,2);assert.equal(three.seconds,500);assert.equal(three.gamesPerTeam,4);assert.equal(three.playPerTeam,2000);assert.equal(three.buffer,0);
 for(const n of [3,4])for(const minutes of [15,30,45,60,75,90,120,180])for(const pause of [0,30,60,120,300]){
  if(minutes*60 < n*(n-1)/2*60+(n*(n-1)/2-1)*pause){assert.throws(()=>h.calculateHallSchedule(n,minutes*60,pause));continue;}
  const p=h.calculateHallSchedule(n,minutes*60,pause);
  assert.equal(p.games.length*p.seconds+(p.games.length-1)*pause+p.buffer,minutes*60);
  const counts=Array(n).fill(0),pairs=new Map();
  for(const g of p.games){assert.notEqual(g.home,g.away);counts[g.home]++;counts[g.away]++;const key=[g.home,g.away].sort().join('-');pairs.set(key,(pairs.get(key)||0)+1);}
  assert(counts.every(x=>x===p.gamesPerTeam));assert.equal(pairs.size,n*(n-1)/2);assert([...pairs.values()].every(v=>v===p.cycles));assert(p.buffer>=0);
 }
 assert.throws(()=>h.calculateHallSchedule(2,3600,120));assert.throws(()=>h.calculateHallSchedule(3,600,120));assert.throws(()=>h.calculateHallSchedule(4,900,300,480,8));
 assert(h.isHallTraining('U12 Hallentraining'));assert(h.isHallTraining('Training','Turnsaal St. Veit'));assert(!h.isHallTraining('U12 Training','Sportplatz'));
 const day=h.createHallDay();day.teams.forEach((t,i)=>t.playerIds=[`${i}a`,`${i}b`,`${i}c`]);const ids=day.teams.flatMap(t=>t.playerIds);assert(h.hallReady(day,ids));assert(!h.hallReady(day,ids.slice(1)));assert(!h.hallReady(day,[...ids,'new-player']));day.teams[0].playerIds.push(ids[3]);assert(!h.hallReady(day,ids));day.teams[0].playerIds.pop();
 const g=day.games[0];g.status='running';g.runningSince=10000;g.elapsed=15;assert.equal(h.hallElapsed(g,500,20000),25);assert.equal(h.hallElapsed(g,500,1e9),500);g.status='paused';assert.equal(h.hallElapsed(g,500,1e9),15);
 g.goals=[{team:0,second:4},{team:1,second:7},{team:0,second:9}];assert.equal(h.hallScore(g,0),2);assert(h.hallStandings(day).every(t=>t.played===0));g.status='finished';assert.equal(h.hallStandings(day)[0].points,3);g.goals.pop();assert.equal(h.hallStandings(day)[0].points,1);assert.equal(h.hallClock(500),'8:20');
 console.log('PASS: exact time budgets, equal games for every team, complete pairings, 3/4 teams, invalid inputs, hall-only detection, roster changes, clock resume/cap, internal standings.');
} finally {rmSync(tmp,{recursive:true,force:true});}
