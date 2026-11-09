import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer'),{MemoryRouter}=require('react-router-dom');
async function compile(path,plugins=[]){const result=await build({entryPoints:[path],bundle:true,format:'cjs',platform:'node',packages:'external',write:false,plugins});const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);return module.exports;}
const {referenceSteps}=await compile('src/manager/modern/ManagerReferenceSteps.ts');
const snapshot={club_ready:true,team_ready:true,season_ready:true,staff:2,players:15,jerseys_missing:1,access:0,venues:1,matches:0,trainings:2,checks:{club:'reviewed',matches:'unneeded'},updated_at:null};
const missing=referenceSteps(null,null,'club','season');
assert.equal(missing.length,11);assert.ok(missing.every(s=>s.state==='unknown'));assert.ok(missing.every(s=>!s.detail.includes('0 aktive')));
for(const row of missing)assert.ok(!/^\/manager\/(vereine|saisons\/season\/kader|saisons\/season\/zugaenge)/.test(row.to),'non-admin link '+row.to);
assert.equal(missing.find(s=>s.key==='staff').to,'/manager/team?tab=trainers');
const real=referenceSteps(snapshot,true,'club','season',true);
assert.equal(real.find(s=>s.key==='club').state,'done');assert.equal(real.find(s=>s.key==='roster').state,'started');assert.equal(real.find(s=>s.key==='matches').state,'skipped');assert.equal(real.find(s=>s.key==='photo').state,'done');
assert.equal(real.find(s=>s.key==='photo').to,'/manager/vereine/club?setupSeason=season&setupStep=photo#manager-setup-checklist');
assert.equal(referenceSteps(null,null,null,null,true).find(s=>s.key==='photo').to,'/manager/team');

// Context switching must select an authorized membership and prefer the same season year.
const {ManagerReferenceContextSelect}=await compile('src/manager/modern/ManagerReferenceContextSelect.tsx');
const rows=[['r1','a','km','year1','active'],['r2','a','u13','year0','archived'],['r3','a','u13','year1','active'],['r4','b','u16','year1','active']].map(([id,club,team,year,status])=>({id,status,team:{id:team,club_id:club,name:team,clubs:{name:club}},season:{id:year,name:year}}));
let selected=null,tree;
await act(async()=>{tree=create(React.createElement(ManagerReferenceContextSelect,{seasons:rows,value:'r1',clubName:'a',onSelect:id=>selected=id}));});
await act(async()=>tree.root.findByProps({'aria-label':'Mannschaft'}).props.onChange({target:{value:'u13'}}));assert.equal(selected,'r3');
await act(async()=>tree.root.findByProps({'aria-label':'Verein'}).props.onChange({target:{value:'b'}}));assert.equal(selected,'r4');
await act(async()=>tree.unmount());

// The data provider never calls the platform-only setup RPC for trainer accounts,
// and discards a late result when the selected team changes.
const state={role:'trainer',season:'one',pending:[],calls:[]};globalThis.__centralReference=state;
const previousWindow=globalThis.window;globalThis.window={addEventListener(){},removeEventListener(){}};
const mocks={name:'provider-fixtures',setup(api){
 const files={session:"export const useSession=()=>({backendRole:globalThis.__centralReference.role,selectedTeamSeasonId:globalThis.__centralReference.season});",work:"export const useManagerWorkMode=()=>({workMode:'trainer',supportSession:null});",modules:"export const useManagerClubModules=()=>({clubId:'club'});",setup:"export const loadSetup=id=>{const s=globalThis.__centralReference;s.calls.push(id);return new Promise(resolve=>s.pending.push({id,resolve}));};",db:"export const supabase={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{photo_url:'photo'},error:null})})})})};"};
 for(const [filter,path] of [[/auth\/useSession$/,'session'],[/ManagerWorkModeContext$/,'work'],[/ManagerClubModulesContext$/,'modules'],[/lib\/managerSetup$/,'setup'],[/supabaseClient$/,'db']])api.onResolve({filter},()=>({path,namespace:'provider'}));
 api.onLoad({filter:/.*/,namespace:'provider'},({path})=>({contents:files[path],loader:'js'}));
}};
const provider=await compile('src/manager/modern/ManagerReferenceData.tsx',[mocks]);let observed;
function Observer(){observed=provider.useReferenceData();return null;}
function app(){return React.createElement(MemoryRouter,{initialEntries:['/manager'],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(provider.ManagerReferenceData,null,React.createElement(Observer)));}
await act(async()=>{tree=create(app());});assert.equal(state.calls.length,0);assert.equal(observed.snapshot,null);
state.role='admin';await act(async()=>tree.update(app()));assert.deepEqual(state.calls,['one']);assert.equal(observed.loading,true);
state.season='two';await act(async()=>tree.update(app()));assert.deepEqual(state.calls,['one','two']);
await act(async()=>state.pending[0].resolve({data:{...snapshot,club_name:'OLD'},error:null}));assert.equal(observed.snapshot,null);
await act(async()=>state.pending[1].resolve({data:{...snapshot,club_name:'CURRENT'},error:null}));assert.equal(observed.snapshot.club_name,'CURRENT');assert.equal(observed.photo,true);
state.season='three';await act(async()=>tree.update(app()));assert.equal(observed.snapshot,null);
await act(async()=>state.pending[2].resolve({data:null,error:'Unavailable'}));assert.equal(observed.error,'Unavailable');assert.equal(observed.loading,false);
await act(async()=>tree.unmount());globalThis.window=previousWindow;delete globalThis.__centralReference;
console.log('PASS: actual 11-step statuses, unknown/error states, role-safe links, authorized club/team/year switching, platform RPC isolation and stale-result protection.');
