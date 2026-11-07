const {isSha,digest}=require('./liveRelease');
const {DENIED_VERSIONS}=require('./releaseDatabase');
const WORKFLOW='review-live-schema.yml';
const DB_BLOCK='Datenbankänderungen benötigen noch eine technische Freigabe.';
function canReview(plan){return plan.comparisonComplete===true&&plan.head!==plan.main&&plan.migrations.some(m=>!m.reviewed)&&plan.blockers.every(b=>b===DB_BLOCK);}
function snapshot(plan){return {head:plan.head,main:plan.main,planDigest:plan.planDigest,migrations:plan.migrations.map(m=>({path:m.path,sha:m.sha,reviewed:m.reviewed}))};}
function assertSnapshot(plan,body){if(!canReview(plan)||body?.head!==plan.head||body?.main!==plan.main||body?.planDigest!==plan.planDigest)throw Error('Stand geändert oder andere Sperren offen. Bitte erneut „Stand prüfen“.');}
function assertReport(plan,run,report){
 if(!run||run.event!=='workflow_dispatch'||run.head_branch!=='main'||run.head_sha!==plan.main||run.path!==`.github/workflows/${WORKFLOW}`||run.status!=='completed'||run.conclusion!=='success')throw Error('Die technische Prüfung ist nicht erfolgreich abgeschlossen.');
 if(report?.schema_version!==1||report.passed!==true||String(report.runId)!==String(run.id)||report.head!==plan.head||report.main!==plan.main||report.planDigest!==plan.planDigest||digest(report.migrations)!==digest(snapshot(plan).migrations))throw Error('Prüfbericht gehört nicht mehr zu diesem Stand. Bitte neu prüfen.');
 const age=Date.now()-Date.parse(report.createdAt);if(!Number.isFinite(age)||age<0||age>60*60*1000)throw Error('Prüfbericht ist abgelaufen. Bitte technische Prüfung neu starten.');
 for(const m of report.migrations)if(!/^supabase\/migrations\/\d{14}_[^/]+\.sql$/.test(m.path)||!isSha(m.sha)||DENIED_VERSIONS.has(m.path.split('/').pop().split('_')[0]))throw Error('Ungültige Migration im Prüfbericht.');
}
async function readReport(gh,run,download){
 const result=await gh(`/actions/runs/${run.id}/artifacts?per_page=100`);
 const artifacts=result.artifacts?.filter(a=>a.name==='technical-review'&&!a.expired)??[];
 if(artifacts.length!==1||artifacts[0].size_in_bytes>512000)throw Error('Prüfbericht fehlt oder ist zu groß. Bitte neu prüfen.');
 return download(artifacts[0].id);
}
async function reviewState(gh,plan,download){
 try{
  const workflow=await gh(`/actions/workflows/${WORKFLOW}`);if(workflow.state!=='active')return {available:false};
  const result=await gh(`/actions/workflows/${WORKFLOW}/runs?per_page=25`);
  const approval=result.workflow_runs?.find(r=>r.event==='workflow_dispatch'&&r.head_sha===plan.main&&r.display_title?.startsWith(`SCHEMA-APPROVAL ${plan.head} ${plan.main} `));
  const prefix=`SCHEMA ${plan.head} ${plan.main} `;
  const run=result.workflow_runs?.find(r=>r.event==='workflow_dispatch'&&r.head_sha===plan.main&&r.head_branch==='main'&&r.display_title?.startsWith(prefix));
  if(!run)return {available:true,canStart:canReview(plan)};
  const view={approval:approval?{title:approval.display_title,status:approval.status,conclusion:approval.conclusion,url:approval.html_url}:null,available:true,canStart:canReview(plan),runId:run.id,url:run.html_url,status:run.status,conclusion:run.conclusion,canApprove:false};
  if(run.status==='completed'){
   try{const report=await readReport(gh,run,download);view.report={passed:report.passed,findings:report.findings,createdAt:report.createdAt};assertReport(plan,run,report);view.canApprove=canReview(plan);}
   catch(e){view.message=e.message;}
  }
  return view;
 }catch(e){return {available:false,message:e.status===404?'Technische Prüfung muss einmalig eingerichtet werden.':'Prüfstatus konnte nicht geladen werden. Bitte erneut prüfen.'};}
}
async function approve(gh,plan,body,actor,download){
 assertSnapshot(plan,body);
 if(!Number.isSafeInteger(body.runId)||body.runId<1)throw Error('Ungültige Prüfnummer.');
 const run=await gh(`/actions/runs/${body.runId}`);const report=await readReport(gh,run,download);assertReport(plan,run,report);
 const file=await gh(`/contents/release/live-plan.json?ref=${plan.head}`);const manifest=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
 for(const m of plan.migrations.filter(m=>!m.reviewed))manifest.migrations[m.path]=m.sha;
 const audit={schema_version:1,head:plan.head,main:plan.main,planDigest:plan.planDigest,runId:run.id,actor,approvedAt:new Date().toISOString(),migrations:report.migrations};
 const commit=await gh(`/git/commits/${plan.head}`);
 const tree=await gh('/git/trees',{method:'POST',body:JSON.stringify({base_tree:commit.tree.sha,tree:[{path:'release/live-plan.json',mode:'100644',type:'blob',content:JSON.stringify(manifest,null,2)+'\n'},{path:`release/reviews/${plan.head}.json`,mode:'100644',type:'blob',content:JSON.stringify(audit,null,2)+'\n'}]})});
 const next=await gh('/git/commits',{method:'POST',body:JSON.stringify({message:`Approve tested schema from Manager (${plan.head.slice(0,8)})`,tree:tree.sha,parents:[plan.head]})});
 // Recheck both refs immediately before the non-force update. A concurrent develop
 // update also makes this single-parent commit non-fast-forward and GitHub rejects it.
 const [test,live]=await Promise.all([gh('/git/ref/heads/develop'),gh('/git/ref/heads/main')]);
 if(test.object.sha!==plan.head||live.object.sha!==plan.main)throw Error('TEST oder LIVE wurde inzwischen geändert. Bitte neu prüfen.');
 await gh('/git/refs/heads/develop',{method:'PATCH',body:JSON.stringify({sha:next.sha,force:false})});
 return {commit:next.sha,message:'Freigabe gespeichert. TEST wird neu bereitgestellt. Danach „Stand prüfen“ drücken.'};
}
module.exports={WORKFLOW,canReview,snapshot,assertSnapshot,assertReport,readReport,reviewState,approve};
