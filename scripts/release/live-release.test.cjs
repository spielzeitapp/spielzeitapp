const {test}=require('node:test');const assert=require('node:assert/strict');
const {releasePlan,digest}=require('../../server/lib/liveRelease');
const HEAD='a'.repeat(40),MAIN='b'.repeat(40),SQL='c'.repeat(40);
function stub(options={}){return async path=>{
 if(path==='/git/ref/heads/develop')return{object:{sha:options.head??HEAD}};
 if(path==='/git/ref/heads/main')return{object:{sha:MAIN}};
 if(path.startsWith('/git/trees/'))return options.trees?.[path.includes(MAIN)?'before':'after']??{truncated:true,tree:[]};
 if(path.startsWith('/compare/'))return{status:options.status??'ahead',ahead_by:1,commits:[{sha:HEAD,commit:{message:'new feature'}}],files:options.files??[]};
 if(path.includes('/status'))return{statuses:[{context:'Vercel – spielzeitapp',state:options.check??'success'},{context:'Vercel – spielzeitapp-intern',state:'success'}]};
 if(path.startsWith('/contents/'))return{content:Buffer.from(JSON.stringify({schema_version:1,migrations:options.manifest??{}})).toString('base64')};
 if(path.includes('/runs'))return{workflow_runs:options.runs??[]};
 if(path.includes('/actions/workflows/')){if(options.noWorkflow){const e=Error();e.status=404;throw e;}return{state:'active'};}
 throw Error(path);
};}
test('a pinned green code-only release has a stable approved digest',async()=>{const a=await releasePlan(stub());const b=await releasePlan(stub());assert.equal(a.ready,true);assert.equal(a.trafficLight,'green');assert.equal(a.planDigest,b.planDigest);assert.match(a.planDigest,/^[a-f0-9]{64}$/);assert.notEqual(digest({head:HEAD}),digest({head:MAIN}));});
test('pending checks, divergence, absent bootstrap and already live versions block',async()=>{for(const options of [{check:'pending'},{status:'diverged'},{noWorkflow:true},{head:MAIN}])assert.equal((await releasePlan(stub(options))).ready,false);});
test('migration approval is exact file content and new-file only',async()=>{const file={filename:'supabase/migrations/20261104000000_example.sql',sha:SQL,status:'added'};assert.equal((await releasePlan(stub({files:[file]}))).ready,false);assert.equal((await releasePlan(stub({files:[file],manifest:{[file.filename]:SQL}}))).ready,true);assert.equal((await releasePlan(stub({files:[{...file,status:'modified'}],manifest:{[file.filename]:SQL}}))).ready,false);assert.equal((await releasePlan(stub({files:[file],manifest:{[file.filename]:HEAD}}))).ready,false);});
test('running releases block API requests, but the worker can check its own run',async()=>{const gh=stub({runs:[{id:12,status:'in_progress'}]});assert.equal((await releasePlan(gh)).ready,false);assert.equal((await releasePlan(gh,{ignoreRunId:'12'})).ready,true);});
test('truncated file comparisons block rather than silently omitting changes',async()=>{assert.equal((await releasePlan(stub({files:Array.from({length:300},(_,i)=>({filename:`src/f${i}`,sha:SQL}))}))).ready,false);});
test('changed candidates invalidate snapshot approval',async()=>{const a=await releasePlan(stub());const b=await releasePlan(stub({head:'d'.repeat(40)}));assert.notEqual(a.planDigest,b.planDigest);});
test('server authorization, environment and exact-snapshot gates cannot be bypassed by UI input',async()=>{
 const {build}=require('esbuild');
 const built=await build({entryPoints:['api/release/manage.js'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'auth-fixture',setup(b){
  b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'db',namespace:'fixture'}));
  b.onResolve({filter:/liveRelease\.js$/},()=>({path:'release',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='db'?`exports.createClient=()=>({auth:{getUser:async()=>({data:{user:global.__releaseUser},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:global.__releaseRole},error:null})})})})});`:`module.exports={WORKFLOW:'publish-live.yml',github:async()=>{global.__releaseDispatches++;},releasePlan:async()=>global.__releasePlan};`}));
 }}]});
 const m={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,m,m.exports);const handler=m.exports.default;
 const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RELEASE_GITHUB_TOKEN','VERCEL_GIT_COMMIT_REF'];const previous=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 async function call(body,authorization='Bearer example'){let status=200,result;const res={setHeader(){},status(s){status=s;return this;},json(x){result=x;return this;}};await handler({method:'POST',headers:{authorization},body},res);return{status,result};}
 try{
  process.env.SUPABASE_URL='https://acbaecjzoabafbsjrzvr.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';process.env.RELEASE_GITHUB_TOKEN='fixture';process.env.VERCEL_GIT_COMMIT_REF='develop';
  global.__releaseUser={id:'verified-user'};global.__releaseRole='trainer';global.__releaseDispatches=0;global.__releasePlan={ready:true,head:HEAD,main:MAIN,planDigest:'e'.repeat(64)};
  assert.equal((await call(global.__releasePlan)).status,403);
  global.__releaseRole='admin';assert.equal((await call({...global.__releasePlan,head:MAIN})).status,409);
  assert.equal((await call(global.__releasePlan,'')).status,401);
  process.env.VERCEL_GIT_COMMIT_REF='main';assert.equal((await call(global.__releasePlan)).status,403);
  process.env.VERCEL_GIT_COMMIT_REF='develop';process.env.SUPABASE_URL='https://shxugattqatahckhspwk.supabase.co';assert.equal((await call(global.__releasePlan)).status,403);
  assert.equal(global.__releaseDispatches,0);
 }finally{for(const n of names){if(previous[n]===undefined)delete process.env[n];else process.env[n]=previous[n];}for(const n of ['__releaseUser','__releaseRole','__releasePlan','__releaseDispatches'])delete global[n];}
});
test('Manager requires a ready preview and explicit confirmation before dispatch',async()=>{
 const React=require('react');const {create,act}=require('react-test-renderer');const {build}=require('esbuild');
 const b=await build({entryPoints:['src/manager/ManagerLiveReleasePanel.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'error',define:{'import.meta.env':'{}'},plugins:[{name:'session',setup(b){b.onResolve({filter:/supabaseClient$/},()=>({path:'session',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'exports.supabase={auth:{getSession:async()=>({data:{session:{access_token:"fixture"}}})}};'}));}}]});
 const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);
 const previousWindow=global.window,previousFetch=global.fetch;
 let renderer,posts=[];let plan={ready:false,blockers:['Verbindung fehlt'],checks:[],migrations:[],commits:[],runs:[]};
 global.window={location:{hostname:'app.spielzeitapp.at'}};global.fetch=async(url,options)=>{if(options.method==='POST'){posts.push(JSON.parse(options.body));return{ok:true,json:async()=>({requestId:'fixture-request'})};}return{ok:true,json:async()=>plan};};
 const button=()=>renderer.root.findAllByType('button').find(x=>x.children.includes('Geprüften Stand LIVE veröffentlichen'));
 try{
  await act(async()=>{renderer=create(React.createElement(m.exports.ManagerLiveReleasePanel));});assert.equal(button().props.disabled,true);
  plan={...plan,ready:true,blockers:[],warnings:['Große Aktualisierung'],head:HEAD,main:MAIN,planDigest:'e'.repeat(64)};
  await act(async()=>renderer.root.findAllByType('button').find(x=>x.children.includes('Stand prüfen')).props.onClick());assert.equal(button().props.disabled,true);
  await act(async()=>renderer.root.findByType('input').props.onChange({target:{checked:true}}));assert.equal(button().props.disabled,false);
  await act(async()=>button().props.onClick());assert.equal(posts.length,1);assert.deepEqual(posts[0],{head:HEAD,main:MAIN,planDigest:'e'.repeat(64)});assert.equal(button().props.disabled,true);
 }finally{if(renderer)await act(async()=>renderer.unmount());global.window=previousWindow;global.fetch=previousFetch;}
});

test('a complete large diff is yellow and publishable, not automatically red',async()=>{
 const files=Array.from({length:350},(_,i)=>({filename:`src/f${i}`,sha:SQL}));
 const trees={before:{tree:[]},after:{tree:files.map(f=>({path:f.filename,sha:f.sha,type:'blob',mode:'100644'}))}};
 const plan=await releasePlan(stub({files:files.slice(0,300),trees}));
 assert.equal(plan.changedFiles,350);assert.equal(plan.comparisonComplete,true);assert.equal(plan.trafficLight,'yellow');assert.equal(plan.ready,true);assert.equal(plan.warnings.length,1);
});
test('migration hidden beyond the compare cap still blocks and requires exact approval',async()=>{
 const files=Array.from({length:300},(_,i)=>({filename:`src/f${i}`,sha:SQL}));
 const migration='supabase/migrations/20261104130000_hidden.sql';
 const trees={before:{tree:[]},after:{tree:[...files.map(f=>({path:f.filename,sha:f.sha,type:'blob'})),{path:migration,sha:HEAD,type:'blob'}]}};
 const plan=await releasePlan(stub({files,trees}));assert.equal(plan.ready,false);assert.equal(plan.trafficLight,'red');assert.equal(plan.migrations[0].path,migration);
 assert.equal((await releasePlan(stub({files,trees,manifest:{[migration]:HEAD}}))).ready,true);
});
test('large diff cannot approve modified or removed shipped migrations',async()=>{
 const files=Array.from({length:300},(_,i)=>({filename:`src/f${i}`,sha:SQL}));
 const path='supabase/migrations/20261104130000_existing.sql';
 for(const after of [[],[{path,sha:HEAD,type:'blob'}]]){
  const trees={before:{tree:[{path,sha:SQL,type:'blob'}]},after:{tree:after}};
  const plan=await releasePlan(stub({files,trees,manifest:{[path]:HEAD}}));assert.equal(plan.ready,false);assert.equal(plan.trafficLight,'red');
 }
});
test('code promotion cannot silently skip Edge Functions or activate changed privileged workflows',async()=>{
 for(const filename of ['supabase/functions/send-reminders/index.ts','.github/workflows/production-release.yml','server/lib/liveRelease.js','scripts/release/publish-live.mjs']){
  const plan=await releasePlan(stub({files:[{filename,status:'modified',sha:SQL}]}));assert.equal(plan.ready,false);assert.equal(plan.trafficLight,'red');
 }
});
