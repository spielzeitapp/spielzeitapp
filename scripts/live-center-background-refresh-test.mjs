import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url),dir=mkdtempSync(join(tmpdir(),'live-refresh-'));
try{
await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React from 'react';import TestRenderer,{act} from 'react-test-renderer';import {MemoryRouter} from 'react-router-dom';import {LivePage} from './src/pages/LivePage';export {React,TestRenderer,act,MemoryRouter,LivePage};`},bundle:true,platform:'node',format:'cjs',outfile:join(dir,'test.cjs'),define:{'import.meta.env':'{}'},logLevel:'silent',plugins:[{name:'stubs',setup(b){b.onResolve({filter:/supabaseClient$|useSession$|LivePremiumShell$|MatchCenterIdleView$|LiveMatchScreen$|DemoContext$|demoPaths$|demoMatchState$|\/ui$|premiumDesignSystem$/},a=>({path:a.path.split('/').pop(),namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({resolveDir:process.cwd(),contents:({supabaseClient:`export const supabase={from(){const q=new Proxy({}, {get:(o,k)=>k==='returns'?()=>globalThis.probe():k==='maybeSingle'?()=>globalThis.single():()=>q});return q;}};`,useSession:`export const useSession=()=>({effectiveRole:globalThis.role ?? 'trainer',selectedTeamSeasonId:'team'});`,LivePremiumShell:`import React from 'react';export const LivePremiumShell=({children})=>React.createElement('main',null,children);export const LivePageHeader=()=>null;export const LiveScheduleCtaLink=()=>null;`,MatchCenterIdleView:`import React from 'react';export function MatchCenterIdleView(){React.useEffect(()=>{globalThis.mounts++},[]);return React.createElement('section',null,'Vorschau');}`,LiveMatchScreen:`import React from 'react';import {useLocation} from 'react-router-dom'; export const LiveMatchScreen=()=>React.createElement('output',null,useLocation().search);`,DemoContext:`export const useDemoMode=()=>null;`,demoPaths:`export const useInternalBasePath=()=>'/app';`,demoMatchState:`export const DEMO_MATCH_ID_LIVE='demo',DEMO_MATCH_ID_PAST='past',DEMO_MATCH_ID_PAST_OLDER='older';`,ui:`export const PremiumCard=()=>null,PremiumEmptyState=()=>null;`,premiumDesignSystem:`export const dsPrimaryCtaClass=()=>'';`})[a.path]}));}}]});
const {React,TestRenderer,act,MemoryRouter,LivePage}=require(join(dir,'test.cjs'));let poll,resolve;globalThis.mounts=0;globalThis.probe=async()=>({data:[],error:null});globalThis.window={addEventListener(){},removeEventListener(){},setInterval(fn){poll=fn;return 1},clearInterval(){},setTimeout,clearTimeout};let view;
await act(async()=>{view=TestRenderer.create(React.createElement(MemoryRouter,null,React.createElement(LivePage)))});assert.equal(mounts,1);
globalThis.probe=()=>new Promise(r=>resolve=r);
await act(async()=>poll());assert.equal(view.root.findAllByType('section').length,1,'slow background refresh must keep preview visible');assert.equal(mounts,1);
await act(async()=>resolve({data:[],error:null}));assert.equal(mounts,1,'refresh must not remount preview');await act(async()=>view.unmount());console.log('PASS pending and completed background probes retain the mounted Match Center');
let requestedMatchReads=0;
globalThis.single=async()=>{requestedMatchReads++;return {data:{status:'upcoming',id:'other-live-match'},error:null}};
const selected='/app/live?matchId=selected-match&centerEventId=tournament';
await act(async()=>{view=TestRenderer.create(React.createElement(MemoryRouter,{initialEntries:[selected]},React.createElement(LivePage)))});
await act(async()=>poll());
assert.equal(requestedMatchReads,0,'trainer kickoff must not probe another live match');
assert.equal(view.root.findByType('output').children[0],selected.split('/live')[1],'trainer retains selected match and event context');
await act(async()=>view.unmount());

globalThis.role='parent';
globalThis.single=async()=>{requestedMatchReads++;return {data:{status:'live',id:'other-live-match'},error:null}};
await act(async()=>{view=TestRenderer.create(React.createElement(MemoryRouter,{initialEntries:[selected]},React.createElement(LivePage)))});
assert.equal(view.root.findByType('output').children[0],'?matchId=other-live-match','spectator follows the current live match');
await act(async()=>view.unmount());
console.log('PASS kickoff stays on the selected match while spectator live following still works');
}finally{rmSync(dir,{recursive:true,force:true})}
process.exit(0);
