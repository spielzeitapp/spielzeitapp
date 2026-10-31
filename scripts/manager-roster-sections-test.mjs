import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require=createRequire(import.meta.url), React=require('react'), {create,act}=require('react-test-renderer');
let season='first';globalThis.__rosterSectionSeason=()=>season;
const fixtures={
 'react-router-dom':`export const useParams=()=>({seasonId:globalThis.__rosterSectionSeason()});export const Link=({children})=>children;export const Navigate=()=>null;`,
 'useSession':`const setViewTeamSeasonId=()=>{};export const useSession=()=>({effectiveRole:'admin',backendRole:'admin',setViewTeamSeasonId});`,
 'seasonLifecycle':`export const canPrepareNextSeason=()=>true,formatTeamSeasonContextLabel=()=> 'Synthetic team',getSeasonStatusLabel=()=> 'Aktiv',isSeasonArchived=()=>false;`,
 'rosterService':`export const listRoster=async()=>({data:[],error:null}),createRosterPlayer=()=>{},updateRosterPlayerSeasonFields=()=>{};`,
 'seasonTransition':`export const getTeamSeasonWritableState=async()=>({writable:true});`,
 'appEnvironment':`export const isStagingApp=()=>true,supabaseUrlLooksLikeStaging=()=>true;`,
 'supabaseClient':`const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{status:'active',teams:{name:'Synthetic'},seasons:{name:'2026/27'}}})};export const supabase={from:()=>query,rpc:async()=>({data:{links:[]}})};`,
 'ManagerWorkModeContext':`export const useManagerWorkMode=()=>({workMode:'platform_admin'});`,
 'ManagerOefbPlayerAssignments':`import React from 'react';export const ManagerOefbPlayerAssignments=()=>React.createElement('section',{'data-test':'assignments'});`,
 'ManagerOefbRosterPreview':`import React from 'react';export const ManagerOefbRosterPreview=()=>React.createElement('section',{'data-test':'roster'});`,
 'ManagerRosterPlayerActions':`export const ManagerRosterPlayerActions=()=>null;`,
 'OefbPlayerPhoto':`export const OefbPlayerPhoto=()=>null;`,
};
const compiled=await build({entryPoints:['src/manager/ManagerSeasonRosterPage.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,define:{'import.meta.env.VITE_SUPABASE_URL':'"synthetic"'},plugins:[{name:'fixtures',setup(api){
 api.onResolve({filter:/^react$/},()=>({path:'react',external:true}));
 api.onResolve({filter:/.*/},args=>{const name=args.path.split('/').at(-1);if(fixtures[name])return {path:name,namespace:'fixture'};});
 api.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:fixtures[args.path]}));
}}]});
const mod={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);
const oldError=console.error, errors=[];console.error=(...args)=>errors.push(args.join(' '));let root;
try {
 for(let i=0;i<6;i++) {season=`season-${i%2}`;await act(async()=>{const node=React.createElement(mod.exports.ManagerSeasonRosterPage);if(root)root.update(node);else root=create(node);await new Promise(r=>setImmediate(r));});
  for(const marker of ['assignments','roster'])assert.equal(root.root.findAll(x=>x.props['data-test']===marker).length,1,`${marker} appears once after loading/scope changes`);
 }
 assert.equal(errors.filter(s=>/same key|unique.*key/i.test(s)).length,0,errors.join('\n'));
 console.log('PASS: actual roster page renders exactly one of each ÖFB section with unique sibling keys across loading and season changes.');
} finally {if(root)await act(async()=>root.unmount());console.error=oldError;delete globalThis.__rosterSectionSeason;}
