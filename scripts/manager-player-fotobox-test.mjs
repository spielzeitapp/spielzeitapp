import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
const writes=[];let stopped=0,saved=0,closed=0,fail=false,deny=false,mediaCalls=0;
const media={active:true,getTracks:()=>[{stop:()=>stopped++}]};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{mediaCalls++;if(deny)throw Error('denied');return media;}}}});
globalThis.document={body:{style:{}},activeElement:null,hidden:false,addEventListener(){},removeEventListener(){}};
globalThis.window={confirm:()=>true,dispatchEvent(){}};
globalThis.Image=class {naturalWidth=1600;naturalHeight=1200;async decode(){}};
globalThis.__boothWrite=async(kind,args)=>{writes.push({kind,args});if(fail&&kind==='avatar')return{error:'Upload nicht erlaubt'};if(kind==='avatar')return{avatarUrl:'/new.jpg',error:null};if(kind==='cutout')return{cutoutUrl:'/new.png',error:null};return{data:{id:'p1'},error:null};};
const fixtures={
 playerPhotoMotifs:`export const PHOTO_STEPS=['portrait','matchday','celebration','matchday_away','celebration_away'];export const PHOTO_LABELS={portrait:'Profilfoto',matchday:'Spieltag · Heim',celebration:'Jubel · Heim',matchday_away:'Spieltag · Auswärts',celebration_away:'Jubel · Auswärts'};export const listPlayerPhotoMotifs=async()=>[];export const uploadPlayerMotif=async(s,p,k,f,c)=>'/'+k+(c?'.png':'.jpg');export const savePlayerPhotoMotif=async(v,e)=>{await globalThis.__boothWrite('motif',v);return {...v,revision:'new'};};`,
 'managerPlayerPhotoBooth.css':'export default {};',
 'react-dom':'export const createPortal=x=>x;',
 supabaseClient:'export const supabase={from:table=>({upsert:args=>globalThis.__boothWrite(table,args),update:args=>({eq:()=>({select:()=>({single:()=>globalThis.__boothWrite(table,args)})})})}),rpc:(name,args)=>globalThis.__boothWrite(name,args)};',
 profileCutoutUpload:'export const uploadPlayerProfilePhoto=(...a)=>globalThis.__boothWrite("avatar",a),uploadPlayerProfileCutout=(...a)=>globalThis.__boothWrite("cutout",a);',
 seasonTransition:'export const getTeamSeasonWritableState=async()=>({writable:true});',
 removePortraitBackground:'export const removePortraitBackground=async()=>{if(globalThis.__segmentationFails)throw Error("model unavailable");return new Blob(["cutout"],{type:"image/png"});};',
 ManagerProfilePhotoPreview:'import React from "react";export const ManagerProfilePhotoPreview=props=>React.createElement("preview",props);',
 useUnsavedProfileGuard:'export const useUnsavedProfileGuard=()=>{};',
};
const compile=async(entry,extra={})=>{
 const b=await build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>{if(a.path==='react')return{path:'react',external:true};const key=a.path==='react-dom'?'react-dom':a.path.split('/').at(-1);if({...fixtures,...extra}[key])return{path:key,namespace:'fixture'};});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:{...fixtures,...extra}[a.path]}));}}]});
 const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;
};
const {photoBoothCrop,photoBoothImportFile}=await compile('src/lib/playerPhotoBooth.ts');
assert.deepEqual(photoBoothCrop(1920,1080,1),{x:420,y:0,width:1080,height:1080});
assert.deepEqual(photoBoothCrop(1200,1600,4/3),{x:0,y:350,width:1200,height:900});
assert.throws(()=>photoBoothCrop(0,0,1));
let importDraw;const importCanvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(...args){importDraw=args;}}),toBlob:cb=>cb(new Blob(['jpeg'],{type:'image/jpeg'}))};
document.createElement=()=>importCanvas;
await photoBoothImportFile({},3000,4000);assert.equal(importCanvas.width,1350);assert.equal(importCanvas.height,1800);assert.equal(importDraw.length,5,'Imported photo keeps all pixels in the original aspect ratio');
delete document.createElement;

