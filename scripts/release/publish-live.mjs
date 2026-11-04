// Installed on main once; never execute a candidate's privileged release script.
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {github,releasePlan,isSha}=require('../../server/lib/liveRelease.js');
const {publishRelease,deployServerFunction,finalizeRelease}=require('../../server/lib/releasePublisher.js');
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
 if(!process.env.SUPABASE_ACCESS_TOKEN)throw new Error('Missing LIVE database connection');
 const deployFunction=file=>deployServerFunction(file,{token:process.env.SUPABASE_ACCESS_TOKEN});
 await publishRelease({gh,db,verify,deployFunction,log:console.log});
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
}else if(command==='finalize'){
 if(!process.env.SUPABASE_ACCESS_TOKEN)throw new Error('Missing LIVE database connection');
 const publicVersion=async()=>{
  const response=await fetch(`https://spielzeitapp.at/api/release/manage?view=version&t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Cannot verify public LIVE version');
  return response.json();
 };
 await finalizeRelease({gh,db,head,publicVersion});
 console.log('Verified LIVE technical configuration. No TEST settings or content copied.');
}else throw new Error('Unknown release command');
