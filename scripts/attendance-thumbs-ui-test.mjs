import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {unlinkSync} from 'node:fs';
const out='node_modules/.attendance-thumbs-test.mjs';
try {
 await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import React from 'react';import TestRenderer,{act} from 'react-test-renderer';import assert from 'node:assert/strict';import {AttendanceThumbControls} from './src/components/events/AttendanceThumbControls';
 let view;let calls=[];const props={name:'Theo Putz',status:'open',onSelect:s=>calls.push(s)};
 act(()=>{view=TestRenderer.create(<AttendanceThumbControls {...props}/>)});
 const buttons=()=>view.root.findAllByType('button');
 act(()=>buttons()[1].props.onClick());assert.equal(calls.length,0);assert.equal(view.root.findAllByProps({role:'dialog'}).length,1);
 assert(!buttons().some(b=>b.children.includes('LAZ')));
 act(()=>buttons().find(b=>b.children.includes('Abbrechen')).props.onClick());assert.equal(calls.length,0);
 for(const [label,status] of [['Abwesend','absent'],['Krank','sick'],['Verletzt','injured']]){act(()=>buttons()[1].props.onClick());act(()=>buttons().find(b=>b.children.includes(label)).props.onClick());assert.equal(calls.at(-1),status);assert.equal(view.root.findAllByProps({role:'dialog'}).length,0);}
 act(()=>view.update(<AttendanceThumbControls {...props} isLaz/>));act(()=>buttons()[1].props.onClick());act(()=>buttons().find(b=>b.children.includes('LAZ')).props.onClick());assert.equal(calls.at(-1),'external');
 act(()=>buttons()[0].props.onClick());assert.equal(calls.at(-1),'present');
 act(()=>view.update(<AttendanceThumbControls {...props} status="present"/>));act(()=>buttons()[0].props.onClick());assert.equal(calls.at(-1),'present');assert.equal(buttons()[0].props['aria-pressed'],true);
 act(()=>view.update(<AttendanceThumbControls {...props} disabled/>));assert(buttons().every(b=>b.props.disabled));act(()=>view.unmount());console.log('PASS: no write on open/cancel; all four reasons; LAZ eligibility; direct yes without toggle; disabled controls.');
 `},bundle:true,packages:'external',platform:'node',format:'esm',outfile:out,plugins:[{name:'modal',setup(b){b.onResolve({filter:/\/Modal$/},()=>({path:'modal',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({resolveDir:process.cwd(),loader:'tsx',contents:`import React from 'react';export function Modal(p){return p.open?<div role="dialog">{p.children}</div>:null}` }));}}]});
 const r=spawnSync(process.execPath,[out],{stdio:'inherit'});if(r.status!==0)process.exitCode=1;
}finally{try{unlinkSync(out)}catch{}}
