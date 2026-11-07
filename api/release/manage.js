import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import release from '../../server/lib/liveRelease.js';
import checkDisplay from '../../server/lib/releaseCheckPresentation.js';
import technical from '../../server/lib/technicalReview.js';
import artifacts from '../../server/lib/reviewArtifact.js';
const TEST_PROJECT='acbaecjzoabafbsjrzvr';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'&&req.query?.view==='version')return res.status(200).json({sha:process.env.VERCEL_GIT_COMMIT_SHA??null,branch:process.env.VERCEL_GIT_COMMIT_REF??null});
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Methode nicht erlaubt.'});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(url?.replace(/\/$/,'')!==`https://${TEST_PROJECT}.supabase.co`||!key)return res.status(403).json({error:'Veröffentlichungen sind nur aus der TEST-Verwaltung möglich.'});
 const bearer=String(req.headers.authorization??'').match(/^Bearer ([^\s]+)$/)?.[1];
 if(!bearer)return res.status(401).json({error:'Bitte anmelden.'});
 try {
  const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error}=await db.auth.getUser(bearer);
  if(error||!user)return res.status(401).json({error:'Sitzung abgelaufen.'});
  const {data:role,error:roleError}=await db.from('user_roles').select('role').eq('user_id',user.id).maybeSingle();
  if(roleError||role?.role!=='admin')return res.status(403).json({error:'Nur für Plattformadmins.'});
  const token=process.env.RELEASE_GITHUB_TOKEN;
  if(!token){if(req.method==='POST')return res.status(503).json({error:'Veröffentlichungsverbindung ist noch nicht eingerichtet.'});return res.json({ready:false,blockers:['Einmalige Einrichtung: geschützte Veröffentlichungsverbindung fehlt.'],checks:[],commits:[],migrations:[],runs:[]});}
  const gh=(path,options)=>release.github(token,path,options);
  const plan=await release.releasePlan(gh);
  const sameSource=plan.head===plan.main||(plan.comparisonComplete===true&&plan.changedFiles===0);
  if(req.method==='GET'){
   let liveVerified=false;
   let checks=plan.checks.map(c=>checkDisplay.checkPresentation(c));
   if(plan.checks.some(c=>c.state!=='success')){try{
    const statuses=await gh(`/commits/${plan.head}/status`);
    checks=plan.checks.map(c=>checkDisplay.checkPresentation(c,statuses.statuses?.find(s=>s.context===c.name&&s.state===c.state)));
   }catch{/* Keep the original release decision and show a generic explanation. */}}
   if(sameSource){try{
    const response=await fetch(`https://spielzeitapp.at/api/release/manage?view=version&t=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(response.ok){const version=await response.json();liveVerified=version.sha===plan.main&&version.branch==='main';}
   }catch{}}
   const technicalReview=await technical.reviewState(gh,plan,id=>artifacts.downloadReport(token,id));
   return res.json({...plan,technicalReview,checks,ready:plan.ready&&!sameSource,sameSource,liveVerified});
  }
  if(sameSource)return res.status(409).json({error:'TEST und LIVE haben bereits denselben Programmstand. Es gibt nichts zu veröffentlichen.'});
  if(process.env.VERCEL_GIT_COMMIT_REF!=='develop')return res.status(403).json({error:'Nur der bereitgestellte TEST-Stand auf develop darf veröffentlichen.'});
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(['review','approve'].includes(body?.action)){
   try {
    technical.assertSnapshot(plan,body);
    const workflow=await gh(`/actions/workflows/${technical.WORKFLOW}`);
    if(workflow.state!=='active')throw Error('Technische Prüfung ist noch nicht eingerichtet.');
    const running=await gh(`/actions/workflows/${technical.WORKFLOW}/runs?per_page=10`);
    if(running.workflow_runs?.some(r=>r.status!=='completed'))throw Error('Eine technische Prüfung läuft bereits. Bitte warten.');
    const requestId=randomUUID();
    if(body.action==='approve'){
     if(!Number.isSafeInteger(body.runId)||body.runId<1)throw Error('Ungültige Prüfnummer.');
     const run=await gh(`/actions/runs/${body.runId}`);
     const report=await technical.readReport(gh,run,id=>artifacts.downloadReport(token,id));technical.assertReport(plan,run,report);
    }
    await gh(`/actions/workflows/${technical.WORKFLOW}/dispatches`,{method:'POST',body:JSON.stringify({ref:'main',inputs:{head:plan.head,main:plan.main,plan_digest:plan.planDigest,request_id:requestId,mode:body.action==='approve'?'approve':'check',review_run_id:body.action==='approve'?String(body.runId):'',actor:user.id}})});
    return res.status(202).json({requestId,message:body.action==='approve'?'Freigabe angefordert. Danach wird TEST neu bereitgestellt. Bitte warten und erneut prüfen.':'Technische Prüfung gestartet. LIVE wird dabei nicht verändert.'});
   }catch(e){return res.status(409).json({error:e.message});}
  }
  if(body?.action)return res.status(400).json({error:'Unbekannte Aktion.'});
  if(!plan.ready||body?.head!==plan.head||body?.main!==plan.main||body?.planDigest!==plan.planDigest)return res.status(409).json({error:'Freigabestand geändert oder noch nicht bereit. Bitte erneut prüfen.',plan});
  const requestId=randomUUID();
  await gh(`/actions/workflows/${release.WORKFLOW}/dispatches`,{method:'POST',body:JSON.stringify({ref:'main',inputs:{head:plan.head,main:plan.main,plan_digest:plan.planDigest,actor:user.id,request_id:requestId}})});
  return res.status(202).json({requestId,message:'Veröffentlichung angefordert. Der Ablauf prüft den Stand nochmals vor jeder Übernahme.'});
 }catch(e){console.error('[live-release]',e.message);return res.status(502).json({error:'Veröffentlichung konnte nicht sicher geprüft werden. Bitte erneut prüfen; bei unklarem Versandstatus zuerst den Verlauf ansehen.'});}
}
