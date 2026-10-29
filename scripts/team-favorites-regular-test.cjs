const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file, mocks) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  vm.runInNewContext(output, {exports, require:name => { if (!(name in mocks)) throw Error(name); return mocks[name]; }});
  return exports;
}
(async () => {
  const calls = [];
  const supabase = {from(table) {
    if (table === 'memberships') return {upsert:async (row, options) => {calls.push({row,options}); return {error:null};}};
    const chain = {select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:{id:'season-b',teams:{clubs:{status:'active'}}},error:null})};
    return chain;
  }};
  const {ensureFanTeamAccess} = load('src/lib/teamFavorites.ts', {'./supabaseClient':{supabase}});
  assert.equal(await ensureFanTeamAccess('user-a','season-b'),null);
  assert.equal(calls[0].row.user_id,'user-a');
  assert.equal(calls[0].row.role,'fan');
  assert.equal(calls[0].options.ignoreDuplicates,true,'existing trainer/parent role must never be overwritten');
  assert.equal(calls[0].options.onConflict,'user_id,team_season_id');
  let session;
  const {useActiveTeamSeason} = load('src/hooks/useActiveTeamSeason.ts', {
    react:{useMemo:fn=>fn()}, '../auth/useSession':{useSession:()=>session},
    '../lib/seasonLifecycle':{formatTeamSeasonContextLabel:()=>'', formatTeamSeasonDisplayLabel:()=>'', isSeasonArchived:status=>status==='archived', resolveTeamSeasonLabelParts:()=>({}), SEASON_SOFT_LOCK_MESSAGE:'Archiv'},
  });
  const own = {id:'season-a',status:'active',team:{name:'Own'},season:{name:'2026/27'}};
  const other = {...own,id:'season-b',team:{name:'Other'}};
  session={loading:false,selectedTeamSeasonId:own.id,selectedTeamSeason:own,viewTeamSeasonId:other.id,viewTeamSeason:other,teamSeasons:[own],memberships:[{team_season_id:own.id,role:'trainer'}],effectiveRole:'trainer'};
  let context=useActiveTeamSeason();
  assert.equal(context.role,'fan');
  assert.equal(context.readTeamSeasonId,'season-b');
  assert.equal(context.activeTeamSeasonId,'season-a');
  assert.equal(context.isReadOnlyView,true);
  session={...session,viewTeamSeason:null,viewTeamSeasonLoading:true};
  context=useActiveTeamSeason();
  assert.equal(context.readTeamSeason,null,'must not show own team while favorite metadata loads');
  assert.equal(context.loading,true);
  session={...session,viewTeamSeasonId:own.id,viewTeamSeason:own,viewTeamSeasonLoading:false};
  context=useActiveTeamSeason(); assert.equal(context.role,'trainer'); assert.equal(context.isReadOnlyView,false);
  session={...session,viewTeamSeasonId:'archive',viewTeamSeason:{...own,id:'archive',status:'archived'},memberships:[{team_season_id:'archive',role:'parent'}]};
  context=useActiveTeamSeason(); assert.equal(context.role,'parent'); assert.equal(context.isHistoryReadOnly,true);
  console.log('PASS: fan access preserves existing roles; favorite reads and active write team stay separate; loading and parent archive stay scoped.');
})().catch(error=>{console.error(error);process.exitCode=1;});
