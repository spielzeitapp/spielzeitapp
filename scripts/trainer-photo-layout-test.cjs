const assert=require('node:assert/strict');
const esbuild=require('esbuild'),Module=require('node:module'),React=require('react');
const {act,create}=require('react-test-renderer');
async function bundle(entry,mocks){
 const result=await esbuild.build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',external:['react'],plugins:[{name:'mocks',setup(b){for(const[p]of mocks)b.onResolve({filter:p},()=>({path:String(p),namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks.find(([p])=>String(p)===a.path)[1]}));}}]});
 const m=new Module(process.cwd()+'/trainer-photo-test.cjs');m.paths=module.paths;m._compile(result.outputFiles[0].text,process.cwd()+'/trainer-photo-test.cjs');return m.exports;
}
(async()=>{
 let writes=[],uploads=0,closed=0;
 global.testPhoto={rpc:async(name,args)=>{writes.push({name,args});return {error:null}},upload:async()=>{uploads++;return {cutoutUrl:'https://test.supabase.co/storage/v1/object/public/team-photos/season/cutouts/user.png?v=1',error:null}}};
 const {ManagerPlayerPhotoEditor}=await bundle('src/manager/ManagerPlayerPhotoEditor.tsx',[
 [/supabaseClient$/,'export const supabase={rpc:(...a)=>globalThis.testPhoto.rpc(...a),from:()=>{throw Error("must not update players")}}'],
 [/profileCutoutUpload$/,'export const uploadStaffProfileCutout=(...a)=>globalThis.testPhoto.upload(...a); export const uploadPlayerProfileCutout=()=>{throw Error("must not upload a player photo")};'],
 [/removePortraitBackground$/,'export const removePortraitBackground=async()=>new Blob(["png"],{type:"image/png"})'],
 [/playerPhotoDisplay$/,'export const preparedPlayerPortrait=()=>null;export const playerPhotoDisplayUrl=s=>s;']]);
 const player={id:'user',first_name:'Wolfgang',last_name:'Semellechner',display_name:'Wolfgang Semellechner',avatar_url:'https://photo.test/avatar.jpg',cutout_url:null,photo_layout:null};
 let tree;await act(async()=>tree=create(React.createElement(ManagerPlayerPhotoEditor,{trainer:true,seasonId:'season',player,onSaved:()=>closed++,onClose:()=>closed++})));
 const button=t=>tree.root.findAllByType('button').find(n=>n.children.join('')===t);
 assert.equal(tree.root.findAllByProps({type:'range'}).length,8);
 await act(async()=>tree.root.findByProps({'aria-label':'Bildgröße'}).props.onChange({target:{value:'125'}}));
 await act(async()=>tree.root.findByProps({'aria-label':'TR horizontal'}).props.onChange({target:{value:'80'}}));
 assert.equal(writes.length,0);
 await act(async()=>button('Hintergrund entfernen').props.onClick());assert.equal(uploads,0);
 await act(async()=>button('Freisteller & Gestaltung speichern').props.onClick());
 assert.equal(uploads,1);assert.equal(writes.length,1);assert.equal(writes[0].name,'save_staff_photo_layout');
 assert.equal(writes[0].args.p_user_id,'user');assert.equal(writes[0].args.p_layout.zoom,125);assert.equal(writes[0].args.p_layout.numberX,80);assert.equal(writes[0].args.p_layout.source,'cutout');assert.ok(writes[0].args.p_cutout_url);assert.equal(closed,1);
 await act(async()=>tree.unmount());
 const {TeamTrainerShowcase}=await bundle('src/components/team/TeamTrainerShowcase.tsx',[[/useTeamStaff$/,'export const staffDisplayName=m=>m.first_name+" "+m.last_name;'],[/playerPhotoDisplay$/,'export const preparedPlayerPortrait=()=>null;export const playerPhotoDisplayUrl=s=>s;']]);
 await act(async()=>tree=create(React.createElement(TeamTrainerShowcase,{trainers:[{user_id:'user',first_name:'Wolfgang',last_name:'Semellechner',photo_layout:writes[0].args.p_layout,avatar_url:'original',cutout_url:'cutout'}],onTrainerClick:()=>{}})));
 const image=tree.root.findAllByType('img').find(n=>n.props.src==='cutout'&&n.props.style?.transform);
 assert.ok(image);assert.ok(image.props.style.transform.includes('scale(1.25)'));
 await act(async()=>tree.unmount());
 console.log('PASS: trainer has all eight shared controls; preview makes no writes; staff cutout and layout save together; trainer card renders saved layout.');
})().catch(e=>{console.error(e);process.exit(1)});
