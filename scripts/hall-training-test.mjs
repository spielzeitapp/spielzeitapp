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
 const start=Date.parse('2026-11-14T17:00:00Z');
 const reliefDay = h.createHallDay(3, 2);
 reliefDay.teams[0].playerIds = ['blue-on', 'blue-2', 'blue-bench'];
 reliefDay.teams[1].playerIds = ['injured', 'yellow-2'];
 reliefDay.teams[2].playerIds = ['resting', 'resting-2'];
 const live = h.prepareHallPlayers(reliefDay, 0);
 Object.assign(live.games[0], { status: 'running', runningSince: start });
 const after = h.relieveHallPlayer(live, 0, 1, 'injured', 'blue-on', start + 30000);
 const match = after.games[0];
 assert.deepEqual(match.participation[0].stints.at(-1), { second: 30, on: ['blue-2'] });
 assert.deepEqual(match.participation[1].stints.at(-1), { second: 30, on: ['blue-on', 'yellow-2'] });
 assert.deepEqual(after.teams, live.teams, 'Aushilfe belongs to this game only');
 assert.equal(live.games[0].participation[0].stints.length, 1);
 const reliefTimes = new Map(h.hallPlayerTimes(after, start + 60000).players.map(player => [player.id, player.seconds]));
 assert.equal(reliefTimes.get('blue-on'), 60, 'Donor plays on one side at a time');
 assert.equal(reliefTimes.get('injured'), 30);
 assert.throws(() => h.changeHallPlayers(after, 0, 0, ['blue-2', 'blue-on'], start + 60000));
 assert.throws(() => h.changeHallPlayers(after, 0, 1, ['injured', 'yellow-2'], start + 60000));
 assert.throws(() => h.relieveHallPlayer(live, 0, 1, 'injured', 'unlisted', start + 60000));
 const paused = structuredClone(live);
 Object.assign(paused.games[0], { status: 'paused', runningSince: null, elapsed: 40 });
 const fromRest = h.relieveHallPlayer(paused, 0, 1, 'injured', 'resting', start + 90000);
 assert.deepEqual(fromRest.games[0].participation[0].stints, paused.games[0].participation[0].stints);
 assert.deepEqual(fromRest.games[0].participation[1].stints.at(-1), { second: 40, on: ['resting', 'yellow-2'] });
 const nextYellow = after.games.findIndex((game, i) => i > 0 && [game.home, game.away].includes(1));
 assert.deepEqual(h.prepareHallPlayers(after, nextYellow).games[nextYellow].participation[1].roster, ['yellow-2']);

 const delayed=h.createHallDay(3,3,4500,60,360,4);
 delayed.games[0].status='finished';delayed.games[0].elapsed=320;delayed.games[0].finishedAt=start+320000;delayed.games[0].goals=[{team:0,second:10}];
 delayed.games[1].status='paused';delayed.games[1].elapsed=100;
 let timing=h.hallTiming(delayed,start,start+1000000);assert(timing.delay>0);assert(timing.canFit);
 const fitted=h.fitHallRemaining(delayed,start,start+1000000);
 assert.deepEqual(fitted.games.slice(0,2),delayed.games.slice(0,2),'played and active snapshots preserved');assert.equal(fitted.games.length,delayed.games.length);assert(h.hallTiming(fitted,start,start+1000000).projectedEnd<=timing.deadline);assert(fitted.games.slice(2).every(g=>g.seconds>=60&&g.seconds<320&&g.originalSeconds===320));assert.equal(delayed.games[2].seconds,undefined,'original immutable');
 assert.throws(()=>h.fitHallRemaining(delayed,start,start+4400000),/einer Minute/);
 const between=h.createHallDay(3,3,4500,60,360,4);between.games[0].status='finished';between.games[0].elapsed=320;between.games[0].finishedAt=start+320000;
 assert.equal(h.hallTiming(between,start,start+330000).budget,4500-330-50-10*60);assert.equal(h.hallTiming(between,start,start+400000).budget,4500-400-10*60);
 const early=h.hallTiming(h.createHallDay(3,3,4500,60,360,4),start,start-300000);assert.equal(early.delay,0);assert.equal(early.projectedEnd,start+4500000);
 const legacy=h.createHallDay(3,3);legacy.teams.forEach((t,i)=>t.playerIds=Array.from({length:3},(_,j)=>'legacy-'+i+'-'+j));legacy.games[0].status='finished';legacy.games[0].elapsed=180;
 let legacyTimes=h.hallPlayerTimes(legacy);assert.equal(legacyTimes.players.find(p=>p.id==='legacy-0-0').seconds,180);assert.equal(legacyTimes.players.find(p=>p.id==='legacy-0-0').estimated,true);assert.equal(legacyTimes.players.find(p=>p.id==='legacy-2-0').seconds,0);
 legacy.teams[0].playerIds.push('legacy-bench');legacyTimes=h.hallPlayerTimes(legacy);assert.equal(legacyTimes.players.find(p=>p.id==='legacy-0-0').incomplete,true);assert.equal(legacyTimes.players.find(p=>p.id==='legacy-0-0').seconds,0);assert.equal(legacyTimes.players.find(p=>p.id==='legacy-1-0').seconds,180);
 const late=h.createHallDay(3,3);late.games[0].status='finished';late.games[0].elapsed=45;late.games[0].goals=[{team:0,second:35}];const credited=h.creditHallFullDuration(late,0);assert.equal(credited.games[0].elapsed,late.seconds);assert.equal(late.games[0].elapsed,45);assert.deepEqual(credited.games[0].goals,late.games[0].goals);assert.throws(()=>h.creditHallFullDuration(late,1));
 const indoor=h.calculateHallRotation(3,75*60);assert.equal(indoor.count,12);assert.equal(indoor.seconds,320);assert.equal(indoor.playPerTeam,2560);assert.equal(indoor.longestWaitSeconds,440);assert.equal(indoor.buffer,0);assert.equal(indoor.count*indoor.seconds+(indoor.count-1)*60,4500);
 for(const minutes of [30,45,60,75,90,120]){const plan=h.calculateHallRotation(3,minutes*60);assert(plan.seconds<=360);for(let team=0;team<3;team++){const played=plan.games.filter(g=>g.home===team||g.away===team);assert.equal(played.length,plan.gamesPerTeam);for(let i=1;i<plan.games.length;i++)assert(![plan.games[i-1],plan.games[i]].every(g=>g.home!==team&&g.away!==team));}}
 assert.throws(()=>h.calculateHallRotation(3,180*60));
 assert.equal(h.hallWindowMinutes('18:32','19:43'),71);assert.equal(h.hallTimeAfter('18:32',71),'19:43');assert.equal(h.hallWindowMinutes('23:30','00:30'),60);assert(Number.isNaN(h.hallWindowMinutes('','19:43')));assert.equal(h.hallWindowMinutes('18:32','18:32'),0);const windowPlan=h.calculateHallRotation(3,71*60);assert.equal(windowPlan.count,12);assert.equal(windowPlan.seconds,300);assert.equal(windowPlan.buffer,0);
 for(const duration of [15,20,25,30]){const p=h.calculateTrainingPlan(2,duration*60,60,360);assert.equal(p.count,1);assert.equal(p.seconds,duration*60);assert.equal(p.buffer,0);}assert.throws(()=>h.calculateTrainingPlan(2,3600,60,360));assert.equal(h.calculateTrainingPlan(3,4500,60,360).seconds,320);assert.equal(h.calculateTrainingPlan(4,4500,60,360).gamesPerTeam,6);
 const three=h.calculateHallSchedule(3,3600,120);assert.equal(three.cycles,2);assert.equal(three.seconds,500);assert.equal(three.gamesPerTeam,4);assert.equal(three.playPerTeam,2000);assert.equal(three.buffer,0);
 for(const n of [2,3,4])for(const minutes of [15,30,45,60,75,90,120,180])for(const pause of [0,30,60,120,300]){
  if(minutes*60 < n*(n-1)/2*60+(n*(n-1)/2-1)*pause){assert.throws(()=>h.calculateHallSchedule(n,minutes*60,pause));continue;}
  const p=h.calculateHallSchedule(n,minutes*60,pause);
  assert.equal(p.games.length*p.seconds+(p.games.length-1)*pause+p.buffer,minutes*60);
  const counts=Array(n).fill(0),pairs=new Map();
  for(const g of p.games){assert.notEqual(g.home,g.away);counts[g.home]++;counts[g.away]++;const key=[g.home,g.away].sort().join('-');pairs.set(key,(pairs.get(key)||0)+1);}
  assert(counts.every(x=>x===p.gamesPerTeam));assert.equal(pairs.size,n*(n-1)/2);assert([...pairs.values()].every(v=>v===p.cycles));assert(p.buffer>=0);
 }
 assert.throws(()=>h.calculateHallSchedule(1,3600,120));assert.throws(()=>h.calculateHallSchedule(3,600,120));assert.throws(()=>h.calculateHallSchedule(4,900,300,480,8));
 assert(h.isHallTraining('U12 Hallentraining'));assert(h.isHallTraining('Training','Turnsaal St. Veit'));assert(!h.isHallTraining('U12 Training','Sportplatz'));
 const day=h.createHallDay();day.teams.forEach((t,i)=>t.playerIds=[`${i}a`,`${i}b`,`${i}c`]);const ids=day.teams.flatMap(t=>t.playerIds);assert(h.hallReady(day,ids));assert(!h.hallReady(day,ids.slice(1)));assert(!h.hallReady(day,[...ids,'new-player']));day.teams[0].playerIds.push(ids[3]);assert(!h.hallReady(day,ids));day.teams[0].playerIds.pop();
 for(const n of [2,3,4]){const two=h.createHallDay(n,2);two.teams.forEach((t,i)=>t.playerIds=[i+'a',i+'b']);const roster=two.teams.flatMap(t=>t.playerIds);assert(h.hallReady(two,roster));assert.equal(two.games.length,h.createHallDay(n,3).games.length);two.teams[0].playerIds.pop();assert(!h.hallReady(two,two.teams.flatMap(t=>t.playerIds)));}
 for(const n of [2,3,4])for(let home=0;home<n;home++)for(let away=0;away<n;away++){if(home===away)continue;const source=h.createHallDay(n,2);source.games[0].seconds=600;const updated=h.withHallFirstPairing(source,home,away);assert.equal(updated.games[0].home,home);assert.equal(updated.games[0].away,away);assert.equal(updated.games[0].seconds,600);assert.deepEqual(updated.teams,source.teams);const pairs=new Map();updated.games.forEach(g=>{const k=[g.home,g.away].sort().join('-');pairs.set(k,(pairs.get(k)||0)+1);});assert.equal(pairs.size,n*(n-1)/2);assert([...pairs.values()].every(c=>c===source.cycles));assert.equal(source.games[0].home,0);source.games[0].status='running';assert.throws(()=>h.withHallFirstPairing(source,home,away));}
 const g=day.games[0];g.status='running';g.runningSince=10000;g.elapsed=15;assert.equal(h.hallElapsed(g,500,20000),25);assert.equal(h.hallElapsed(g,500,1e9),500);g.status='paused';assert.equal(h.hallElapsed(g,500,1e9),15);
 g.goals=[{team:0,second:4},{team:1,second:7},{team:0,second:9}];assert.equal(h.hallScore(g,0),2);assert(h.hallStandings(day).every(t=>t.played===0));g.status='finished';assert.equal(h.hallStandings(day)[0].points,3);g.goals.pop();assert.equal(h.hallStandings(day)[0].points,1);assert.equal(h.hallClock(500),'8:20');

 const own=h.createHallDay();own.games[0].status='finished';own.games[0].goals=[{team:0,second:2,ownGoal:true,scorerId:'opponent',scorerName:'Own goal'}];assert.equal(h.hallScore(own.games[0],0),1);assert.equal(h.hallScorers(own).players.length,0);assert.equal(h.hallScorers(own).unassigned,0);
 const custom=h.createHallDay();const longer=h.withHallGameDuration(custom,0,620);assert.equal(h.hallGameSeconds(longer,longer.games[0]),620);assert.equal(h.hallGameSeconds(longer,longer.games[1]),500);assert.equal(h.hallPlanSeconds(longer),3720);assert.equal(longer.buffer,0);assert.equal(custom.games[0].seconds,undefined,'immutable duration update');
 const shorter=h.withHallGameDuration(custom,1,300);assert.equal(h.hallPlanSeconds(shorter),3400);assert.equal(shorter.buffer,200);
 for(const invalid of [0,59,1801,61.5,NaN])assert.throws(()=>h.withHallGameDuration(custom,0,invalid));
 custom.games[0].status='running';assert.throws(()=>h.withHallGameDuration(custom,0,600));custom.games[0].status='finished';assert.throws(()=>h.withHallGameDuration(custom,0,600));
 custom.games[0].goals=[{team:0,second:2,scorerId:'a',scorerName:'Same Name'},{team:1,second:4,scorerId:'b',scorerName:'Same Name'},{team:0,second:5}];custom.games[1].status='finished';custom.games[1].goals=[{team:2,second:6,scorerId:'a',scorerName:'Same Name'},{team:0,second:8,scorerId:'b',scorerName:'Same Name'}];
 custom.games[2].status='running';custom.games[2].goals=[{team:1,second:1,scorerId:'c',scorerName:'Live scorer'}];const top=h.hallScorers(custom);assert.equal(top.unassigned,1);assert.equal(top.players.length,2,'same name with different IDs stays separate; running game excluded');assert.deepEqual(top.players.map(p=>[p.goals,p.rank]),[[2,1],[2,1]]);assert.deepEqual(top.players.find(p=>p.id==='a').teams,[0,2]);
 const rotation=h.createHallDay(3,3);rotation.teams.forEach((t,i)=>t.playerIds=Array.from({length:i===0?4:3},(_,j)=>i+'-'+j));let tracked=h.prepareHallPlayers(rotation,0);assert.equal(tracked.games[0].participation[0].stints[0].on.length,3);tracked.games[0].status='running';tracked.games[0].runningSince=1000;tracked=h.changeHallPlayers(tracked,0,0,['0-0','0-1','0-3'],61000);let times=new Map(h.hallPlayerTimes(tracked,121000).players.map(p=>[p.id,p.seconds]));assert.equal(times.get('0-2'),60);assert.equal(times.get('0-3'),60);assert.equal(times.get('0-0'),120);tracked.games[0].status='paused';tracked.games[0].elapsed=120;tracked.games[0].runningSince=null;assert.equal(h.hallPlayerTimes(tracked,999999).players.find(p=>p.id==='0-0').seconds,120);tracked=h.changeHallPlayers(tracked,0,0,['0-0','0-1','0-2','0-3']);assert.equal(tracked.games[0].participation[0].stints.at(-1).on.length,4);assert.throws(()=>h.changeHallPlayers(tracked,0,0,['foreign','0-1','0-2']));assert.throws(()=>h.changeHallPlayers(tracked,0,0,['0-1','0-1','0-2']));tracked.games[0].status='finished';assert.throws(()=>h.changeHallPlayers(tracked,0,0,['0-0','0-1','0-2']));tracked.teams[0].playerIds=['new1','new2','new3'];assert.equal(h.hallPlayerTimes(tracked).players.find(p=>p.id==='0-0').seconds,120);assert.equal(h.hallPlayerTimes(day).untracked,1);
 console.log('PASS: exact time budgets, equal games for every team, complete pairings, 3/4 teams, invalid inputs, hall-only detection, roster changes, clock resume/cap, internal standings.');
} finally {rmSync(tmp,{recursive:true,force:true});}
