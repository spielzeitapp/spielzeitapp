import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
async function compile(path){const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'fixtures',setup(a){
a.onResolve({filter:/auth\/useSession$/},()=>({path:'session',namespace:'fixture'}));
a.onResolve({filter:/supabaseClient$/},()=>({path:'db',namespace:'fixture'}));
a.onResolve({filter:/^react-router-dom$/},()=>({path:'router',namespace:'fixture'}));
a.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:({session:'export const useSession=()=>globalThis.fixtureSession;',db:'export const supabase={rpc:(...args)=>globalThis.fixtureRpc(...args)};',router:"import React from 'react';export const Link=p=>React.createElement('a',p,p.children);"})[path]}));
}}]});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const lib=await compile('src/lib/seasonLifecycleAssistant.ts');
assert.deepEqual(lib.parseOefbSeasonTarget('https://vereine.oefb.at/USC/Mannschaften/Saison-2027-28/U13/Spiele/'),{name:'2027/28',age:'U13'});
for(const url of ['https://evil.example/Mannschaften/Saison-2027-28/U13/Spiele/','https://vereine.oefb.at/Mannschaften/Saison-2027-29/KM/Spiele/','not-a-url'])assert.equal(lib.parseOefbSeasonTarget(url),null);
const snapshot={source_id:'old',target_id:'new',status:'active',club_name:'Club',team_name:'KM',season_name:'2026/27',next_season_name:'2027/28',target_season_name:'2027/28',target_status:'draft',target_age_group:'KM',possible_end:true,known_games:26,open_games:0,running_games:0,fingerprint:'expected',roster:[{id:'player',name:'Player',number:2}]};
assert.equal(lib.shouldShowLifecycle(snapshot),true);
assert.equal(lib.shouldShowLifecycle({...snapshot,snoozed_until:'2099-01-01'}),false);
const React=require('react'),{create,act}=require('react-test-renderer');
const previous=globalThis.window;globalThis.window={addEventListener(){},removeEventListener(){},setInterval(){return 1},clearInterval(){},dispatchEvent(){}};
const calls=[];globalThis.fixtureSession={backendRole:'fan',reloadSessionTeamSeasons:async()=>{},setSelectedTeamSeasonId(){},setViewTeamSeasonId(){}};
globalThis.fixtureRpc=async(name,args)=>{calls.push({name,args});return {data:name==='get_season_lifecycle'?[snapshot]:snapshot,error:null};};
const {SeasonLifecycleAssistant}=await compile('src/components/season/SeasonLifecycleAssistant.tsx');
let root;const render=async()=>act(async()=>{const e=React.createElement(SeasonLifecycleAssistant,{seasonId:'old'});if(root)root.update(e);else root=create(e);await new Promise(r=>setImmediate(r));});
try{
await render();assert.equal(calls.length,0,'fan cannot fetch lifecycle data');
globalThis.fixtureSession.backendRole='trainer';await render();
assert.equal(calls.filter(c=>c.name==='finish_season_lifecycle').length,0,'background load never archives');
const button=text=>root.root.findAllByType('button').find(b=>String(b.props.children).includes(text));
await act(async()=>{await button('Vorbereitung / Abschluss').props.onClick();await new Promise(r=>setImmediate(r));});
assert.equal(button('Abschließen &').props.disabled,true,'explicit confirmation required');
let checks=root.root.findAllByType('input').filter(i=>i.props.type==='checkbox');
await act(async()=>checks.at(-1).props.onChange({target:{checked:true}}));
await act(async()=>{await button('Abschließen &').props.onClick();await new Promise(r=>setImmediate(r));});
const finish=calls.find(c=>c.name==='finish_season_lifecycle');assert.equal(finish.args.p_fingerprint,'expected');assert.equal(finish.args.p_confirm,true);assert.deepEqual(finish.args.p_players,['player']);assert.equal(finish.args.p_enable_sync,false);
snapshot.open_games=1;
await act(async()=>{await button('Vorbereitung / Abschluss').props.onClick();await new Promise(r=>setImmediate(r));});
checks=root.root.findAllByType('input').filter(i=>i.props.type==='checkbox');assert.equal(checks.at(-1).props.disabled,true,'open match blocks confirmation');
console.log('PASS: provider season validation, snooze, role isolation, no background archive, explicit roster/fingerprint approval, open-match guard.');
}finally{if(root)await act(async()=>root.unmount());globalThis.window=previous;delete globalThis.fixtureSession;delete globalThis.fixtureRpc;}
