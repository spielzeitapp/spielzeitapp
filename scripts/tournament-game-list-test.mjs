import {createRequire} from 'node:module';import{mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
const require=createRequire(import.meta.url),{build}=require('esbuild'),dir=mkdtempSync(join(tmpdir(),'game-list-'));
try{const file=join(dir,'test.cjs');await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {MemoryRouter} from 'react-router-dom';import TestRenderer,{act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {TournamentLineupTemplatePanel} from './src/components/tournament/TournamentLineupTemplatePanel';
import {calls} from './src/lib/tournamentLineupTemplates';
module.exports=(async()=>{
const players=Array.from({length:12},(_,i)=>({id:'p'+i,last_name:'Player'+i,display_name:'Player '+i,jersey_number:i+1}));
const games=[{id:'s1',match_id:'m1',opponent_name:'A',kickoff_at:'2026-11-27T16:14:00Z',match_status:'upcoming',has_lineup:false},{id:'s2',match_id:'m2',opponent_name:'B',kickoff_at:'2026-11-27T17:10:00Z',match_status:'upcoming',has_lineup:false},{id:'s3',match_id:'m3',opponent_name:'C',kickoff_at:'2026-11-27T17:52:00Z',match_status:'upcoming',has_lineup:true},{id:'s4',match_id:'m4',opponent_name:'D',kickoff_at:'2026-11-27T18:20:00Z',match_status:'finished',has_lineup:true}];
let view;await act(async()=>{view=TestRenderer.create(<MemoryRouter><TournamentLineupTemplatePanel eventId="e1" players={players} slots={games} refreshToken={0} onSaved={()=>{}} onReady={()=>{}} canEdit/></MemoryRouter>)});
const bulk=view.root.findAllByType('button').find(b=>String(b.props.children).includes('Kader & Aufstellung für alle'));
assert(bulk);assert(!bulk.props.disabled);await act(async()=>{await bulk.props.onClick()});
assert.deepEqual(calls,['m1','m2']);assert(!view.root.findAllByType('button').some(b=>String(b.props.children).includes('Kader & Aufstellung für alle')));
assert.equal(view.root.findAllByType('button').filter(b=>b.props['aria-label']?.includes('Vorbereitet')).length,3);
act(()=>view.unmount());console.log('PASS bulk applies only empty upcoming games once; prepared/finished untouched; list status updates');})();
`},bundle:true,platform:'node',format:'cjs',outfile:file,define:{'import.meta.env':'{"BASE_URL":"/"}'},logLevel:'silent',plugins:[{name:'test-stubs',setup(b){
b.onResolve({filter:/tournamentLineupTemplates$|tournamentSquad$|DemoContext$|demoPaths$|supabaseClient$/},a=>({path:a.path.split('/').pop(),namespace:'stub'}));
b.onLoad({filter:/.*/,namespace:'stub'},a=>({loader:'ts',resolveDir:process.cwd(),contents:a.path.endsWith('supabaseClient')?`export const supabase={};`:a.path.endsWith('tournamentLineupTemplates')?`
import {emptyTournamentTemplate} from './src/lib/tournamentLineupTemplate';import{U11_FORMATIONS}from'./src/lib/matchFormations';
export const calls=[];const ids=Array.from({length:12},(_,i)=>'p'+i);const blocks=emptyTournamentTemplate(ids,'1-2-1-2','blocks');for(const n of [1,2])U11_FORMATIONS[blocks.variants[n].formationId].forEach((row,i)=>blocks.variants[n].slots[row.slot]=ids[i]);
export const fetchTournamentLineupTemplate=async()=>({blocks,updated_at:'stamp'});export const saveTournamentLineupTemplate=async()=> 'stamp';export const applyTournamentLineupTemplate=async(e,m,r)=>{if(r.blocks.variants[r.blocks.startVariant].formationId!=='1-2-1-2'||r.blocks.variants[1].squadIds.length!==12)throw Error('Turnierformat oder Kader verloren');calls.push(m)};
`:a.path.endsWith('tournamentSquad')?`export const fetchTournamentSquadPlayerIds=async()=>({data:Array.from({length:12},(_,i)=>'p'+i),error:null});`:a.path.endsWith('DemoContext')?`export const useDemoMode=()=>null;`:`export const useInternalBasePath=()=>'/app';`}));
}}]});await require(file);}finally{rmSync(dir,{recursive:true,force:true})}

process.exit(0);
