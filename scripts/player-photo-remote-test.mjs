import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
const compile=async(entry,fixtures)=>{
 const b=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'remote-fixtures',setup(b){b.onResolve({filter:/.*/},a=>{const key=a.path.split('/').at(-1);if(fixtures[key])return{path:key,namespace:'fixture'};});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:fixtures[a.path],loader:'js'}));}}]});
 const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;
};
const lib=await compile('src/lib/playerPhotoRemote.ts',{supabaseClient:'export const supabase={};',playerPhotoMotifs:'export const PHOTO_STEPS=["portrait","matchday","celebration"];'});
const id=()=>crypto.randomUUID(),draftId=id();
const ready={playerId:'p1',step:'portrait',ready:true,busy:false,draftId:null,finished:false,error:'',notice:'',layout:{}};
const command=action=>({id:id(),action,playerId:'p1',step:'portrait',draftId:null});
assert.equal(lib.remoteCommandMatches(command('capture'),ready),true);
assert.equal(lib.remoteCommandMatches(command('capture'),{...ready,busy:true}),false);
assert.equal(lib.remoteCommandMatches(command('capture'),{...ready,playerId:'p2'}),false);
assert.equal(lib.remoteCommandMatches(command('capture'),{...ready,step:'matchday'}),false);
assert.equal(lib.remoteCommandMatches({...command('accept'),draftId},{...ready,draftId}),true);
assert.equal(lib.remoteCommandMatches({...command('accept'),draftId:id()},{...ready,draftId}),false);
assert.equal(lib.remoteCommandMatches(command('select'),{...ready,draftId}),false);
assert.equal(lib.remoteCommandMatches(command('skip'),{...ready,finished:true}),false);
assert.equal(lib.remoteCommandMatches({...command('capture'),id:'invalid'},ready),false);
assert.equal(lib.remoteCameraOnline({camera_id:id(),camera_seen_at:new Date().toISOString()}),true);
assert.equal(lib.remoteCameraOnline({camera_id:id(),camera_seen_at:new Date(Date.now()-20000).toISOString()}),false);
let row={id:id(),team_season_id:'season',camera_id:null,state:null,ack:null,command:null};let releases=0,captures=0;
globalThis.__remoteRead=async()=>({...row});globalThis.__remoteClaim=async(s,c)=>{row.camera_id=c;};globalThis.__remoteAck=async(s,c,cmd)=>{row.ack=cmd.id;return true;};globalThis.__remoteUpdate=async(s,v,c)=>{Object.assign(row,v);if(v.camera_id===null)releases++;return{...row};};
const hookLib=await compile('src/manager/usePhotoRemoteCamera.ts',{playerPhotoRemote:`export const claimRemoteCamera=(...a)=>globalThis.__remoteClaim(...a),readRemoteSession=(...a)=>globalThis.__remoteRead(...a),updateRemoteSession=(...a)=>globalThis.__remoteUpdate(...a),acknowledgeRemoteCommand=(...a)=>globalThis.__remoteAck(...a),remotePhotoThumbnail=async()=>"data:image/jpeg;base64,fixture";export const remoteCommandMatches=(c,s)=>!s.busy&&c.playerId===s.playerId&&c.step===s.step&&c.draftId===s.draftId;`});
function Harness(){const [state,setState]=React.useState(ready);const remote=hookLib.usePhotoRemoteCamera(row.id,'season',state,null,null,async c=>{captures++;setState(old=>({...old,draftId}));});return React.createElement('status',{remote,state});}
let root;await act(async()=>{root=create(React.createElement(Harness));});
assert.equal(root.root.findByType('status').props.remote.connected,true);
row.command=command('capture');await act(async()=>new Promise(r=>setTimeout(r,1350)));assert.equal(captures,1);
await act(async()=>new Promise(r=>setTimeout(r,1350)));assert.equal(captures,1,'The acknowledged command must never execute twice');
row.command={...command('accept'),draftId:id()};await act(async()=>new Promise(r=>setTimeout(r,1350)));assert.equal(captures,1,'Stale draft cannot trigger a save');
assert.ok(root.root.findByType('status').props.remote.error.includes('nicht mehr aktuell'));
await act(async()=>root.unmount());assert.equal(releases,1,'Closing camera releases the lease and clears the preview');
console.log('PASS remote: command context/draft checks, online timeout, acknowledged action executes once, stale draft rejected, camera released on close.');
const controllerRow={id:id(),team_season_id:'season',expires_at:new Date(Date.now()+3600000).toISOString(),camera_id:id(),camera_seen_at:new Date().toISOString(),command:null,ack:null,state:{...ready}};
let sent=[],ended=0;globalThis.__controllerRow=controllerRow;globalThis.__controllerSend=async(s,v)=>{sent.push(v.command);return {...controllerRow,...v};};
globalThis.window={location:{origin:'https://app.spielzeitapp.at'}};
const controllerLib=await compile('src/manager/ManagerPhotoRemoteController.tsx',{
 playerPhotoRemote:`export const createRemoteSession=async()=>({...globalThis.__controllerRow}),readRemoteSession=async()=>({...globalThis.__controllerRow}),updateRemoteSession=(...a)=>globalThis.__controllerSend(...a),closeRemoteSession=async()=>{};export const remoteCameraOnline=s=>!!s.camera_id;`,
 playerPhotoMotifs:'export const PHOTO_STEPS=["portrait","matchday","celebration"],PHOTO_LABELS={portrait:"Profilfoto",matchday:"Spieltagfoto",celebration:"Jubelfoto"};',
 ManagerProfilePhotoPreview:'export const ManagerProfilePhotoPreview=()=>null;',qrcode:'export const toDataURL=async()=>"data:image/png;base64,fixture";',
});
const mountController=async()=>act(async()=>{root=create(React.createElement(controllerLib.ManagerPhotoRemoteController,{seasonId:'season',players:[{id:'p1',display_name:'Synthetic Player',first_name:'Synthetic',last_name:'Player'}],onClose:()=>ended++}));});
const buttonText=text=>root.root.findAllByType('button').find(b=>b.children.includes(text));
await mountController();await act(async()=>buttonText('Stativkamera verbinden · QR-Code anzeigen').props.onClick());
assert.ok(root.root.findByType('a').props.href.endsWith('?fotoboxCamera='+controllerRow.id));
assert.equal(root.root.findAllByType('video').length,0,'Controller never requests a camera');
await act(async()=>buttonText('Foto auslösen').props.onClick());assert.equal(sent[0].action,'capture');assert.equal(sent[0].draftId,null);assert.equal(buttonText('Foto auslösen').props.disabled,true,'Unconfirmed shutter command disables repeated taps');
await act(async()=>root.unmount());controllerRow.state={...ready,draftId};
await mountController();await act(async()=>buttonText('Stativkamera verbinden · QR-Code anzeigen').props.onClick());
assert.equal(buttonText('Übernehmen').props.disabled,true,'Saving is unavailable before the transmitted preview exists');
await act(async()=>root.unmount());controllerRow.state={...ready,draftId,original:'data:image/jpeg;base64,fixture'};
await mountController();await act(async()=>buttonText('Stativkamera verbinden · QR-Code anzeigen').props.onClick());
await act(async()=>buttonText('Übernehmen').props.onClick());assert.equal(sent.at(-1).action,'accept');assert.equal(sent.at(-1).draftId,draftId);
await act(async()=>buttonText('Verbindung beenden').props.onClick());assert.equal(ended,1);await act(async()=>root.unmount());
console.log('PASS controller: same-origin QR link, no camera access, guarded shutter, preview required for accept, exact draft ID and explicit close.');
