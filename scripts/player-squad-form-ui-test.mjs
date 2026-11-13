import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {unlinkSync} from 'node:fs';
const out='node_modules/.player-squad-form-test.mjs';
try {
 await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import TestRenderer,{act} from 'react-test-renderer';import assert from 'node:assert/strict';import {PlayerSquadFormModal} from './src/components/team/PlayerSquadFormModal';
const empty={first_name:'',last_name:'',jersey_number:'',position:'',birthdate:''};let changes=[],closed=0;
const props={isOpen:true,mode:'create',form:empty,editingPlayer:null,saving:false,avatarUploading:false,cutoutUploading:false,avatarPreviewUrl:null,cutoutPreviewUrl:null,avatarObjectUrl:null,cutoutObjectUrl:null,formError:null,jerseyErrorMsg:null,canManage:true,onClose:()=>closed++,onSubmit:e=>e.preventDefault(),onFormChange:p=>changes.push(p),onAvatarFile:()=>{},onCutoutFile:()=>{},onImageValidationError:()=>{}};
let view;act(()=>{view=TestRenderer.create(<PlayerSquadFormModal {...props}/>)});const save=()=>view.root.findAllByType('button').find(b=>b.props.type==='submit');
assert(save().props.disabled);assert.equal(view.root.findAllByType('input').filter(i=>i.props.type==='file').length,0,'new player has no unavailable photo controls');
const input=view.root.findAllByType('input')[0];act(()=>input.props.onChange({target:{value:'Daniel'}}));assert.deepEqual(changes,[{first_name:'Daniel'}]);
act(()=>view.update(<PlayerSquadFormModal {...props} form={{...empty,first_name:'Daniel'}}/>));assert(save().props.disabled,'last name required');
act(()=>view.update(<PlayerSquadFormModal {...props} form={{...empty,first_name:'Daniel',last_name:'Baumann'}}/>));assert(!save().props.disabled);assert.equal(save().props.form,'player-squad-form');
act(()=>view.update(<PlayerSquadFormModal {...props} mode="edit" editingPlayer={{id:'synthetic'}} form={{...empty,first_name:'Daniel',last_name:'Baumann'}}/>));
assert.equal(view.root.findAllByType('input').filter(i=>i.props.type==='file').length,2,'existing player keeps both upload paths');assert(JSON.stringify(view.toJSON()).includes('Listenbild wählen'));assert(JSON.stringify(view.toJSON()).includes('Spielerfoto wählen'));
act(()=>view.update(<PlayerSquadFormModal {...props} saving/>));assert(save().props.disabled);act(()=>view.unmount());console.log('PASS: clear create form, required names, preserved submit target, edit photos, busy state');
`},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},outfile:out,plugins:[{name:'modal',setup(b){b.onResolve({filter:/\/(Modal|profileCutoutUpload)$/},a=>({path:a.path.split('/').pop(),namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({resolveDir:process.cwd(),loader:'tsx',contents:a.path==='profileCutoutUpload'?`export const logProfileHeroUpload=()=>{};`:`import React from 'react';export const Modal=p=>p.isOpen?<div role="dialog">{p.children}{p.footer}</div>:null;`}));}}]});
 const r=spawnSync(process.execPath,[out],{stdio:'inherit'});if(r.status!==0)process.exitCode=1;
}finally{try{unlinkSync(out)}catch{}}
