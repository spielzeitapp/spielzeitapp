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
 for(const n of [3,4]){const two=h.createHallDay(n,2);two.teams.forEach((t,i)=>t.playerIds=[i+'a',i+'b']);const roster=two.teams.flatMap(t=>t.playerIds);assert(h.hallReady(two,roster));assert.equal(two.games.length,h.createHallDay(n,3).games.length);two.teams[0].playerIds.pop();assert(!h.hallReady(two,two.teams.flatMap(t=>t.playerIds)));}
 for(const n of [3,4])for(let home=0;home<n;home++)for(let away=0;away<n;away++){if(home===away)continue;const source=h.createHallDay(n,2);source.games[0].seconds=600;const updated=h.withHallFirstPairing(source,home,away);assert.equal(updated.games[0].home,home);assert.equal(updated.games[0].away,away);assert.equal(updated.games[0].seconds,600);assert.deepEqual(updated.teams,source.teams);const pairs=new Map();updated.games.forEach(g=>{const k=[g.home,g.away].sort().join('-');pairs.set(k,(pairs.get(k)||0)+1);});assert.equal(pairs.size,n*(n-1)/2);assert([...pairs.values()].every(c=>c===source.cycles));assert.equal(source.games[0].home,0);source.games[0].status='running';assert.throws(()=>h.withHallFirstPairing(source,home,away));}
 const g=day.games[0];g.status='running';g.runningSince=10000;g.elapsed=15;assert.equal(h.hallElapsed(g,500,20000),25);assert.equal(h.hallElapsed(g,500,1e9),500);g.status='paused';assert.equal(h.hallElapsed(g,500,1e9),15);
 g.goals=[{team:0,second:4},{team:1,second:7},{team:0,second:9}];assert.equal(h.hallScore(g,0),2);assert(h.hallStandings(day).every(t=>t.played===0));g.status='finished';assert.equal(h.hallStandings(day)[0].points,3);g.goals.pop();assert.equal(h.hallStandings(day)[0].points,1);assert.equal(h.hallClock(500),'8:20');

 const custom=h.createHallDay();const longer=h.withHallGameDuration(custom,0,620);assert.equal(h.hallGameSeconds(longer,longer.games[0]),620);assert.equal(h.hallGameSeconds(longer,longer.games[1]),500);assert.equal(h.hallPlanSeconds(longer),3720);assert.equal(longer.buffer,0);assert.equal(custom.games[0].seconds,undefined,'immutable duration update');
 const shorter=h.withHallGameDuration(custom,1,300);assert.equal(h.hallPlanSeconds(shorter),3400);assert.equal(shorter.buffer,200);
 for(const invalid of [0,59,1801,61.5,NaN])assert.throws(()=>h.withHallGameDuration(custom,0,invalid));
 custom.games[0].status='running';assert.throws(()=>h.withHallGameDuration(custom,0,600));custom.games[0].status='finished';assert.throws(()=>h.withHallGameDuration(custom,0,600));
 custom.games[0].goals=[{team:0,second:2,scorerId:'a',scorerName:'Same Name'},{team:1,second:4,scorerId:'b',scorerName:'Same Name'},{team:0,second:5}];custom.games[1].status='finished';custom.games[1].goals=[{team:2,second:6,scorerId:'a',scorerName:'Same Name'},{team:0,second:8,scorerId:'b',scorerName:'Same Name'}];
 custom.games[2].status='running';custom.games[2].goals=[{team:1,second:1,scorerId:'c',scorerName:'Live scorer'}];const top=h.hallScorers(custom);assert.equal(top.unassigned,1);assert.equal(top.players.length,2,'same name with different IDs stays separate; running game excluded');assert.deepEqual(top.players.map(p=>[p.goals,p.rank]),[[2,1],[2,1]]);assert.deepEqual(top.players.find(p=>p.id==='a').teams,[0,2]);
 console.log('PASS: exact time budgets, equal games for every team, complete pairings, 3/4 teams, invalid inputs, hall-only detection, roster changes, clock resume/cap, internal standings.');
} finally {rmSync(tmp,{recursive:true,force:true});}
