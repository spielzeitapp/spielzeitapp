const {test}=require('node:test'),assert=require('node:assert/strict');
const review=require('../../server/lib/technicalReview');
const HEAD='a'.repeat(40),MAIN='b'.repeat(40),SQL='c'.repeat(40),DIGEST='d'.repeat(64);
const plan=()=>({head:HEAD,main:MAIN,planDigest:DIGEST,comparisonComplete:true,blockers:['Datenbankänderungen benötigen noch eine technische Freigabe.'],migrations:[{path:'supabase/migrations/20261107120000_add_caption.sql',sha:SQL,reviewed:false}]});
const run=()=>({id:17,event:'workflow_dispatch',head_branch:'main',head_sha:MAIN,path:'.github/workflows/review-live-schema.yml',status:'completed',conclusion:'success'});
const report=()=>({schema_version:1,...review.snapshot(plan()),passed:true,runId:'17',createdAt:new Date().toISOString()});
test('only a pinned snapshot with database approval as the sole blocker can start',()=>{
 assert.equal(review.canReview(plan()),true);
 for(const p of [{...plan(),comparisonComplete:false},{...plan(),head:MAIN},{...plan(),blockers:['Checks failed']},{...plan(),migrations:[]}])assert.equal(review.canReview(p),false);
 assert.throws(()=>review.assertSnapshot(plan(),{...plan(),head:MAIN}),/Stand geändert/);
});
test('approval requires trusted completed main workflow and exact unexpired report',()=>{
 review.assertReport(plan(),run(),report());
 for(const patch of [{head_sha:HEAD},{head_branch:'develop'},{path:'.github/workflows/publish-live.yml'},{event:'pull_request'},{status:'in_progress'},{conclusion:'failure'}])assert.throws(()=>review.assertReport(plan(),{...run(),...patch},report()));
 for(const patch of [{head:MAIN},{main:HEAD},{planDigest:'f'.repeat(64)},{runId:'18'},{passed:false},{migrations:[]},{createdAt:'invalid'},{createdAt:new Date(Date.now()-3601000).toISOString()}])assert.throws(()=>review.assertReport(plan(),run(),{...report(),...patch}));
});
test('approval records exact files, actor and report then performs only non-force develop update',async()=>{
 const writes=[];
 const gh=async(path,opts)=>{
  if(opts){writes.push([path,JSON.parse(opts.body)]);return path==='/git/trees'?{sha:SQL}:path==='/git/commits'?{sha:'e'.repeat(40)}:{};}
  if(path==='/actions/runs/17')return run();
  if(path.includes('/artifacts'))return {artifacts:[{id:31,name:'technical-review',size_in_bytes:100,expired:false}]};
  if(path.startsWith('/contents/'))return {content:Buffer.from(JSON.stringify({schema_version:1,migrations:{existing:SQL}})).toString('base64')};
  if(path.startsWith('/git/commits/'))return {tree:{sha:SQL}};
  if(path.endsWith('/develop'))return {object:{sha:HEAD}};
  if(path.endsWith('/main'))return {object:{sha:MAIN}};
  throw Error(path);
 };
 await review.approve(gh,plan(),{...plan(),runId:17},'admin-id',async()=>report());
 const tree=writes[0][1];assert.equal(JSON.parse(tree.tree[0].content).migrations[plan().migrations[0].path],SQL);
 assert.equal(JSON.parse(tree.tree[1].content).actor,'admin-id');
 assert.deepEqual(writes.at(-1),['/git/refs/heads/develop',{sha:'e'.repeat(40),force:false}]);
});
test('a concurrent source update prevents approval writes to develop',async()=>{
 let patched=false;
 const gh=async(path,opts)=>{
  if(opts){if(path.includes('/refs/'))patched=true;return {sha:SQL};}
  if(path==='/actions/runs/17')return run();
  if(path.includes('/artifacts'))return {artifacts:[{id:31,name:'technical-review',size_in_bytes:100}]};
  if(path.startsWith('/contents/'))return {content:Buffer.from('{"schema_version":1,"migrations":{}}').toString('base64')};
  if(path.startsWith('/git/commits/'))return {tree:{sha:SQL}};
  return {object:{sha:SQL}};
 };
 await assert.rejects(review.approve(gh,plan(),{...plan(),runId:17},'admin',async()=>report()),/inzwischen geändert/);assert.equal(patched,false);
});
