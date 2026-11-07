// Trusted main-only worker. Candidate files are data; candidate scripts never run here.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {github,releasePlan,isSha}=require('../../server/lib/liveRelease');
const {snapshot,assertSnapshot}=require('../../server/lib/technicalReview');
const {blobSha}=require('../../server/lib/releaseDatabase');
const {RELEASE_HEAD:head,RELEASE_MAIN:main,RELEASE_PLAN_DIGEST:planDigest}=process.env;
if(!isSha(head)||!isSha(main)||!/^[a-f0-9]{64}$/.test(planDigest??''))throw Error('Invalid review snapshot');
const command=process.argv[2];
if(command==='prepare'){
 const gh=(path,options)=>github(process.env.GITHUB_TOKEN,path,options);
 const plan=await releasePlan(gh);assertSnapshot(plan,{head,main,planDigest});
 const tree=await gh(`/git/trees/${head}?recursive=1`);if(tree.truncated)throw Error('Incomplete candidate tree');
 const files=[];
 for(const m of plan.migrations.filter(m=>!m.reviewed)){
  const file=tree.tree.find(f=>f.path===m.path);if(!file||file.type!=='blob'||file.mode!=='100644'||file.sha!==m.sha)throw Error('Invalid migration entry');
  const before=await gh(`/git/trees/${main}?recursive=1`);if(before.truncated||before.tree.some(f=>f.path===m.path))throw Error('Only new SQL files may be reviewed');
  const blob=await gh(`/git/blobs/${m.sha}`);if(blob.encoding!=='base64'||blob.size>200000)throw Error('Migration too large');
  const sql=Buffer.from(blob.content,'base64').toString('utf8');if(blobSha(sql)!==m.sha)throw Error('SQL hash mismatch');files.push({...m,sql});
 }
 // Only names and types. No row contents, function bodies, defaults, credentials or business data.
 const query=`select jsonb_build_object('enums',coalesce((select jsonb_agg(x) from (select n.nspname as schema,t.typname as name,jsonb_agg(e.enumlabel order by e.enumsortorder) as values from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname in ('public','auth','storage') group by n.nspname,t.typname) x),'[]'::jsonb),'columns',coalesce((select jsonb_agg(x) from (select c.relname as table_name,a.attname as column_name,format_type(a.atttypid,a.atttypmod) as type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum) x),'[]'::jsonb)) as snapshot`;
 const r=await fetch('https://api.supabase.com/v1/projects/shxugattqatahckhspwk/database/query',{method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:true})});
 if(!r.ok)throw Error(`Schema snapshot unavailable (${r.status})`);
 const rows=await r.json();const schema=rows[0]?.snapshot;if(!schema?.columns?.length||!Array.isArray(schema.enums))throw Error('Incomplete LIVE schema snapshot');
 fs.mkdirSync('review-work',{recursive:true});fs.writeFileSync('review-work/bundle.json',JSON.stringify({...snapshot(plan),files,schema}));
 console.log(`Prepared ${files.length} new migrations without reading LIVE business rows.`);
}else if(command==='check'){
 const bundle=JSON.parse(fs.readFileSync('review-work/bundle.json','utf8'));
 if(bundle.head!==head||bundle.main!==main||bundle.planDigest!==planDigest)throw Error('Bundle mismatch');
 execFileSync('python',['scripts/release/review-sql.py','review-work/bundle.json','review-work/classified.json'],{stdio:'inherit'});
 const files=JSON.parse(fs.readFileSync('review-work/classified.json','utf8'));
 const {PGlite}=await import(process.env.PGLITE_MODULE);const db=new PGlite();const q=v=>'"'+v.replaceAll('"','""')+'"';
 const findings=[];let passed=true;
 try{
  await db.exec('create schema auth;create schema storage;');
  for(const e of bundle.schema.enums)await db.exec(`create type ${q(e.schema)}.${q(e.name)} as enum (${e.values.map(v=>"'"+v.replaceAll("'","''")+"'").join(',')})`);
  const targets=new Set(files.filter(f=>f.eligible).flatMap(f=>f.targets));
  for(const name of targets){const cols=bundle.schema.columns.filter(c=>c.table_name===name);if(!cols.length){findings.push({path:name,passed:false,message:'Zieltabelle fehlt in LIVE. Abhängige Tabellen benötigen technische Prüfung.'});passed=false;continue;}await db.exec(`create table public.${q(name)} (${cols.map(c=>q(c.column_name)+' '+c.type).join(',')})`);}
  for(const file of files){
   if(blobSha(file.sql)!==file.sha)throw Error('SQL hash mismatch');
   if(!file.eligible){passed=false;findings.push({path:file.path,passed:false,message:file.reason});continue;}
   try{
    // Seed a synthetic row so new NOT NULL/default/check expressions are exercised.
    for(const name of file.targets){if(!bundle.schema.columns.some(c=>c.table_name===name))throw Error('LIVE-Zieltabelle fehlt');await db.exec(`truncate public.${q(name)};insert into public.${q(name)} default values;`);}
    await db.exec('begin;set local statement_timeout=10000;'+file.sql+';commit;');
    findings.push({path:file.path,passed:true,message:'Zusätzliche Spalten/Indizes geprüft; feste Vorgaben und Prüfregeln mit synthetischer Zeile getestet.'});
   }catch(e){await db.exec('rollback').catch(()=>{});passed=false;findings.push({path:file.path,passed:false,message:'Strukturprüfung fehlgeschlagen: '+String(e.message).slice(0,500)});}
  }
 }catch(e){passed=false;findings.push({path:'Strukturprüfung',passed:false,message:String(e.message).slice(0,500)});}finally{await db.close();}
 fs.mkdirSync('review-result',{recursive:true});fs.writeFileSync('review-result/report.json',JSON.stringify({schema_version:1,head,main,planDigest,migrations:bundle.migrations,runId:process.env.GITHUB_RUN_ID,createdAt:new Date().toISOString(),passed,findings}));
 console.log(passed?'Supported schema changes passed.':'Review blocked. See the German findings in the Manager.');
}else throw Error('Unknown review command');
