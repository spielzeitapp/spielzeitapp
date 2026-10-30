import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {build} from 'esbuild';
let calls=[], saved=0, response={error:null};
globalThis.__teamEdit={call:async input=>{calls.push(input);return response;}};
const result=await build({entryPoints:['src/manager/ManagerTeamDetailsEditor.tsx'],bundle:true,write:false,platform:'node',format:'esm',external:['react'],plugins:[{name:'mock-api',setup(b){b.onResolve({filter:/platformClubAdmin$/},()=>({path:'mock-api',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const adminUpdateTeamDetails = input => globalThis.__teamEdit.call(input);',loader:'js'}));}}]});
// A local temporary module lets Node resolve the existing React dependency.
const {writeFile,unlink}=await import('node:fs/promises');
const path=new URL('../.team-details-test.tmp.mjs',import.meta.url);
await writeFile(path,result.outputFiles[0].text);
try {
 const {ManagerTeamDetailsEditor}=await import(path.href);
 const season={id:'test-season',team_id:'test-team',team_name:'SC Example FR U16',age_group:'U16',season_name:'2026/27',status:'active'};
 let root;await act(async()=>{root=TestRenderer.create(React.createElement(ManagerTeamDetailsEditor,{clubId:'test-club',season,onSaved:async()=>{saved++;}}));});
 const buttons=()=>root.root.findAllByType('button');
 await act(async()=>{buttons()[0].props.onClick();});
 const inputs=root.root.findAllByType('input');
 await act(async()=>{inputs[0].props.onChange({target:{value:'SC Example FR KM'}});inputs[1].props.onChange({target:{value:'KM'}});inputs[2].props.onChange({target:{value:'2027/28'}});});
 assert.match(JSON.stringify(root.toJSON()),/SC Example FR · KM · 2027\/28/);
 response={error:'Zwischenzeitlich geändert.'};
 await act(async()=>{await root.root.findByType('form').props.onSubmit({preventDefault(){}});});
 assert.equal(saved,0);assert.equal(root.root.findByProps({role:'alert'}).children.join(''),'Zwischenzeitlich geändert.');
 assert.deepEqual(calls[0],{clubId:'test-club',teamSeasonId:'test-season',name:'SC Example FR KM',ageGroup:'KM',seasonName:'2027/28',expectedName:'SC Example FR U16',expectedAgeGroup:'U16',expectedSeasonName:'2026/27'});
 response={error:null};
 await act(async()=>{await root.root.findByType('form').props.onSubmit({preventDefault(){}});});
 assert.equal(saved,1);assert.equal(root.root.findAllByType('form').length,0);
 await act(async()=>{buttons()[0].props.onClick();});
 await act(async()=>{buttons().find(b=>b.children.includes('Abbrechen')).props.onClick();});
 assert.equal(calls.length,2);assert.equal(root.root.findAllByType('form').length,0);
 root.unmount();
 console.log('PASS: team editor previews labels, submits existing IDs with expected metadata, keeps errors editable, refreshes on success and cancels without writes.');
} finally {await unlink(path);delete globalThis.__teamEdit;}
