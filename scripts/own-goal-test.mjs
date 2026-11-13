import {build} from 'esbuild';import {createRequire} from 'node:module';import {unlinkSync} from 'node:fs';
const out='node_modules/.own-goal-test.cjs',require=createRequire(import.meta.url);
try{
await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
import {countStadiumGoalsFromMatchEventRows} from './src/lib/matchEventScores';import assert from 'node:assert/strict';import {engineEventToInsertPayload,matchEventDbRowToEngine,updateGoalScorer} from './src/lib/liveMatchService';import {statsMatchEventRowToEngine} from './src/lib/matchEngine';
export async function run(){
for(const type of ['goal','goal_away'] as const){
 const payload=engineEventToInsertPayload('match',{type,timestamp:120,ownGoal:true,playerId:'should-not-get-credit'},1);assert.deepEqual(countStadiumGoalsFromMatchEventRows([payload]),type==='goal'?{home:1,away:0}:{home:0,away:1});assert.equal(payload.type,type);assert.equal(payload.player_id,null);assert.equal(payload.payload?.own_goal,true);
 const row={id:'goal',match_id:'match',type,minute:120,period:1,player_id:null,created_at:'2026-11-13',payload:payload.payload};assert.equal(matchEventDbRowToEngine(row)?.ownGoal,true);assert.equal(statsMatchEventRowToEngine(row)?.ownGoal,true);
 const regular=engineEventToInsertPayload('match',{type,timestamp:120,playerId:'player'},1);assert.equal(regular.player_id,'player');assert(!regular.payload?.own_goal);assert(!matchEventDbRowToEngine({...row,payload:null})?.ownGoal);
}
assert((await updateGoalScorer('goal','')).error);assert.equal((await updateGoalScorer('goal','',true)).error,null);assert.equal(globalThis.ownGoalPatch.player_id,null);assert.equal(globalThis.ownGoalPatch.payload.own_goal,true);assert.equal(globalThis.ownGoalPatch.payload.retained,'yes');
assert.equal((await updateGoalScorer('goal','player')).error,null);assert.equal(globalThis.ownGoalPatch.player_id,'player');assert.equal(globalThis.ownGoalPatch.payload.own_goal,false);console.log('PASS: both score sides, payload/engine reload, no player credit, legacy goals, correction and conversion back preserve payload.');
}
`},bundle:true,platform:'node',format:'cjs',outfile:out,logLevel:'silent',define:{'import.meta.env':'{}'},plugins:[{name:'mock-db',setup(b){b.onLoad({filter:/supabaseClient\.ts$/},()=>({contents:`export const supabase={from(table){const q={select(){return q},eq(){return q},maybeSingle(){return Promise.resolve({data:table==='matches'?{team_season_id:'season'}:{match_id:'match',type:'goal',payload:{retained:'yes'}}})},update(patch){globalThis.ownGoalPatch=patch;return q},then(resolve){resolve({error:null})}};return q}};`,loader:'js'}));b.onLoad({filter:/seasonTransition\.ts$/},()=>({contents:'export const assertTeamSeasonWritable=async()=>({ok:true});',loader:'js'}));}}]});
await require('../'+out).run();
}finally{try{unlinkSync(out)}catch{}}
