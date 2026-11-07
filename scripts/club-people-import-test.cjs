const assert=require('node:assert/strict'),esbuild=require('esbuild'),Module=require('node:module'),React=require('react');
const {act,create}=require('react-test-renderer');
(async()=>{
 const member={id:'existing',first_name:'Theo',last_name:'Putz',external_ids:['123456'],memberships:[{id:'other-team',label:'Rohrbach U12'}]};
 const coach={user_id:'coach',first_name:'First',last_name:'Coach',role:'head_coach',avatar_url:'/existing.jpg'};
 let writes=[],requests=[],staffFailure=false,saved=0;
 global.fixture={staff:[coach],lookup:async()=>({data:null,error:null}),rpc:async(name,args)=>{
  if(name==='admin_club_roster_context')return{data:global.fixture.profiles||[member],error:null};
  if(name==='oefb_assignment_context')return{data:{players:[member]},error:null};
  writes.push({name,args});
  if(name==='import_oefb_staff_member'&&staffFailure)return{error:{message:'Fixture staff failure'}};
  return{data:{created:1,mapped:1,names_updated:0,numbers_added:1,photos_added:1},error:null};
 }};
 global.window={location:{search:''},dispatchEvent(){}};
 global.fetch=async url=>{requests.push(url);return{ok:true,json:async()=>url.includes('view=staff')?{trainers:[{name:'First Coach',sourceRole:'Trainer',role:'trainer',photoUrl:'https://vereine.oefb.at/netzwerk/imagedownload/coach.jpg',email:''},{name:'New Coach',sourceRole:'Co-Trainer',role:'co_trainer',photoUrl:'https://vereine.oefb.at/netzwerk/imagedownload/newcoach.jpg',email:global.fixture.email||''}],sourceUrl:'https://vereine.oefb.at/Club/Mannschaften/Saison-2026-27/KM/Trainer-Betreuer/'}:{players:[{externalPlayerId:'123456',name:'Theo Putz',jerseyNumber:6},{externalPlayerId:'234567',name:'New Player',jerseyNumber:7}]}};};
 const mocks=[[/supabaseClient$/,'export const supabase={rpc:(...a)=>globalThis.fixture.rpc(...a)}'],[/platformClubAdmin$/,'export const managerLookupStaffUserByEmail=(...a)=>globalThis.fixture.lookup(...a)'],[/useTeamStaff$/,'export const staffDisplayName=m=>[m.first_name,m.last_name].filter(Boolean).join(" ");export const useTeamStaff=()=>({staff:globalThis.fixture.staff,loading:false,error:null,refetch:async()=>({count:1,error:null})})'],[/OefbPlayerPhoto$/,'export const OefbPlayerPhoto=()=>null'],[/removePortraitBackground$/,'export const removePortraitBackground=async()=>{throw Error("Unexpected cutout")};'],[/profileCutoutUpload$/,'export const uploadStaffProfileCutout=async()=>{throw Error("Unexpected upload")};']];
 const bundle=await esbuild.build({entryPoints:['src/manager/ManagerClubPeopleImport.tsx'],bundle:true,write:false,platform:'node',format:'cjs',external:['react'],plugins:[{name:'fixture',setup(b){for(const[p]of mocks)b.onResolve({filter:p},()=>({path:String(p),namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks.find(([p])=>String(p)===a.path)[1]}));}}]});
 const mod=new Module(process.cwd()+'/people-test.cjs');mod.paths=module.paths;mod._compile(bundle.outputFiles[0].text,process.cwd()+'/people-test.cjs');
 let tree;const button=t=>tree.root.findAllByType('button').find(b=>b.children.join('').startsWith(t));
 const approve=()=>tree.root.findAllByProps({type:'checkbox'}).find(n=>n.parent.children.some(c=>typeof c==='string'&&c.includes('Ich habe Mannschaft, Personen, Zuordnungen')));
 async function mount(){await act(async()=>tree=create(React.createElement(mod.exports.ManagerClubPeopleImport,{seasonId:'season',rosterUrl:'https://vereine.oefb.at/Club/Mannschaften/Saison-2026-27/KM/Kader/',onSaved:()=>saved++})));}
 await mount();assert.equal(writes.length,0);assert.equal(requests.length,0,'Mount is read-only and does not contact the source');
 await act(async()=>{button('Kader & Trainer einlesen').props.onClick();await new Promise(r=>setImmediate(r));});
 assert.equal(requests.length,2);assert(requests[1].includes('Trainer-Betreuer'));assert.equal(writes.length,0,'Common preview never writes');
 assert.equal(tree.root.findAllByType('button').filter(b=>b.children.join('').includes('Zuordnungen speichern')).length,0,'One common save instead of separate saves');
 const targets=tree.root.findAllByType('select').map(n=>n.props.value);assert(targets.includes('existing'));assert(targets.includes('new'));
 assert(tree.root.findAllByType('p').some(p=>p.children.join('').includes('1 Trainer noch offen')));assert.equal(button('Ausgewählten Kader').props.disabled,true);
 await act(async()=>approve().props.onChange({target:{checked:true}}));assert.equal(button('Ausgewählten Kader').props.disabled,false);
 // Any roster change revokes the common approval.
 const numberToggle=tree.root.findAllByProps({type:'checkbox'}).find(n=>n.parent.children.some(c=>typeof c==='string'&&c.includes('Fehlende Rückennummern')));
 await act(async()=>numberToggle.props.onChange({target:{checked:false}}));assert.equal(button('Ausgewählten Kader').props.disabled,true);
 await act(async()=>approve().props.onChange({target:{checked:true}}));
 await act(async()=>{button('Ausgewählten Kader').props.onClick();await new Promise(r=>setImmediate(r));});
 assert.equal(writes.length,2);assert.equal(saved,1);
 const roster=writes.find(w=>w.name==='admin_import_club_oefb_roster');assert.equal(roster.args.p_team_season_id,'season');assert.equal(roster.args.p_players[0].player_id,'existing');assert.equal(roster.args.p_players[1].player_id,null);assert.equal(roster.args.p_players[0].take_oefb_name,false);assert.equal(roster.args.p_players[0].jersey_number,null);
 const staff=writes.find(w=>w.name==='import_oefb_staff_member');assert.equal(staff.args.p_user_id,'coach');assert.equal(staff.args.p_role,'head_coach');assert.equal(staff.args.p_take_photo,false,'Existing coach photo is preserved');assert(staff.args.p_source_url.endsWith('Trainer-Betreuer/'));
 assert.equal(writes.some(w=>JSON.stringify(w).includes('New Coach')),false,'Unmapped trainer never creates an account or membership');
 await act(async()=>tree.unmount());
 // Successful roster import must not be submitted again after a staff failure.
 writes=[];staffFailure=true;await mount();await act(async()=>{button('Kader & Trainer einlesen').props.onClick();await new Promise(r=>setImmediate(r));});await act(async()=>approve().props.onChange({target:{checked:true}}));await act(async()=>{button('Ausgewählten Kader').props.onClick();await new Promise(r=>setImmediate(r));});assert.equal(writes.length,2);assert(JSON.stringify(tree.toJSON()).includes('Ein Teil konnte nicht gespeichert werden'));
 staffFailure=false;await act(async()=>approve().props.onChange({target:{checked:true}}));await act(async()=>{button('Ausgewählten Kader').props.onClick();await new Promise(r=>setImmediate(r));});assert.equal(writes.length,3);assert.equal(writes[2].name,'import_oefb_staff_member','Retry only saves the remaining trainer');await act(async()=>tree.unmount());
 // Names alone cannot resolve multiple existing profiles.
 global.fixture.profiles=[{...member,external_ids:[]},{...member,id:'second-theo',external_ids:[]}];writes=[];await mount();
 await act(async()=>{button('Kader & Trainer einlesen').props.onClick();await new Promise(r=>setImmediate(r));});
 const selectors=tree.root.findAllByType('select');assert.equal(selectors[0].props.value,'','Ambiguous name stays unselected');assert.equal(writes.length,0);await act(async()=>tree.unmount());
 // Account lookup does not return photo metadata, so never opt into replacing it.
 global.fixture.profiles=undefined;global.fixture.email='new@coach.test';global.fixture.lookup=async()=>({data:{user_id:'other-coach',first_name:'New',last_name:'Coach'},error:null});writes=[];await mount();
 await act(async()=>{button('Kader & Trainer einlesen').props.onClick();await new Promise(r=>setImmediate(r));});await act(async()=>approve().props.onChange({target:{checked:true}}));await act(async()=>{button('Ausgewählten Kader').props.onClick();await new Promise(r=>setImmediate(r));});
 assert.equal(writes.find(w=>w.args.p_user_id==='other-coach').args.p_take_photo,false,'Unknown existing account photo must never be replaced automatically');await act(async()=>tree.unmount());
 console.log('PASS common people import: correct source/team, ID reuse, new-player review, one explicit save, approval invalidation, no account creation, preserved coach photo/role and partial retry.');
})().catch(e=>{console.error(e);process.exitCode=1;});
