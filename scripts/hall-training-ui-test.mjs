import {build} from 'esbuild';import {spawnSync} from 'node:child_process';import {unlinkSync} from 'node:fs';
const out='node_modules/.hall-training-ui-test.mjs';
try{
await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import TestRenderer,{act} from 'react-test-renderer';import assert from 'node:assert/strict';import {HallTrainingPlanner} from './src/components/training/HallTrainingPlanner';
globalThis.window={confirm:()=>true,setInterval:()=>1,clearInterval:()=>{}};globalThis.hallRow=null;globalThis.hallFail=false;
const ids=Array.from({length:9},(_,i)=>'player-'+i);const ready=[];const props={eventId:'test-hall',startsAt:'2026-11-13T16:00:00Z',players:ids.map((id,i)=>({id,display_name:'Spieler '+i})),availableIds:ids,open:true,onClose:()=>{},onReadyChange:r=>ready.push(r)};
let view;const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')||'';const button=label=>{const b=view.root.findAllByType('button').find(b=>text(b)===label);assert(b,label);return b;};const click=async label=>{const b=button(label);assert(!b.props.disabled,label+' disabled');await act(async()=>b.props.onClick());};
await act(async()=>{view=TestRenderer.create(<HallTrainingPlanner {...props}/>);});
assert(JSON.stringify(view.toJSON()).includes('8:20'));await click('Spielplan erstellen & speichern');assert.equal(globalThis.hallRow.revision,1);
await click('Zugesagte Spieler gleichmäßig verteilen');await click('Mannschaften speichern');assert.equal(globalThis.hallRow.revision,2);assert.equal(ready.at(-1),true);assert(globalThis.hallRow.day.teams.every(t=>t.playerIds.length===3));
await click('Spielplan');await click('Spiel starten');assert.equal(globalThis.hallRow.day.games[0].status,'running');await click('+ Tor Rot');await click('+ Tor Blau');await click('+ Tor Rot');assert.equal(globalThis.hallRow.day.games[0].goals.length,3);await click('Letztes Tor zurücknehmen');assert.equal(globalThis.hallRow.day.games[0].goals.length,2);
await click('Pause');assert.equal(globalThis.hallRow.day.games[0].status,'paused');await click('Weiter');assert.equal(globalThis.hallRow.day.games[0].status,'running');
await act(async()=>view.unmount());await act(async()=>{view=TestRenderer.create(<HallTrainingPlanner {...props}/>);});await click('Spielplan');assert.equal(globalThis.hallRow.day.games[0].goals.length,2);await click('Spiel beenden');assert.equal(globalThis.hallRow.day.games[0].status,'finished');await click('Tabelle');assert(JSON.stringify(view.toJSON()).includes('Interne Trainingstabelle'));await click('Spielplan');await click('Spiel starten');assert.equal(globalThis.hallRow.day.games[1].status,'running');assert.equal(globalThis.hallRow.day.games.filter(g=>g.status==='running').length,1);
globalThis.hallFail=true;await click('+ Tor Rot');assert(JSON.stringify(view.toJSON()).includes('Bitte neu laden'));assert.equal(globalThis.hallRow.day.games[1].goals.length,0);globalThis.hallFail=false;
await act(async()=>view.update(<HallTrainingPlanner {...props} readOnly/>));assert.equal(view.root.findAllByType('button').some(b=>text(b)==='Spiel beenden'),false);await act(async()=>view.unmount());
globalThis.hallRow=null;
const fourIds=Array.from({length:12},(_,i)=>'four-'+i);const fourProps={...props,eventId:'four-teams',players:fourIds.map(id=>({id,display_name:id})),availableIds:fourIds};
await act(async()=>{view=TestRenderer.create(<HallTrainingPlanner {...fourProps}/>);});
await act(async()=>view.root.findAllByType('select')[0].props.onChange({target:{value:'4'}}));
let nameInputs=view.root.findAllByType('input').filter(i=>i.props.maxLength===32);assert.equal(nameInputs.length,4,'four individually named teams must appear immediately');
for(let i=0;i<4;i++)await act(async()=>nameInputs[i].props.onChange({target:{value:['Barca','Milan','Ajax','Rapid'][i]}}));
assert(button('Mannschaften speichern').props.disabled,'incompatible old schedule cannot be saved');
await click('Spielplan erstellen & speichern');assert.deepEqual(globalThis.hallRow.day.teams.map(t=>t.name),['Barca','Milan','Ajax','Rapid']);
let assignment=view.root.findAllByType('select').filter(s=>s.props.className.includes('!w-full'));assert.equal(assignment.length,12);assert(assignment[0].findAllByType('option').some(o=>o.props.value===3));
await act(async()=>assignment[0].props.onChange({target:{value:'3'}}));await click('Mannschaften speichern');assert.deepEqual(globalThis.hallRow.day.teams[3].playerIds,[fourIds[0]],'fourth team can be assigned individually');
await click('Zugesagte Spieler gleichmäßig verteilen');await click('Mannschaften speichern');assert(globalThis.hallRow.day.teams.every(t=>t.playerIds.length===3));assert.equal(ready.at(-1),true);
await act(async()=>view.root.findAllByType('select')[0].props.onChange({target:{value:'3'}}));assert.equal(view.root.findAllByType('input').filter(i=>i.props.maxLength===32).length,3);assert(button('Mannschaften speichern').props.disabled);assert.equal(ready.at(-1),false);
await act(async()=>view.unmount());
console.log('PASS: generate, assign, save green status, start, goals, undo, pause/resume, reload, finish, standings, next match, stale-save handling, read-only controls.');
`},bundle:true,platform:'node',format:'esm',packages:'external',outfile:out,plugins:[{name:'controlled-services',setup(b){b.onResolve({filter:/\/(Modal|DemoContext|hallTrainingStore)$/},a=>({path:a.path.split('/').pop(),namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({loader:'tsx',resolveDir:process.cwd(),contents:a.path==='Modal'?`import React from 'react';export const Modal=p=>p.open?<div role="dialog">{p.children}</div>:null;`:a.path==='DemoContext'?`export const useDemoMode=()=>null;`:`export const loadHallDay=async()=>globalThis.hallRow;export const saveHallDay=async(id,day,revision)=>{if(globalThis.hallFail)throw new Error('Bitte neu laden');if(revision!==(globalThis.hallRow?.revision||0))throw new Error('stale');globalThis.hallRow={day:structuredClone(day),revision:revision+1};return revision+1;};`}));}}]});
const r=spawnSync(process.execPath,[out],{stdio:'inherit'});if(r.status!==0)process.exitCode=1;
}finally{try{unlinkSync(out)}catch{}}
