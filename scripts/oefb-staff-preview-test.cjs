const assert=require('node:assert/strict');
const esbuild=require('esbuild'), Module=require('node:module'),React=require('react');
const {act,create}=require('react-test-renderer');
(async()=>{
 let writes=[],uploads=0;
 global.testStaff={rpc:async(name,args)=>{writes.push({name,args});return {error:null}},lookup:async()=>({data:null,error:null}),upload:async()=>{uploads++;return {cutoutUrl:'https://test.supabase.co/storage/v1/object/public/team-photos/season/cutouts/user.png?v=1',error:null}}};
 global.fetch=async()=>({ok:true,json:async()=>({trainers:[{name:'First Coach',sourceRole:'Trainer',role:'trainer',photoUrl:'https://vereine.oefb.at/netzwerk/imagedownload/portrait.jpg',email:''}],sourceUrl:'https://vereine.oefb.at/Club/Mannschaften/Saison-2026-27/U12/Trainer-Betreuer'})});
 const mocks=[[/supabaseClient$/,'export const supabase={rpc:(...a)=>globalThis.testStaff.rpc(...a)}'],
 [/platformClubAdmin$/,'export const managerLookupStaffUserByEmail=(...a)=>globalThis.testStaff.lookup(...a)'],
 [/useTeamStaff$/,'export const staffDisplayName=m=>[m.first_name,m.last_name].filter(Boolean).join(" ")'],
 [/OefbPlayerPhoto$/,'export const OefbPlayerPhoto=()=>null'],
 [/removePortraitBackground$/,'export const removePortraitBackground=async()=>new Blob(["png"],{type:"image/png"})'],
 [/profileCutoutUpload$/,'export const uploadStaffProfileCutout=(...a)=>globalThis.testStaff.upload(...a)']];
 const bundle=await esbuild.build({entryPoints:['src/manager/ManagerOefbStaffPreview.tsx'],bundle:true,write:false,platform:'node',format:'cjs',external:['react'],plugins:[{name:'mocks',setup(b){for(const[p]of mocks)b.onResolve({filter:p},()=>({path:String(p),namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks.find(([p])=>String(p)===a.path)[1]}));}}]});
 const m=new Module(process.cwd()+'/staff-test.cjs');m.paths=module.paths;m._compile(bundle.outputFiles[0].text,process.cwd()+'/staff-test.cjs');
 const staff=[{user_id:'user',first_name:'First',last_name:'Coach',role:'trainer',avatar_url:'https://old/photo.jpg',cutout_url:null}];
 let tree,refresh=0;await act(async()=>tree=create(React.createElement(m.exports.ManagerOefbStaffPreview,{seasonId:'season',staff,onSaved:()=>refresh++})));
 const button=t=>tree.root.findAllByType('button').find(n=>n.children.join('')===t);
 await act(async()=>tree.root.findByProps({type:'url'}).props.onChange({target:{value:'https://vereine.oefb.at/Club/Mannschaften/Saison-2026-27/U12/Trainer-Betreuer'}}));
 await act(async()=>button('Trainer einlesen').props.onClick());
 assert.equal(writes.length,0);await act(async()=>button('Mit First Coach verknüpfen').props.onClick());assert.equal(writes.length,0);
 await act(async()=>button('Hintergrund entfernen').props.onClick());assert.equal(uploads,0);assert.ok(tree.root.findByProps({alt:'Freisteller-Vorschau'}));
 const confirm=tree.root.findAllByType('input').find(n=>n.props.type==='checkbox'&&n.parent.children.some(c=>typeof c==='string'&&c.includes('Ich habe Mannschaft')));
 await act(async()=>confirm.props.onChange({target:{checked:true}}));
 await act(async()=>button('Zuordnungen speichern (1)').props.onClick());
 assert.equal(uploads,1);assert.equal(writes.length,1);assert.equal(writes[0].name,'import_oefb_staff_member');
 assert.equal(writes[0].args.p_user_id,'user');assert.equal(writes[0].args.p_take_name,false);
 assert.equal(writes[0].args.p_take_photo,true);assert.ok(writes[0].args.p_cutout_url.endsWith('.png?v=1'));
 assert.equal(refresh,1);await act(async()=>tree.unmount());
 // Existing account with no profile name is suggested by the public source email.
 global.testStaff.lookup=async()=>({data:{user_id:'wolfgang',first_name:null,last_name:null},error:null});
 global.fetch=async()=>({ok:true,json:async()=>({trainers:[{name:'Wolfgang Semellechner',sourceRole:'Trainer',role:'trainer',photoUrl:null,email:'coach@example.test'}]})});
 await act(async()=>tree=create(React.createElement(m.exports.ManagerOefbStaffPreview,{seasonId:'season',staff:[],onSaved:()=>{}})));
 await act(async()=>tree.root.findByProps({type:'url'}).props.onChange({target:{value:'https://vereine.oefb.at/Club/Mannschaften/Saison-2026-27/U12/Trainer-Betreuer'}}));
 await act(async()=>button('Trainer einlesen').props.onClick());
 assert.ok(button('Mit Wolfgang Semellechner verknüpfen'));
 assert.equal(writes.length,1);
 await act(async()=>button('Mit Wolfgang Semellechner verknüpfen').props.onClick());
 assert.equal(writes.length,1);
 assert.ok(tree.root.findAllByType('input').some(n=>n.props.type==='checkbox'&&n.props.checked===true));
 await act(async()=>tree.unmount());
 console.log('PASS: preview and explicit existing-account selection do not write; cutout is uploaded only on confirmed save; existing account ID is reused.');
})().catch(e=>{console.error(e);process.exit(1)});
