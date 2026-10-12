const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oefb-assign-'));
const out=path.join(dir,'preview.cjs');
require('esbuild').buildSync({entryPoints:['src/lib/oefbPlayerAssignments.ts'],bundle:true,platform:'node',outfile:out});
const {assignmentPreview}=require(out);
const report={id:'4134586',score:'1:2',homePlayers:[{name:'Gegner',externalPlayerId:'111'}],awayPlayers:[{name:'Unser Spieler',externalPlayerId:'222'}],events:[
 {type:'goal',player:'Unser Spieler',externalPlayerId:'222',side:'away',score:'1:2',ownGoal:false,minute:89},
 {type:'goal',player:'Unser Spieler',externalPlayerId:'222',side:'away',score:'0:1',ownGoal:false,minute:2},
 {type:'goal',player:'Unser Spieler',externalPlayerId:'222',side:'away',score:'1:1',ownGoal:true,minute:32},
]};
const away=assignmentPreview(report,false);
assert.deepEqual(away.players,[{name:'Unser Spieler',externalPlayerId:'222'}]);
assert.deepEqual(away.report.goals.map(g=>`${g.home}:${g.away}`),['0:1','1:1','1:2']);
assert.equal(away.report.goals[1].own_goal,true);
assert.equal(assignmentPreview({...report,events:report.events.slice(0,2)},false).report,null);
assert.equal(assignmentPreview({...report,score:null},false).report,null);
assert.equal(assignmentPreview({...report,score:'0:0',events:[]},false).report.goals.length,0);
assert.deepEqual(assignmentPreview(report,true).players,[{name:'Gegner',externalPlayerId:'111'}]);
const sameNames=assignmentPreview({...report,awayPlayers:[{name:'Gleich Name',externalPlayerId:'223'},{name:'Gleich Name',externalPlayerId:'224'}]},false);
assert.equal(sameNames.players.filter(p=>p.name==='Gleich Name').length,2);
fs.rmSync(dir,{recursive:true});console.log('PASS own team only, stable player IDs, score-ordered goals, own goals retained for exclusion, incomplete report skipped, real 0:0, same-name players distinct');
