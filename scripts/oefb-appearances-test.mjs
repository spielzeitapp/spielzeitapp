import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';import fs from 'node:fs';const require=createRequire(import.meta.url);
const b=await build({entryPoints:['src/lib/stats/oefbAppearances.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'db',setup(b){b.onResolve({filter:/supabaseClient$/},()=>({path:'db',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase={};'}));}}]});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);const {reportAppearances,unchangedStarterMinutes,calculatedPlayerMinutes}=m.exports;
const links=[{external_player_id:'1',player_id:'a',source_name:'A Starter'},{external_player_id:'2',player_id:'b',source_name:'B Substitute'},{external_player_id:'3',player_id:'c',source_name:'C Bench'}];
const report={score:'0:0',homePlayers:[{name:'A Starter',externalPlayerId:'1'}],awayPlayers:[{name:'C Bench',externalPlayerId:'3'}],events:[{type:'playerchange',side:'home',player:'B Substitute',secondPlayer:'A Starter'}]};assert.deepEqual(reportAppearances(report,true,links),[{playerId:'a',starter:true},{playerId:'b',starter:false}]);assert.equal(reportAppearances(report,true,[]).length,0);assert.equal(reportAppearances(report,false,links).length,1);
if(fs.existsSync('/tmp/import-audit-links.json')){const actual=JSON.parse(fs.readFileSync('/tmp/import-audit-links.json','utf8')).filter(l=>l.team_season_id==='54acc3fd-b392-4c81-a5f7-f62c8c1bb2a0');const parser=require('../api/_lib/oefbMatchReport.js');const counts=new Map();for(const [id,home] of [['4174445',false],['4177767',false],['4166912',true],['4181002',false],['4194424',true],['4186969',false]]){const report=parser.extractReport(fs.readFileSync('/tmp/oefb-report-'+id+'.html','utf8'),id);const seen=reportAppearances(report,home,actual);assert.ok(seen.length>=9);for(const p of seen)counts.set(p.playerId,(counts.get(p.playerId)||0)+1);console.log('AUDIT',id,report.score,seen.length,'confirmed appearances');}for(const [id,n]of counts)console.log(actual.find(l=>l.player_id===id)?.source_name,n);assert.equal(counts.get(actual.find(l=>l.source_name==='Mia Fletzberger').player_id),6);let minutes=0;for(const [id,home] of [['4174445',false],['4177767',false],['4166912',true],['4181002',false],['4194424',true],['4186969',false]])minutes+=unchangedStarterMinutes(parser.extractReport(fs.readFileSync('/tmp/oefb-report-'+id+'.html','utf8'),id),home,actual.find(l=>l.source_name==='Mia Fletzberger').player_id,actual,80)??0;assert.equal(minutes,480);console.log('Mia: 480 calculated minutes, 80 average.');}
console.log('PASS: starters without goals and substitutes count; opponent and unconfirmed identities excluded; bench-only players excluded.');

assert.equal(unchangedStarterMinutes({...report,events:[]},true,'a',links,80),80);
assert.equal(unchangedStarterMinutes(report,true,'a',links,80),null);
assert.equal(unchangedStarterMinutes({...report,events:[]},true,'a',links,null),null);
assert.equal(unchangedStarterMinutes({...report,events:[]},true,'b',links,80),null);
assert.equal(unchangedStarterMinutes({...report,events:[{type:'card-red',side:'home',player:'A Starter',secondPlayer:''}]},true,'a',links,80),null);
console.log('PASS: only unchanged starters use confirmed duration; substitutes, dismissals and unconfirmed durations stay unknown.');

const swap=(minute,player='B Substitute',secondPlayer='A Starter')=>({type:'playerchange',side:'home',player,secondPlayer,minute});
const calc=(events,id='a',d=80)=>calculatedPlayerMinutes({...report,events},true,id,links,d);
assert.equal(calc([swap(50)]),50);assert.equal(calc([swap(50)],'b'),30);
assert.equal(calc([swap(20),swap(40,'A Starter','B Substitute'),swap(60)]),40);
assert.equal(calc([swap(20),swap(40,'A Starter','B Substitute'),swap(60)],'b'),40);
assert.equal(calc([swap(null)]),null);assert.equal(calc([swap(81)]),null);
assert.equal(calc([swap(50),swap(55)]),null);assert.equal(calc([],'c'),null);
assert.equal(calc([swap(0)],'a'),0);assert.equal(calc([swap(80)],'b'),0);
assert.equal(calc([{type:'card-red',side:'home',player:'A Starter',secondPlayer:'',minute:30}]),30);
assert.equal(calc([{type:'card-blue',side:'home',player:'A Starter',secondPlayer:'',minute:30}]),null);
assert.equal(calc([swap(50)],'a',null),null);
if(fs.existsSync('/tmp/import-audit-links.json')){
 const actual=JSON.parse(fs.readFileSync('/tmp/import-audit-links.json','utf8')).filter(l=>l.team_season_id==='54acc3fd-b392-4c81-a5f7-f62c8c1bb2a0');const parser=require('../api/_lib/oefbMatchReport.js');const totals=new Map();let known=0,unknown=0;
 for(const [id,home]of [['4174445',false],['4177767',false],['4166912',true],['4181002',false],['4194424',true],['4186969',false]]){
 const r=parser.extractReport(fs.readFileSync('/tmp/oefb-report-'+id+'.html','utf8'),id);
 for(const p of reportAppearances(r,home,actual)){const minutes=calculatedPlayerMinutes(r,home,p.playerId,actual,80);const t=totals.get(p.playerId)||{minutes:0,unknown:0};if(minutes===null){unknown++;t.unknown++;}else{known++;t.minutes+=minutes;}totals.set(p.playerId,t);}}
 console.log('INTERVAL AUDIT',JSON.stringify([...totals].map(([id,t])=>({name:actual.find(l=>l.player_id===id).source_name,...t}))),{known,unknown});
}
console.log('PASS: substitutions, re-entry, dismissal, unknown/malformed/out-of-range times, bench exclusion and confirmed duration.');
