const { createHash } = require('node:crypto');
const REPO = 'spielzeitapp/spielzeitapp';
const WORKFLOW = 'publish-live.yml';
const REQUIRED_CHECKS = ['Vercel – spielzeitapp', 'Vercel – spielzeitapp-intern'];
function isSha(value) { return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value); }
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
async function github(token, path, options = {}) {
 const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, { ...options, signal: AbortSignal.timeout(15000), headers: { Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...options.headers } });
 if (!response.ok) { const error=new Error(`GitHub-Verbindung fehlgeschlagen (${response.status}).`);error.status=response.status;throw error; }
 return response.status===204?null:response.json();
}
async function releasePlan(gh, options = {}) {
 const [test,live]=await Promise.all([gh('/git/ref/heads/develop'),gh('/git/ref/heads/main')]);
 const head=test.object.sha,main=live.object.sha;
 if(!isSha(head)||!isSha(main))throw new Error('Ungültiger Versionsstand.');
 const [comparison,statuses,manifest]=await Promise.all([gh(`/compare/${main}...${head}`),gh(`/commits/${head}/status`),gh(`/contents/release/live-plan.json?ref=${head}`).then(x=>JSON.parse(Buffer.from(x.content,'base64').toString())).catch(e=>{if(e.status===404)return null;throw e;})]);
 const blockers=[];if(!manifest||manifest.schema_version!==1||!manifest.migrations||typeof manifest.migrations!=='object'||Array.isArray(manifest.migrations))blockers.push('Technischer Veröffentlichungsplan fehlt oder ist ungültig.');
 if(!['ahead','identical'].includes(comparison.status))blockers.push('LIVE und TEST sind auseinander gelaufen. Zuerst zusammenführen und erneut testen.');
 if(head===main)blockers.push('LIVE enthält diesen Stand bereits.');
 if((comparison.files??[]).length>=300)blockers.push('Zu viele Änderungen für eine sichere automatische Übersicht. Veröffentlichung zuerst vorbereiten.');
 const checks=REQUIRED_CHECKS.map(context=>({name:context,state:statuses.statuses?.find(s=>s.context===context)?.state??'missing'}));
 if(checks.some(c=>c.state!=='success'))blockers.push('Die Bereitstellungsprüfungen für den angezeigten TEST-Stand sind noch nicht erfolgreich.');
 const migrations=(comparison.files??[]).filter(f=>f.filename.startsWith('supabase/migrations/')&&f.filename.endsWith('.sql')).map(f=>({path:f.filename,sha:f.sha,reviewed:f.status==='added'&&manifest?.schema_version===1&&manifest.migrations?.[f.filename]===f.sha}));
 if(migrations.some(m=>!m.reviewed))blockers.push('Datenbankänderungen benötigen noch eine technische Freigabe.');
 let workflowReady=true,runs=[];
 try {const w=await gh(`/actions/workflows/${WORKFLOW}`);workflowReady=w.state==='active';if(workflowReady)runs=(await gh(`/actions/workflows/${WORKFLOW}/runs?per_page=10`)).workflow_runs??[];}catch(e){if(e.status===404)workflowReady=false;else throw e;}
 if(!workflowReady)blockers.push('Einmalige Einrichtung: Veröffentlichungsablauf muss im LIVE-Zweig installiert und aktiviert sein.');
 if(runs.some(r=>String(r.id)!==String(options.ignoreRunId??'')&&['queued','in_progress','waiting','pending','requested'].includes(r.status)))blockers.push('Eine Veröffentlichung läuft bereits.');
 const snapshot={head,main,migrations:migrations.map(m=>({path:m.path,sha:m.sha})),manifest};
 return {head,main,planDigest:digest(snapshot),ready:blockers.length===0,blockers,checks,migrations,commits:(comparison.commits??[]).map(c=>({sha:c.sha,message:c.commit.message.split('\n')[0]})),totalCommits:comparison.ahead_by??0,runs:runs.slice(0,5).map(r=>({id:r.id,status:r.status,conclusion:r.conclusion,url:r.html_url,title:r.display_title}))};
}
module.exports={REPO,WORKFLOW,REQUIRED_CHECKS,isSha,digest,github,releasePlan};
