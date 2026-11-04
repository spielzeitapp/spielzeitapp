const { BASELINE_PATH, validateBaseline, functionApproval, DENIED_VERSIONS } = require('./releaseDatabase');
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
// GitHub's compare endpoint caps files at 300. Compare complete trees instead
// of either hiding remaining files or rejecting a large, verifiable release.
async function completeFileDiff(gh, main, head) {
 const [before, after] = await Promise.all([
  gh(`/git/trees/${main}?recursive=1`), gh(`/git/trees/${head}?recursive=1`),
 ]);
 if (before.truncated || after.truncated || !Array.isArray(before.tree) || !Array.isArray(after.tree)) {
  return null;
 }
 const files = tree => new Map(tree.filter(x => x.type === 'blob').map(x => [x.path, x]));
 const oldFiles = files(before.tree), newFiles = files(after.tree);
 return [...new Set([...oldFiles.keys(), ...newFiles.keys()])].sort().flatMap(filename => {
  const old = oldFiles.get(filename), current = newFiles.get(filename);
  if (old?.sha === current?.sha && old?.mode === current?.mode) return [];
  return [{filename, sha: (current ?? old).sha, status: !old ? 'added' : !current ? 'removed' : 'modified'}];
 });
}
async function releasePlan(gh, options = {}) {
 const [test,live]=await Promise.all([gh('/git/ref/heads/develop'),gh('/git/ref/heads/main')]);
 const head=test.object.sha,main=live.object.sha;
 if(!isSha(head)||!isSha(main))throw new Error('Ungültiger Versionsstand.');
 const [comparison,statuses,manifest]=await Promise.all([gh(`/compare/${main}...${head}`),gh(`/commits/${head}/status`),gh(`/contents/release/live-plan.json?ref=${head}`).then(x=>JSON.parse(Buffer.from(x.content,'base64').toString())).catch(e=>{if(e.status===404)return null;throw e;})]);
 const blockers=[],warnings=[];if(!manifest||manifest.schema_version!==1||!manifest.migrations||typeof manifest.migrations!=='object'||Array.isArray(manifest.migrations))blockers.push('Technischer Veröffentlichungsplan fehlt oder ist ungültig.');
 if(!['ahead','identical'].includes(comparison.status))blockers.push('LIVE und TEST sind auseinander gelaufen. Zuerst zusammenführen und erneut testen.');
 if(head===main)blockers.push('LIVE enthält diesen Stand bereits.');
 let files=comparison.files??[],comparisonComplete=true;
 if(files.length>=300){
  const complete=await completeFileDiff(gh,main,head);
  if(complete)files=complete;
  else {comparisonComplete=false;blockers.push('Der vollständige Dateivergleich ist nicht verfügbar. Veröffentlichung zuerst technisch prüfen.');}
 }
 if(comparisonComplete&&files.length>=100)warnings.push(`Größere Aktualisierung: ${files.length} geänderte Dateien. Bitte die Änderungen besonders sorgfältig prüfen.`);
 const functions=files.filter(f=>f.filename.startsWith('supabase/functions/')).map(f=>({path:f.filename,sha:f.sha,reviewed:functionApproval(f,manifest)}));
 if(functions.some(f=>!f.reviewed))blockers.push('Geänderte Supabase-Serverfunktionen benötigen noch eine technische Freigabe.');
 if(files.some(f=>f.filename.startsWith('.github/workflows/')||['scripts/release/publish-live.mjs','server/lib/liveRelease.js','server/lib/releaseDatabase.js','server/lib/releasePublisher.js',BASELINE_PATH].includes(f.filename)))blockers.push('Änderungen am Veröffentlichungsablauf müssen vorab separat eingerichtet und geprüft werden.');
 const checks=REQUIRED_CHECKS.map(context=>({name:context,state:statuses.statuses?.find(s=>s.context===context)?.state??'missing'}));
 if(checks.some(c=>c.state!=='success'))blockers.push('Die Bereitstellungsprüfungen für den angezeigten TEST-Stand sind noch nicht erfolgreich.');
 const migrations=files.filter(f=>f.filename.startsWith('supabase/migrations/')&&f.filename.endsWith('.sql')).map(f=>({path:f.filename,sha:f.sha,reviewed:f.status==='added'&&manifest?.schema_version===1&&manifest.migrations?.[f.filename]===f.sha}));
 if(migrations.some(m=>DENIED_VERSIONS.has(m.path.split('/').pop().split('_')[0])))blockers.push('Ausgeschlossene historische Rollenänderungen dürfen nicht veröffentlicht werden.');
 if(migrations.some(m=>!m.reviewed))blockers.push('Datenbankänderungen benötigen noch eine technische Freigabe.');
 let baseline=null;
 try {const file=await gh(`/contents/${BASELINE_PATH}?ref=${main}`);baseline=validateBaseline(JSON.parse(Buffer.from(file.content,'base64').toString()));}catch(e){if(e.status&&e.status!==404)throw e;blockers.push('Die geprüfte Ausgangsbasis der LIVE-Datenbank muss zuerst eingerichtet werden.');}
 let workflowReady=true,runs=[];
 try {const w=await gh(`/actions/workflows/${WORKFLOW}`);workflowReady=w.state==='active';if(workflowReady)runs=(await gh(`/actions/workflows/${WORKFLOW}/runs?per_page=10`)).workflow_runs??[];}catch(e){if(e.status===404)workflowReady=false;else throw e;}
 if(!workflowReady)blockers.push('Einmalige Einrichtung: Veröffentlichungsablauf muss im LIVE-Zweig installiert und aktiviert sein.');
 if(runs.some(r=>String(r.id)!==String(options.ignoreRunId??'')&&['queued','in_progress','waiting','pending','requested'].includes(r.status)))blockers.push('Eine Veröffentlichung läuft bereits.');
 const snapshot={head,main,migrations:migrations.map(m=>({path:m.path,sha:m.sha})),manifest,baseline};
 return {head,main,planDigest:digest(snapshot),ready:blockers.length===0,trafficLight:blockers.length?'red':warnings.length?'yellow':'green',warnings,changedFiles:files.length,comparisonComplete,blockers,checks,migrations,functions,commits:(comparison.commits??[]).map(c=>({sha:c.sha,message:c.commit.message.split('\n')[0]})),totalCommits:comparison.ahead_by??0,runs:runs.slice(0,5).map(r=>({id:r.id,status:r.status,conclusion:r.conclusion,url:r.html_url,title:r.display_title}))};
}
module.exports={REPO,WORKFLOW,REQUIRED_CHECKS,isSha,digest,github,releasePlan};
