import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {unlinkSync} from 'node:fs';
const out='node_modules/.training-history-editor-test.mjs';
try {
await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import TestRenderer,{act} from 'react-test-renderer';import assert from 'node:assert/strict';import {TrainingHistoryEditor} from './src/components/team/TrainingHistoryEditor';
globalThis.row={status:'other_team_training',note:'Rapidcamp'};globalThis.writable=true;globalThis.fail=false;globalThis.writes=[];let refreshed=0;let view;
await act(async()=>{view=TestRenderer.create(<TrainingHistoryEditor eventId="training" player={{id:'jacob',display_name:'Jacob',is_laz_player:false}} status="other_team" onSaved={async()=>{refreshed++}}/>)});
const click=async(label)=>{const b=view.root.findAllByType('button').find(b=>b.children.join('')===label);assert(b,label);await act(async()=>{await b.props.onClick()})};
await click('Teilnahme ändern');assert.equal(view.root.findByType('input').props.value,'Rapidcamp');await click('Dabei');await click('Änderung speichern');assert.equal(globalThis.writes[0].status,'yes');assert.equal(globalThis.writes[0].note,null);assert.equal(refreshed,1);
await click('Teilnahme ändern');globalThis.writable=false;await click('Änderung speichern');assert.equal(globalThis.writes.length,1);assert.equal(refreshed,1);assert(JSON.stringify(view.toJSON()).includes('Archiv'));
globalThis.writable=true;globalThis.fail=true;await click('Änderung speichern');assert.equal(refreshed,1);assert(JSON.stringify(view.toJSON()).includes('Speichern fehlgeschlagen'));await act(async()=>view.unmount());console.log('PASS: existing camp note, attendance write, stats refresh, archive rejection, failed save');
`},bundle:true,platform:'node',format:'esm',outfile:out,external:['react','react-test-renderer'],plugins:[{name:'mock',setup(b){b.onResolve({filter:/supabaseClient|seasonTransition|app\/ui\/Modal/},args=>({path:args.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},args=>({loader:'tsx',contents:args.path.includes('Modal')?`import React from 'react';export const Modal=({open,children})=>open?<div>{children}</div>:null;`:args.path.includes('seasonTransition')?`export const assertTeamSeasonWritable=async()=>globalThis.writable?{ok:true}:{ok:false,message:'Archiv'};`:`export const supabase={from(table){let write;return {select(){return this},eq(){return this},maybeSingle:async()=>({data:globalThis.row}),upsert(payload){write=payload;return this},async single(){if(table==='events')return {data:{kind:'training',team_season_id:'season'}};if(globalThis.fail)return {error:new Error('Speichern fehlgeschlagen')};globalThis.writes.push(write);return {data:write}}}}};`}));}}]});
const r=spawnSync(process.execPath,[out],{stdio:'inherit'});if(r.status)process.exitCode=r.status;
}finally{try{unlinkSync(out)}catch{}}
