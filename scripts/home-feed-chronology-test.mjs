import assert from 'node:assert/strict';import{build}from'esbuild';import{createRequire}from'node:module';const require=createRequire(import.meta.url);const b=await build({stdin:{contents:"export * from './src/lib/feedPostPriority'; export { mapVisiblePosts } from './src/hooks/useTeamFeedPosts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'error',define:{'import.meta.env':'{}'},plugins:[{name:'db',setup(b){b.onResolve({filter:/supabaseClient$/},()=>({path:'db',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase={};'}));}}]});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);const{sortClassifiedFeedPosts:sort,isFeedPostVisibleInHomeFeed:visible}=m.exports;
const item=(id,kind,created,starts)=>({kind:kind==='result_auto'?'result':'trainer',post:{id,post_kind:kind,media_type:kind==='result_auto'?'result':'text',created_at:created,payload:starts?{starts_at:starts}:null}});
const old=item('old','result_auto','2026-11-02T10:00:00Z','2026-09-03T10:00:00Z'),news=item('new','trainer_post','2026-10-12T05:53:00Z'),result=item('result','result_auto','2026-11-03T07:00:00Z','2026-11-02T15:30:00Z');
assert.deepEqual(sort([old,news,result],new Map()).map(i=>i.post.id),['result','new','old']);assert.equal(visible({event_id:'event',post_kind:'next_match_auto',payload:{event_id:'event',kickoff_iso:'2026-10-17T16:00:00Z'}},new Map([['event','finished']])),false);console.log('PASS: imported results use match day; newer days precede old result priorities; finished announcement hidden.');

// Exercise the actual Home mapping path, including same-day priority conflicts,
// multi-team favourites, identical import batches and invalid-date fallbacks.
const { mapVisiblePosts, sortFeedPostsChronologically } = m.exports;
const rows = [
  {...item('rohrbach-old','result_auto','2026-11-03T09:42:00Z','2026-10-09T16:00:00Z').post,team_season_id:'rohrbach'},
  {...item('rohrbach-recent','result_auto','2026-11-03T09:42:00Z','2026-11-02T15:30:00Z').post,team_season_id:'rohrbach'},
  {...item('melk-old','result_auto','2026-11-03T09:42:00Z','2026-08-25T16:00:00Z').post,team_season_id:'melk'},
  {...item('melk-recent','result_auto','2026-11-03T09:42:00Z','2026-10-31T16:00:00Z').post,team_season_id:'melk'},
].map(post => ({...post,payload:{...post.payload,team_season_id:post.team_season_id,match_id:post.id,home_team_name:'Heim',away_team_name:'Gast',home_score:1,away_score:0}}));
const mapped=mapVisiblePosts(rows,new Map(),new Date('2026-11-03T10:00:00Z'),{chronicle:true}).posts;
assert.equal(mapped.length,4,'Actual Home mapping must retain the result fixtures');
assert.deepEqual(mapped.map(i=>i.post.id),['rohrbach-recent','melk-recent','rohrbach-old','melk-old']);
const early=item('early','result_auto','2026-11-03T11:00:00Z','2026-11-02T09:00:00Z');
const late=item('late','trainer_post','2026-11-02T18:00:00Z');
assert.deepEqual(sort([early,late],new Map()).map(i=>i.post.id),['late','early']);
const invalid=item('invalid','result_auto','2026-11-02T20:00:00Z','invalid');
assert.deepEqual(sortFeedPostsChronologically([early,invalid,late]).map(i=>i.post.id),['invalid','late','early']);
assert.deepEqual(sortFeedPostsChronologically([...mapped].reverse()).map(i=>i.post.id),mapped.map(i=>i.post.id));
console.log('PASS: actual Home mapping, Melk/Rohrbach mixed feed, same-day chronology and import-date fallback.');
