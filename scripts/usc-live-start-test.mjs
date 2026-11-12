import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), React=require('react'), {act,create}=require('react-test-renderer'), {MemoryRouter}=require('react-router-dom');
const km={id:'km',team_id:'km-team',age_group:'KM',status:'active',team:{name:'USC Rohrbach',club_id:'3db6fce2-a4c1-44a5-a333-19d1d4d62e6a'},season:{name:'2026/27'}};
const u13={...km,id:'u13',age_group:'U13',team:{name:'SPG Rohrbach',club_id:'9c7a8741-6e73-42d5-88d8-46ce5217e8cd'}};
const live=(id,team_season_id)=>({id,team_season_id,status:'live',opponent:'Gegner',score_home:2,score_away:1,match_date:new Date().toISOString(),live_elapsed_seconds:780,live_is_running:true});
globalThis.__uscLiveRows=[live('m1','km'),live('m2','u13'),live('foreign','other')];
globalThis.__uscLiveEvents=[{id:'e1',match_id:'m1',team_season_id:'km',is_home:false,opponent:'Loosdorf',starts_at:new Date().toISOString(),type:'game',kind:'match',status:'live'},{id:'e2',match_id:'m2',team_season_id:'u13',is_home:true,opponent:'Rabenstein',starts_at:new Date().toISOString(),type:'game',kind:'match',status:'live'}];
globalThis.__uscTickerReads=[];globalThis.__uscScopedReads=[];
const timers=new Map();let timerId=0;const sessions=new Map();
globalThis.window={setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id),setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),addEventListener(){},removeEventListener(){},sessionStorage:{getItem:key=>sessions.get(key)??null,setItem:(key,value)=>sessions.set(key,value)}};
globalThis.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
const mocks={
 supabaseClient:`export const supabase={from(table){if(table!=='matches')throw Error('Unexpected table '+table);const q={select(){return q},in(key,ids){globalThis.__uscScopedReads.push({key,ids});return q},eq(){return q},order(){return q},then(fn){return Promise.resolve(globalThis.__uscLiveError?{data:null,error:{message:'offline'}}:{data:globalThis.__uscLiveRows,error:null}).then(fn)}};return q}};`,
 liveMatchBroadcast:'export const subscribeLiveMatchStateChanged=()=>()=>{};',
 usePlayers:'export const usePlayers=()=>({players:[]});',
 useEvents:'export const useEvents=()=>({events:globalThis.__uscLiveEvents,loading:false,error:null,refetch:async()=>{}});',
 useMatchTimer:'export const useMatchTimer=()=>({currentMatchSeconds:780});',
 useMatchClubBranding:'export const useMatchClubBranding=()=>({brand:{logo_url:"/real-club-logo.png"}});',
 ClubLogo:'import React from "react";export const ClubLogo=({src,alt,...rest})=>React.createElement("img",{src,alt});',
 liveMatchService:`export const fetchMatchById=async id=>({data:globalThis.__uscLiveRows.find(m=>m.id===id)??null,error:null});export const fetchMatchEvents=async id=>{globalThis.__uscTickerReads.push(id);return {data:[{id:'goal',type:'goal',timestamp:780},{id:'start',type:'start',timestamp:0}],error:null}};`,
 scheduleActiveLiveMatch:'export const fetchActiveScheduleLiveMatch=async()=>null;',
};
const result=await build({entryPoints:['src/features/club/UscClubLive.tsx','src/features/club/uscLive.ts','src/features/club/UscClubStart.tsx'],outdir:'out',bundle:true,format:'cjs',platform:'node',packages:'external',write:false,define:{'import.meta.env':'{}'},plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',external:true}));b.onResolve({filter:/supabaseClient$|liveMatchBroadcast$|useEvents$|usePlayers$|useMatchTimer$|useMatchClubBranding$|ClubLogo$|liveMatchService$|scheduleActiveLiveMatch$/},a=>({path:a.path.split('/').pop(),namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
const modules=result.outputFiles.map(f=>{const m={exports:{}};new Function('require','module','exports',f.text)(require,m,m.exports);return m.exports;});
const {UscClubLive}=modules[0],{useUscLiveMatches,viennaDay}=modules[1],{UscClubStart}=modules[2];
assert.equal(viennaDay('2026-11-12T23:30:00Z'),'2026-11-13');
assert.equal(viennaDay('2026-07-01T22:30:00Z'),'2026-07-02');
let tree,probe;
function Probe({uid,scopes}) {probe=useUscLiveMatches(uid,scopes);return null;}
await act(async()=>{tree=create(React.createElement(Probe,{uid:'one',scopes:[km,u13]}));});
assert.deepEqual(probe.rows.map(m=>m.id),['m1','m2']);
assert.deepEqual(globalThis.__uscScopedReads.at(-1),{key:'team_season_id',ids:['km','u13']});
await act(async()=>tree.update(React.createElement(Probe,{uid:'two',scopes:[u13]})));
assert.deepEqual(probe.rows.map(m=>m.id),['m2']);
await act(async()=>tree.update(React.createElement(Probe,{uid:null,scopes:[km]})));
assert.deepEqual(probe.rows,[]);assert.equal(timers.size,0);
await act(async()=>tree.unmount());
const liveState={rows:globalThis.__uscLiveRows.filter(m=>m.id!=='foreign'),loading:false,error:false,refetch(){}};
async function mount(path='/app/usc-rohrbach?tab=live',scopes=[km,u13],state=liveState){await act(async()=>{tree=create(React.createElement(MemoryRouter,{initialEntries:[path]},React.createElement(UscClubLive,{seasons:scopes,live:state,onOpenTeamFilter(){globalThis.__filterOpened=true;}})));});}
const html=()=>JSON.stringify(tree.toJSON());
const click=async text=>{const button=tree.root.findAllByType('button').find(b=>b.children.some(c=>typeof c==='string'&&c.trim()===text.trim()));assert.ok(button,text);await act(async()=>button.props.onClick());};
await mount();assert.equal(tree.root.findAllByProps({className:'usc-live-card'}).length,2);
const boards=tree.root.findAllByProps({className:'usc-live-scoreboard'});
assert.match(JSON.stringify(boards[0].toJSON?.()??boards[0].findAllByType('strong').map(x=>x.children)),/Loosdorf.*USC Rohrbach/,'away match keeps stadium ordering');
assert.match(html(),/SPG Rohrbach/);
assert.equal(tree.root.findAllByType('a').length,1,'only KM has external portal');
await click('U13');assert.equal(tree.root.findAllByProps({className:'usc-live-card'}).length,1);assert.equal(tree.root.findAllByType('a').length,0);
await click('Alle');await click('Zum Liveticker ');
assert.ok(tree.root.findByProps({'aria-label':'USC Liveticker'}));assert.deepEqual(globalThis.__uscTickerReads,['m1']);assert.match(html(),/Tor Heimmannschaft/);
await click('Alle Livespiele');assert.ok(tree.root.findByProps({'aria-label':'USC Liveübersicht'}));
await act(async()=>tree.unmount());
await mount('/app/usc-rohrbach?tab=live&liveMatch=foreign');assert.match(html(),/nicht verfügbar/);assert.deepEqual(globalThis.__uscTickerReads,['m1'],'foreign URL cannot load ticker entries');await act(async()=>tree.unmount());
await mount('/app/usc-rohrbach?tab=live',[],{...liveState,rows:[]});await click('Mannschaften auswählen');assert.equal(globalThis.__filterOpened,true);await act(async()=>tree.unmount());
globalThis.__uscLiveError=true;await act(async()=>{tree=create(React.createElement(Probe,{uid:'one',scopes:[km]}));});assert.equal(probe.error,true);assert.deepEqual(probe.rows,[]);await act(async()=>tree.unmount());
await act(async()=>{tree=create(React.createElement(UscClubStart,{enabled:true,ready:true}));});assert.match(html(),/welcome-action.jpg/);await click('Zum USC');assert.equal(tree.toJSON(),null);await act(async()=>tree.unmount());
await act(async()=>{tree=create(React.createElement(UscClubStart,{enabled:true,ready:true}));});assert.equal(tree.toJSON(),null,'start only once per browser session');await act(async()=>tree.unmount());
sessions.clear();await act(async()=>{tree=create(React.createElement(UscClubStart,{enabled:false,ready:true}));});assert.equal(tree.toJSON(),null,'direct ticker links bypass splash');await act(async()=>tree.unmount());
assert.equal(timers.size,0,'all polling and splash timers cleaned up');
console.log('PASS USC live: selected scopes, multiple games, away ordering, partner label, KM-only external portal, internal ticker/back, foreign match rejection, empty/error recovery, Vienna date boundary, once-per-session dismissible photo start.');
