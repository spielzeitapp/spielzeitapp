// Installed on main once; never execute a candidate's privileged release script.
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {github,releasePlan,isSha}=require('../../api/_lib/liveRelease.js');
const LIVE='shxugattqatahckhspwk';
const {RELEASE_HEAD:head,RELEASE_MAIN:main,RELEASE_PLAN_DIGEST:expected,GITHUB_TOKEN:token}=process.env;
if(!isSha(head)||!isSha(main)||!/^[a-f0-9]{64}$/.test(expected??''))throw new Error('Invalid pinned release inputs');
const gh=(path,options)=>github(token,path,options);
async function verify(){
 const plan=await releasePlan(gh,{ignoreRunId:process.env.GITHUB_RUN_ID});
 if(!plan.ready||plan.head!==head||plan.main!==main||plan.planDigest!==expected)throw new Error(`Release is no longer approved: ${plan.blockers.join(' ')}`);
 return plan;
}
async function db(query){
 const r=await fetch(`https://api.supabase.com/v1/projects/${LIVE}/database/query`,{method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query})});
 if(!r.ok)throw new Error(`LIVE database request failed (${r.status}); promotion stopped. Inspect database logs before retrying.`);
 return r.json();
}
const command=process.argv[2];
if(command==='verify'){
 const plan=await verify();console.log(`Verified ${head}; ${plan.totalCommits} commits, ${plan.migrations.length} reviewed migration files.`);
}else if(command==='publish'){
 const plan=await verify();
 if(!process.env.SUPABASE_ACCESS_TOKEN)throw new Error('Missing LIVE database connection');
 const rows=await db('select version from supabase_migrations.schema_migrations');
 const applied=new Set(rows.map(r=>r.version));
 const tree=await gh(`/git/trees/${head}?recursive=1`);if(tree.truncated)throw new Error('Candidate tree truncated');
 const manifestBlob=await gh(`/contents/release/live-plan.json?ref=${head}`);
 const manifest=JSON.parse(Buffer.from(manifestBlob.content,'base64').toString());
 const migrationFiles=tree.tree.filter(f=>f.path.startsWith('supabase/migrations/')&&f.path.endsWith('.sql'));
 if(migrationFiles.some(f=>!/^supabase\/migrations\/[0-9]{14}_[^/]+\.sql$/.test(f.path)))throw new Error('Noncanonical migration filenames require review before LIVE');
 const missing=migrationFiles.filter(f=>/^supabase\/migrations\/[0-9]{14}_[^/]+\.sql$/.test(f.path)&&!applied.has(f.path.split('/').pop().split('_')[0]));
 // Catch historic unapplied migrations too, not only the develop/main diff.
 for(const f of missing)if(manifest.migrations[f.path]!==f.sha)throw new Error(`Migration not reviewed for LIVE: ${f.path}`);
 const sqlFiles=[];
 for(const f of missing.sort((a,b)=>a.path.localeCompare(b.path))){
  const blob=await gh(`/git/blobs/${f.sha}`);if(blob.sha!==f.sha||blob.encoding!=='base64')throw new Error('Migration blob mismatch');
  sqlFiles.push({path:f.path,sql:Buffer.from(blob.content,'base64').toString('utf8'),version:f.path.split('/').pop().split('_')[0]});
 }
 await verify();
 for(const f of sqlFiles){
  console.log(`Applying approved LIVE migration ${f.path}`);
  await db(`begin;\n${f.sql}\ninsert into supabase_migrations.schema_migrations(version) values('${f.version}') on conflict do nothing;\ncommit;`);
 }
 // Revalidate after migrations. No force-push and no TEST database copy.
 await verify();
 await gh('/git/refs/heads/main',{method:'PATCH',body:JSON.stringify({sha:head,force:false})});
 console.log(`LIVE branch promoted to ${head}. Actor ${process.env.RELEASE_ACTOR}; request ${process.env.RELEASE_REQUEST_ID}.`);
}else if(command==='monitor'){
 const deadline=Date.now()+8*60*1000;
 let ready=false;
 while(Date.now()<deadline){
  try{const r=await fetch(`https://spielzeitapp.at/api/release/manage?view=version&t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});const v=await r.json();if(v.sha===head&&v.branch==='main'){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,15000));
 }
 if(!ready)throw new Error('LIVE code deployment not confirmed. Main/database may already be updated; do not blindly retry. Inspect Vercel deployment.');
 console.log(`Confirmed LIVE deployment ${head}.`);
}else throw new Error('Unknown release command');
