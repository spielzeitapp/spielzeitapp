const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planDatabaseFiles,blobSha,SUPPORTED_FUNCTION}=require('../../server/lib/releaseDatabase');
const {publishRelease,deployServerFunction,finalizeRelease}=require('../../server/lib/releasePublisher');
const HEAD='a'.repeat(40),MAIN='b'.repeat(40);
const path='supabase/migrations/20261104150000_reviewed.sql';
const legacy='supabase/migrations/20260405140000_legacy.sql';
const sql='create table public.reviewed_release_test(id integer);';
const file={path,sha:blobSha(sql),type:'blob'};
const frozen={path:legacy,sha:blobSha('historic SQL that must never run'),type:'blob'};
const baseline={schema_version:1,live_project:'shxugattqatahckhspwk',source_main:MAIN,adopted_files:{[legacy]:frozen.sha}};
const edge={path:SUPPORTED_FUNCTION,content:'Deno.serve(()=>new Response("test"));'};edge.sha=blobSha(edge.content);
const approvals={[path]:file.sha};
function fixture(options={}){
 const events=[];
 const manifest={schema_version:1,migrations:approvals,functions:{[edge.path]:edge.sha}};
 const plan={ready:true,head:HEAD,main:MAIN,functions:options.edge?[{path:edge.path,sha:edge.sha,reviewed:true}]:[]};
 const gh=async(url,opts)=>{
  if(opts?.method==='PATCH'){events.push('promote');assert.deepEqual(JSON.parse(opts.body),{sha:HEAD,force:false});return {};}
  if(url.includes('/git/trees/'))return{tree:[frozen,file],truncated:options.truncated??false};
  if(url.includes('/contents/release/live-plan.json'))return{content:Buffer.from(JSON.stringify(manifest)).toString('base64')};
  if(url.includes('/contents/release/legacy-baseline.json')){assert.ok(url.endsWith(MAIN),'baseline must come from pinned MAIN');return{content:Buffer.from(JSON.stringify(baseline)).toString('base64')};}
  if(url.includes('/git/blobs/')){
   const sha=url.split('/').pop();const content=sha===file.sha?sql:edge.content;
   return{sha,encoding:'base64',content:Buffer.from(options.tamper?'wrong content':content).toString('base64')};
  }
  throw Error(url);
 };
 const db=async query=>{
  if(query.startsWith('select version'))return options.history??[];
  events.push('migrations');assert.match(query,/^BEGIN;/);assert.match(query,/COMMIT;$/);
  assert.ok(query.includes(sql));assert.ok(!query.includes('historic SQL that must never run'));
  assert.match(query,/statements\) VALUES/);assert.match(query,/lock_timeout='3s'/);
  if(options.dbError)throw Error('database unavailable');return [];
 };
 let checks=0;
 const verify=async()=>{events.push('verify');checks++;if(options.changedAfterSql&&checks===3)throw Error('snapshot changed');return plan;};
 const deployFunction=async f=>{events.push('function');assert.equal(f.sha,edge.sha);if(options.functionError)throw Error('function failed');};
 return{gh,db,verify,deployFunction,events};
}
test('frozen history is not replayed, changed or marked as applied',()=>{
 const p=planDatabaseFiles([frozen,file],[],approvals,baseline);
 assert.equal(p.pending.length,1);assert.equal(p.frozen.length,1);
 assert.throws(()=>planDatabaseFiles([{...frozen,sha:HEAD}],[],approvals,baseline),/Historical SQL changed/);
 assert.throws(()=>planDatabaseFiles([file],[],{},baseline),/not reviewed/);
 assert.throws(()=>planDatabaseFiles([file],[],approvals,{...baseline,live_project:'TEST'}),/baseline/);
});
test('excluded role SQL and duplicate pending versions fail before any execution',()=>{
 assert.throws(()=>planDatabaseFiles([{path:'supabase/migrations/20260818140000_roles.sql',sha:HEAD}],[],{},baseline),/Excluded/);
 assert.throws(()=>planDatabaseFiles([file,{...file,path:path.replace('reviewed','duplicate')}],[],{...approvals,[path.replace('reviewed','duplicate')]:file.sha},baseline),/Duplicate/);
});
test('publisher commits reviewed SQL atomically, then functions, then exact code',async()=>{
 const f=fixture({edge:true});const result=await publishRelease(f);
 assert.deepEqual(f.events,['verify','verify','migrations','verify','function','verify','promote']);
 assert.deepEqual(result,{migrations:1,functions:1,frozen:1});
});
test('database, function and changed-snapshot failures stop code promotion',async()=>{
 for(const options of [{dbError:true},{edge:true,functionError:true},{edge:true,changedAfterSql:true}]){
  const f=fixture(options);await assert.rejects(publishRelease(f));assert.ok(!f.events.includes('promote'));
  if(options.dbError)assert.ok(!f.events.includes('function'));
 }
});
test('tampered blobs and incomplete trees cannot reach database mutations',async()=>{
 for(const options of [{tamper:true},{truncated:true}]){const f=fixture(options);await assert.rejects(publishRelease(f));assert.ok(!f.events.includes('migrations'));assert.ok(!f.events.includes('promote'));}
});
test('a retry requires the exact recorded SQL and does not replay committed migrations',async()=>{
 const f=fixture({history:[{version:'20261104150000',statements:[sql]}]});
 await publishRelease(f);assert.ok(!f.events.includes('migrations'));assert.ok(f.events.includes('promote'));
 for(const statements of [null,['different SQL']]){const bad=fixture({history:[{version:'20261104150000',statements}]});await assert.rejects(publishRelease(bad),/recorded SQL/);assert.ok(!bad.events.includes('promote'));}
});
test('deployment sends only approved source to LIVE and retains JWT protection',async()=>{
 const requests=[];
 const request=async(url,options)=>{
  requests.push({url,options});assert.ok(url.includes('/projects/shxugattqatahckhspwk/functions/'));
  if(options.method==='POST'){
   const metadata=JSON.parse(options.body.get('metadata'));
   assert.deepEqual(metadata,{entrypoint_path:'index.ts',verify_jwt:true,name:'generate-club-communications'});
   assert.equal(await options.body.get('file').text(),edge.content);
  }
  return{ok:true,json:async()=>({slug:'generate-club-communications',status:'ACTIVE',version:2,verify_jwt:true})};
 };
 const result=await deployServerFunction(edge,{token:'fixture',request});assert.equal(result.sha,edge.sha);assert.equal(requests.length,2);
});
test('unsupported source, wrong JWT and stale deployed versions are rejected',async()=>{
 await assert.rejects(deployServerFunction({...edge,path:'supabase/functions/other/index.ts'},{token:'fixture',request:()=>{throw Error('must not request');}}),/Unsupported/);
 for(const wrong of [{verify_jwt:false},{version:1},{status:'REMOVED'}]){
  let calls=0;const request=async()=>({ok:true,json:async()=>{calls++;return{slug:'generate-club-communications',status:'ACTIVE',version:2,verify_jwt:true,...(calls===2?wrong:{})};}});
  await assert.rejects(deployServerFunction(edge,{token:'fixture',request}),/verification failed/);
 }
});

test('technical sync uses only LIVE and activates only after exact public code confirmation',async()=>{
 let calls=[];const gh=async path=>path.includes('/git/ref/')?{object:{sha:HEAD}}:{content:Buffer.from(JSON.stringify({post_deploy:{oefb_sync:true}})).toString('base64')};
 const db=async query=>{calls.push(query);return [{ready:true}];};
 await finalizeRelease({gh,db,head:HEAD,publicVersion:async()=>({sha:HEAD,branch:'main'})});
 assert.equal(calls.length,2);assert.match(calls[0],/https:\/\/spielzeitapp.at/);assert.ok(!calls.join('').includes('app.spielzeitapp.at'));
 calls=[];await assert.rejects(finalizeRelease({gh,db,head:HEAD,publicVersion:async()=>({sha:MAIN,branch:'main'})}),/not confirmed/);assert.equal(calls.length,0);
});
