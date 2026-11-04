import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const { create, act } = require('react-test-renderer');
const own = '11111111-1111-4111-8111-111111111111';
const melk = '22222222-2222-4222-8222-222222222222';
const archive = '33333333-3333-4333-8333-333333333333';
const missing = '00000000-0000-0000-0000-000000000000';
const rows = [
  {id: own, status:'active', age_group:'U12', teams:{id:'rohrbach',name:'SPG Rohrbach'},seasons:{id:'s',name:'2026/27'}},
  {id: melk, status:'active', age_group:'U16', teams:{id:'melk',name:'SC Melk FR U16'},seasons:{id:'s',name:'2026/27'}},
  {id: archive, status:'archived', age_group:'U11', teams:{id:'rohrbach',name:'SPG Rohrbach'},seasons:{id:'old',name:'2025/26'}},
];
const storage = new Map();
const oldWindow = globalThis.window;
globalThis.window = {localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},setTimeout,clearTimeout};
globalThis.__favoriteAuth = {id:'trainer-a',email:'fixture@example.invalid'};
let writes = [];
globalThis.__favoriteDb = {from(table) {
  const filters = {};
  const chain = {
    select:()=>chain, order:()=>chain, limit:()=>chain,
    eq:(key,value)=>{filters[key]=value; return chain;},
    in:(key,value)=>{filters[key]=value; return chain;},
    maybeSingle:()=>result(true),
    then:(resolve,reject)=>result(false).then(resolve,reject),
    upsert:async(row,options)=>{writes.push({table,row,options});return {error:null};},
  };
  async function result(single) {
    let data=[];
    if (table==='user_roles') data={role:globalThis.__favoriteAuth?.id==='trainer-a'?'trainer':'fan'};
    if (table==='memberships') data=filters.user_id==='trainer-a' ? [{id:'m1',team_season_id:own,role:'trainer'},{id:'m2',team_season_id:archive,role:'parent'}] : [{id:'m3',team_season_id:own,role:'fan'}];
    if (table==='team_seasons') data=rows.filter(row=>Array.isArray(filters.id)?filters.id.includes(row.id):row.id===filters.id).map(row=>({...row,teams:{...row.teams,clubs:{status:'active'}}}));
    return {data:single&&Array.isArray(data)?data[0]??null:data,error:null};
  }
  return chain;
},rpc:async()=>({data:[],error:null})};
const compiled = await build({stdin:{contents:`export {SessionProvider,useSession} from './src/auth/useSession'; export {useActiveTeamSeason} from './src/hooks/useActiveTeamSeason'; export {restoreTeamViewFilter,resolveTeamViewSeasonIds} from './src/lib/teamViewSelection'; export {ensureFanTeamAccess} from './src/lib/teamFavorites';`,resolveDir:process.cwd(),loader:'tsx'},define:{'import.meta.env.DEV':'false'},bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'fixtures',setup(api){
  api.onResolve({filter:/\/AuthProvider$/},()=>({path:'auth',namespace:'fixture'}));
  api.onResolve({filter:/\/supabaseClient$/},()=>({path:'db',namespace:'fixture'}));
  api.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='auth'?'export function useAuth(){return {user:globalThis.__favoriteAuth,loading:false,signOut:async()=>{}}}':'export const supabase=globalThis.__favoriteDb;',loader:'js'}));
}}]});
const mod={exports:{}};
new Function('require','module','exports',compiled.outputFiles[0].text)(require,mod,mod.exports);
const {SessionProvider,useSession,useActiveTeamSeason,restoreTeamViewFilter,resolveTeamViewSeasonIds,ensureFanTeamAccess}=mod.exports;
let session,view,root;
function Observer(){session=useSession();view=useActiveTeamSeason();return null;}
const tree=()=>React.createElement(SessionProvider,null,React.createElement(Observer));
const settle=async(fn)=>act(async()=>{await fn(); await new Promise(resolve=>setImmediate(resolve));});
const render=()=>settle(()=>{if(root)root.update(tree());else root=create(tree());});
const check=(id,role)=>{assert.equal(session.selectedTeamSeasonId,own,'trainer work season is preserved');assert.equal(session.effectiveRole,'trainer','trainer role is preserved');assert.equal(view.readTeamSeasonId,id);assert.equal(view.role,role);};
try {
  assert.equal(restoreTeamViewFilter(['not-a-uuid']),null);
  assert.deepEqual(restoreTeamViewFilter([melk,melk,4]),[melk]);
  assert.deepEqual(resolveTeamViewSeasonIds(rows.filter(row=>row.id!==melk),[melk],own),[melk]);
  await render(); check(own,'trainer');
  await settle(()=>{session.setViewTeamSeasonId(melk);session.setTeamViewFilter([melk]);});
  check(melk,'fan'); assert.equal(view.readTeamSeason.team.name,'SC Melk FR U16');
  assert.deepEqual(session.filteredTeamSeasonIds,[melk]); assert.equal(writes.length,0,'view choice must not mutate membership roles');
  await settle(()=>root.unmount()); root=null; await render();
  check(melk,'fan'); assert.deepEqual(session.teamViewFilter,[melk],'reload restores the single external selection');
  globalThis.__favoriteAuth=null; await render(); assert.equal(session.viewTeamSeasonId,null);
  globalThis.__favoriteAuth={id:'trainer-a'}; await render(); check(melk,'fan');
  assert.deepEqual(session.teamViewFilter,[melk],'same user logout/login restores filter');
  globalThis.__favoriteAuth={id:'fan-b'}; await render();
  assert.equal(session.teamViewFilter,null,'account switch does not leak favorites');
  assert.equal(view.readTeamSeasonId,own); assert.equal(view.role,'fan');
  globalThis.__favoriteAuth={id:'trainer-a'}; await render(); check(melk,'fan');
  await settle(()=>{session.setViewTeamSeasonId(archive);session.setTeamViewFilter(null);});
  check(archive,'parent'); assert.equal(view.isHistoryReadOnly,true,'Rohrbach U11 family archive remains read-only');
  await settle(()=>{session.setViewTeamSeasonId(missing);session.setTeamViewFilter([missing]);});
  assert.equal(view.readTeamSeason,null,'missing favorite never borrows Rohrbach metadata');
  assert.ok(view.error); assert.equal(view.role,'fan');
  await settle(()=>session.setSelectedTeamSeasonId(own)); check(own,'trainer');
  await settle(()=>root.unmount());root=null;await render();check(own,'trainer');
  assert.equal(session.teamViewFilter,null,'explicit work-team return clears saved favorite filter');
  assert.equal(await ensureFanTeamAccess('trainer-a',melk),null);
  assert.equal(writes[0].row.role,'fan'); assert.equal(writes[0].options.ignoreDuplicates,true,'fan join cannot overwrite an existing trainer membership');
  assert.equal(await ensureFanTeamAccess('trainer-a',missing),'Diese Mannschaft ist derzeit nicht verfügbar.');
  assert.equal(writes.length,1,'unavailable favorite never creates a membership');
  console.log('PASS: actual SessionProvider reload/login/account switch, external favorite, trainer isolation, Rohrbach return, U11 archive, unavailable team and fan membership preservation.');
} finally {
  if(root)await settle(()=>root.unmount());
  globalThis.window=oldWindow;delete globalThis.__favoriteDb;delete globalThis.__favoriteAuth;
}