const {ManagerPlayerPhotoBooth:Booth}=await compile('src/manager/ManagerPlayerPhotoBooth.tsx',{playerPhotoBooth:'export const photoBoothImportFile=async()=>new File(["image"],"import.jpg",{type:"image/jpeg"});export const photoBoothFile=async()=>new File(["image"],"capture.jpg",{type:"image/jpeg"});'});
const players=[{id:'p1',first_name:'Test',last_name:'Eins',display_name:'Test Eins',jersey_number:7,photo_layout:{background:'black',source:'original',zoom:120,x:30,y:10,rotation:90}},{id:'p2',first_name:'Test',last_name:'Zwei',display_name:'Test Zwei'}];
let root;const button=label=>root.root.findByProps({'aria-label':label});
const textButton=text=>root.root.findAllByType('button').find(b=>b.children.some(c=>c===text));
const mount=async()=>act(async()=>{root=create(React.createElement(Booth,{players,seasonId:'season',onSaved:()=>saved++,onClose:()=>closed++}),{createNodeMock:el=>el.type==='video'?{readyState:2,videoWidth:1920,videoHeight:1080,play:async()=>{},srcObject:null}:el.props.role==='dialog'?{focus(){}}:null});});
await mount();
assert.equal(button('Selbstauslöser').props.value,3);
await act(async()=>button('Selbstauslöser').props.onChange({target:{value:'0'}}));
assert.equal(writes.length,0);assert.equal(button('Foto aufnehmen').props.disabled,true);
assert.equal(button('Hintergrund automatisch entfernen').props.checked,true,'Background removal defaults on after capture');
assert.equal(button('Aufnahmeformat').props.value,'portrait');
assert.ok(root.root.findAllByType('svg').some(n=>n.props.viewBox==='0 0 400 500'),'Portrait guide uses full camera height');
await act(async()=>button('Aufnahmeformat').props.onChange({target:{value:'wide'}}));
assert.ok(root.root.findAllByType('svg').some(n=>n.props.viewBox==='0 0 400 300'),'Wide pose remains available');
await act(async()=>root.root.findByType('video').props.onLoadedData());
await act(async()=>button('Foto aufnehmen').props.onClick());
assert.equal(writes.length,0,'Capture and segmentation never persist before acceptance');
assert.ok(root.root.findByType('preview').props.cutoutUrl,'Capture is automatically cut out before club preview');
assert.equal(root.root.findByType('preview').props.layout.source,'cutout');
assert.ok(stopped>0,'Camera tracks stopped once preview opens');
assert.equal(root.root.findByProps({'aria-label':'Spieler auswählen'}).props.disabled,true);
assert.equal(root.root.findByType('preview').props.layout.rotation,0,'New photo does not inherit old camera rotation');
await act(async()=>textButton('Noch einmal').props.onClick());
assert.equal(writes.length,0,'Retake never persists the discarded photo');
assert.ok(mediaCalls>=2,'Retake reopens camera');
globalThis.__segmentationFails=true;
await act(async()=>root.root.findByType('video').props.onLoadedData());
await act(async()=>button('Foto aufnehmen').props.onClick());
assert.equal(root.root.findByType('preview').props.cutoutUrl,null,'Failed segmentation keeps original preview available');
assert.ok(root.root.findAllByProps({role:'status'}).some(n=>n.children.join('').includes('Freistellung nicht möglich')));
assert.equal(writes.length,0,'Segmentation failure does not save or overwrite anything');
await act(async()=>textButton('Noch einmal').props.onClick());
globalThis.__segmentationFails=false;
await act(async()=>root.root.findByProps({'aria-label':'Hintergrund automatisch entfernen'}).props.onChange({target:{checked:true}}));
await act(async()=>root.root.findByType('video').props.onLoadedData());
await act(async()=>button('Foto aufnehmen').props.onClick());
fail=true;await act(async()=>textButton('Übernehmen').props.onClick());
assert.ok(root.root.findByProps({role:'alert'}).children.includes('Upload nicht erlaubt'));
assert.ok(textButton('Noch einmal'),'Failed save keeps draft available');assert.equal(saved,0);
fail=false;writes.length=0;await act(async()=>textButton('Übernehmen').props.onClick());
assert.equal(saved,1);assert.equal(writes[0].args[0],'season');assert.equal(writes[0].args[1],'p1');
assert.equal(writes.find(w=>w.kind==='players').args.cutout_url,'/new.png');
const rpc=writes.find(w=>w.kind==='admin_save_player_photo_layout');assert.equal(rpc.args.p_player_id,'p1');assert.equal(rpc.args.p_team_season_id,'season');assert.equal(rpc.args.p_layout.source,'cutout');assert.deepEqual(rpc.args.p_expected,players[0].photo_layout);
assert.equal(root.root.findByProps({'aria-label':'Spieler auswählen'}).props.value,'p1','Profile save stays on current player for the next motif');
const profileWrites=writes.length;
for(const purpose of ['matchday','celebration','matchday_away','celebration_away']){
 await act(async()=>root.root.findByType('video').props.onLoadedData());
 await act(async()=>button('Foto aufnehmen').props.onClick());
 await act(async()=>textButton('Übernehmen').props.onClick());
 assert.equal(writes.at(-1).kind,'motif');assert.equal(writes.at(-1).args.purpose,purpose);
}
assert.equal(writes.slice(profileWrites).filter(w=>w.kind==='players'||w.kind==='player_avatars'||w.kind==='avatar').length,0,'Additional motifs never overwrite the profile photo');
assert.equal(root.root.findByProps({'aria-label':'Spieler auswählen'}).props.value,'p2','Fourth additional motif advances to the next player');
for(let i=0;i<5;i++)await act(async()=>textButton('Diesen Schritt überspringen').props.onClick());
assert.ok(root.root.findAllByProps({role:'status'}).some(n=>n.findAllByType('h3').some(h=>h.children.includes('Fotoserie abgeschlossen'))),'Series has a clear finish after last player');
await act(async()=>button('Fotobox schließen').props.onClick());assert.equal(closed,1);
await act(async()=>root.unmount());assert.equal(document.body.style.overflow,undefined);
await mount();
await act(async()=>button('Selbstauslöser').props.onChange({target:{value:'0'}}));
await act(async()=>root.root.findByType('video').props.onLoadedData());
await act(async()=>button('Foto aufnehmen').props.onClick());
assert.equal(button('Zusätzlich auf Gerät speichern').props.checked,false);
await act(async()=>button('Zusätzlich auf Gerät speichern').props.onChange({target:{checked:true}}));
await act(async()=>textButton('Übernehmen').props.onClick());
assert.ok(textButton('Bild sichern'),'Saved device copy waits for an explicit gesture');
assert.equal(root.root.findAllByType('video').length,0,'Camera stays off during export');
const writesBeforeExport=writes.length;
let sharedFile;navigator.canShare=()=>true;navigator.share=async data=>{sharedFile=data.files[0];};
await act(async()=>textButton('Bild sichern').props.onClick());
assert.ok(sharedFile instanceof File);assert.equal(sharedFile.name,'Test-Eins-Profilfoto.jpg');
navigator.share=async()=>{throw Object.assign(new Error('cancelled'),{name:'AbortError'});};
await act(async()=>textButton('Bild sichern').props.onClick());
assert.ok(textButton('Weiter'),'Cancelling export keeps continuation available');
assert.equal(writes.length,writesBeforeExport,'Export and cancellation never repeat uploads');
await act(async()=>textButton('Weiter').props.onClick());
assert.ok(root.root.findByType('video'),'Series resumes after device copy step');
await act(async()=>root.unmount());
deny=true;await mount();assert.ok(root.root.findAllByProps({role:'status'}).some(n=>n.children.join('').includes('Kamera konnte nicht')));
assert.ok(button('Kamera / Bild auswählen'),'Permission denial still offers native camera/file fallback');
await act(async()=>root.unmount());
// A permission prompt can resolve after the dialog was closed: stop that late stream.
let resolveMedia;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{resolveMedia=resolve;});await mount();await act(async()=>root.unmount());const before=stopped;await act(async()=>resolveMedia(media));assert.equal(stopped,before+1);
console.log('PASS: matching crop, camera readiness/cleanup, late permission cleanup, preview-only capture, retake, failed save retention, scoped explicit save, next player and denied-camera fallback.');
