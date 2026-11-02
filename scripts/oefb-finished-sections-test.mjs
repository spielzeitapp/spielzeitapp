import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), React=require('react'), {create,act}=require('react-test-renderer');
let rows=[{player_id:'mia',payload:{starter:true,calculatedMinutes:80}},{player_id:'sub',payload:{starter:false,calculatedMinutes:null}}];
globalThis.__loadMinutes=async()=>rows;
const b=await build({entryPoints:['src/components/match/OefbFinishedMatchSection.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'data',setup(b){
 b.onResolve({filter:/^react$/},()=>({path:'react',external:true}));
 b.onResolve({filter:/\/OefbLiveReport$/},()=>({path:'report',namespace:'mock'}));
 b.onResolve({filter:/stats\/oefbAppearances$/},()=>({path:'minutes',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='minutes'?'export const fetchOefbAppearances=(...a)=>globalThis.__loadMinutes(...a)':'import React from "react"; export const OefbLiveReport=({view,report})=>React.createElement("div",{"data-view":view},report.home);'}));
}}]});
const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);
const {finishedOefbFallback:select,OefbFinishedMatchSection:Section}=m.exports;
const report={id:'4181002',home:'Waidhofen',away:'Melk',score:'0:6',ownSide:'away',homePlayers:[],awayPlayers:[{name:'Mia Fletzberger',profileId:'mia'}],events:[]};
const source={report,loading:false,error:null};
for(const lineup of [false,true])for(const events of [false,true]){
 const r=select(source,'0:6',{lineup,events},true);
 assert.equal(r.lineup,!lineup);assert.equal(r.timeline,!events);assert.equal(r.stats,!lineup&&!events);
}
assert.equal(select(source,'0:6',{lineup:false,events:false},false).lineup,false);
const mismatch=select(source,'1:6',{lineup:false,events:false},true);
assert.equal(mismatch.source.report,null);assert.match(mismatch.source.error,/abweicht|weicht/);
let r;const props={source,matchId:'match',players:[{id:'mia',name:'Mia Fletzberger'},{id:'sub',name:'Substitute'}]};
for(const [view,expected] of [['lineup','lineup'],['timeline','events']]){
 await act(async()=>{r=create(React.createElement(Section,{...props,view}));});
 assert.equal(r.root.findByProps({'data-view':expected}).children[0],'Waidhofen');
 await act(async()=>r.unmount());
}
await act(async()=>{r=create(React.createElement(Section,{...props,view:'stats'}));});
assert.equal(r.root.findAllByType('li').length,2);let text=JSON.stringify(r.toJSON());
assert.ok(text.includes('Mia Fletzberger'));assert.ok(text.includes('80 Min.'));assert.ok(text.includes('—'));assert.ok(!text.includes('"0 Min."'));
await act(async()=>r.update(React.createElement(Section,{...props,view:'lineup',source:{report:null,loading:true,error:null}})));
assert.match(JSON.stringify(r.toJSON()),/wird geladen/);
await act(async()=>r.update(React.createElement(Section,{...props,view:'lineup',source:mismatch.source})));
assert.match(JSON.stringify(r.toJSON()),/weicht/);assert.equal(r.root.findAllByType('li').length,0);
await act(async()=>r.unmount());
// A late result from the previous match must not replace the current match's minutes.
let resolveOld;globalThis.__loadMinutes=id=>id[0]==='old'?new Promise(resolve=>{resolveOld=resolve}):Promise.resolve([{player_id:'sub',payload:{starter:false,calculatedMinutes:null}}]);
await act(async()=>{r=create(React.createElement(Section,{...props,matchId:'old',view:'stats'}));});
await act(async()=>r.update(React.createElement(Section,{...props,matchId:'new',view:'stats'})));
await act(async()=>resolveOld(rows));
assert.equal(r.root.findAllByType('li').length,1);assert.ok(!JSON.stringify(r.toJSON()).includes('80 Min.'));
await act(async()=>r.unmount());
console.log('PASS: finished event source lineups/ticker/minutes; native section precedence, score mismatch rejection, unknown minutes, loading/errors, stale match isolation.');
