import { isStagingApp } from '../lib/appEnvironment';
import React, { useCallback, useEffect, useState } from 'react';
import { eventSaveTask } from '../lib/eventSaveTask';
import { supabase } from '../lib/supabaseClient';
type Review={approval?:{title?:string;status:string;conclusion:string|null;url:string}|null;available:boolean;canStart?:boolean;canApprove?:boolean;runId?:number;url?:string;status?:string;message?:string;report?:{passed:boolean;findings:{path:string;passed:boolean;message:string}[]}};
type Plan={technicalReview?:Review;sameSource?:boolean;liveVerified?:boolean;warnings?:string[];changedFiles?:number;comparisonComplete?:boolean;trafficLight?:'red'|'yellow'|'green';head?:string;main?:string;planDigest?:string;ready:boolean;blockers:string[];checks:{name:string;state:string;label?:string;help?:string|null;detailsUrl?:string}[];migrations:{path:string;reviewed:boolean}[];functions?:{path:string;reviewed:boolean}[];commits:{sha:string;message:string}[];totalCommits?:number;runs:{id:number;status:string;conclusion:string|null;url:string;title:string}[]};
async function api(method='GET',body?:unknown){
 const {data:{session}}=await eventSaveTask('Sitzung prüfen',supabase.auth.getSession(),8000);if(!session)throw new Error('Bitte erneut anmelden.');
 const response=await fetch('/api/release/manage',{method,signal:AbortSignal.timeout(25000),headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Veröffentlichung konnte nicht geprüft werden.');return result;
}
export function ManagerLiveReleasePanel(){
 const [approvalRequested,setApprovalRequested]=useState(''),[approvalSource,setApprovalSource]=useState('');
 const [reviewNotice,setReviewNotice]=useState(''),[reviewRequested,setReviewRequested]=useState(false),[previousReview,setPreviousReview]=useState<number|undefined>(),[reviewConfirmed,setReviewConfirmed]=useState(false);
 const [plan,setPlan]=useState<Plan|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[requested,setRequested]=useState('');
 const isTest=isStagingApp()||(typeof window!=='undefined'&&window.location.hostname==='localhost');
 const refresh=useCallback(async()=>{setBusy(true);setConfirmed(false);setReviewConfirmed(false);try{setPlan(await api());setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}},[]);
 useEffect(()=>{if(isTest)void refresh();},[isTest,refresh]);
 const approvalRunning=!!approvalRequested||(plan?.technicalReview?.approval&&plan.technicalReview.approval.status!=='completed');
 useEffect(()=>{if(approvalRequested&&((plan?.head&&plan.head!==approvalSource)||(plan?.technicalReview?.approval?.title?.includes(approvalRequested)&&plan.technicalReview.approval.status==='completed')))setApprovalRequested('');},[approvalRequested,approvalSource,plan]);
 const reviewRunning=approvalRunning||(plan?.technicalReview?.status&&plan.technicalReview.status!=='completed');
 useEffect(()=>{if(reviewRequested&&plan?.technicalReview?.runId!==previousReview&&plan?.technicalReview?.status==='completed')setReviewRequested(false);},[reviewRequested,previousReview,plan]);
 const active=plan?.runs.some(r=>!r.conclusion&&r.status!=='completed');
 const tracking=!!requested&&!plan?.runs.some(r=>r.title.includes(requested)&&r.status==='completed');
 useEffect(()=>{if(!isTest||(!active&&!tracking&&!reviewRunning&&!reviewRequested))return;const id=setInterval(()=>void refresh(),15000);return()=>clearInterval(id);},[isTest,active,tracking,reviewRunning,reviewRequested,refresh]);
 if(!isTest)return null;
 const requestRun=plan?.runs.find(r=>requested&&r.title.includes(requested));
 const waiting=!!requested&&!requestRun;
 const sameSource=plan?.sameSource===true;
 const publishing=!!active||waiting;
 const blockers=(plan?.blockers??[]).filter(message=>!(sameSource&&message==='LIVE enthält diesen Stand bereits.')&&!(publishing&&message==='Eine Veröffentlichung läuft bereits.'));
 const current=sameSource&&plan?.liveVerified===true&&!publishing&&!blockers.length&&!error;
 const pending=sameSource&&!current&&!blockers.length&&!error;
 const warnings=current?[]:plan?.warnings??[];
 const light=error||blockers.length?'red':publishing||pending?null:current?'green':warnings.length?'yellow':plan?.ready?'green':null;
 const lightLabel=current?'LIVE ist aktuell':publishing?'Veröffentlichung läuft':pending?'LIVE-Bestätigung ausstehend':light==='red'?'Gesperrt':light==='yellow'?'Bereit mit Hinweisen':light==='green'?'Bereit zur Veröffentlichung':'Noch nicht geprüft';
 async function publish(){if(!plan?.ready||!confirmed||busy||waiting)return;setBusy(true);setError('');try{
  const r=await api('POST',{head:plan.head,main:plan.main,planDigest:plan.planDigest});setRequested(r.requestId);setConfirmed(false);await refresh();
 }catch(e){setError(`${e instanceof Error?e.message:String(e)} Bitte zuerst den Verlauf aktualisieren, bevor du erneut startest.`);setConfirmed(false);}finally{setBusy(false);}}
 async function reviewAction(action:'review'|'approve'){
  if(!plan||busy||(action==='approve'&&!reviewConfirmed))return;
  setBusy(true);setError('');setReviewConfirmed(false);
  try{const r=await api('POST',{action,head:plan.head,main:plan.main,planDigest:plan.planDigest,...(action==='approve'?{runId:plan.technicalReview?.runId}:{})});setReviewNotice(r.message);if(action==='approve'){setApprovalSource(plan.head??'');setApprovalRequested(r.requestId);}
   if(action==='review'){setPreviousReview(plan.technicalReview?.runId);setReviewRequested(true);}await refresh();}
  catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 return <section className="manager-release-panel mx-4 my-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm md:mx-0 md:mb-7 md:mt-0 md:p-6" aria-label="LIVE-Veröffentlichung">
 <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold">LIVE-Veröffentlichung</h2><span role="status" className={`manager-release-status manager-release-status--${light??'neutral'}`}><span aria-hidden className="manager-release-status__dot"/>{busy?'Wird geprüft…':lightLabel}</span></div><button type="button" className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50 disabled:cursor-wait" disabled={busy} onClick={()=>void refresh()}>{busy?'Prüfe…':'Stand prüfen'}</button></div>
 <p className="text-sm">Übernimmt den geprüften Programmstand und technisch freigegebene Datenbankänderungen. TEST-Spieler, Testspiele und andere TEST-Inhalte werden nicht kopiert.</p>
 {plan?<><p className="text-sm">TEST: <strong>{plan.head?.slice(0,8)||'Verbindung fehlt'}</strong> · LIVE: <strong>{plan.main?.slice(0,8)||'noch nicht geprüft'}</strong></p>
 {plan.checks.map(c=><div className="text-sm" key={c.name}><p><strong>{c.name}</strong>: {c.label??(c.state==='success'?'Prüfung erfolgreich':c.state==='pending'?'Prüfung läuft':'Prüfung noch nicht erfolgreich')}</p>{c.help?<p className="mt-1 max-w-3xl text-slate-600">{c.help}</p>:null}{c.detailsUrl?<a className="mt-1 inline-block underline" href={c.detailsUrl} target="_blank" rel="noreferrer">Ursache bei Vercel ansehen ↗</a>:null}</div>)}
 <p className="text-xs text-slate-600">Grün: aktuell oder bereit · Gelb: Hinweise prüfen, Veröffentlichung möglich · Rot: zuerst Sperren beheben</p>
 {current?<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><p className="font-semibold">TEST und LIVE haben denselben Programmstand.</p><p className="mt-1 text-sm">Es gibt nichts zu veröffentlichen. Du musst nichts aktualisieren.</p></div>:pending&&!publishing?<p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">Der Programmstand stimmt überein. Die erreichbare LIVE-Version ist noch nicht bestätigt. Bitte erneut „Stand prüfen“.</p>:null}
 {!sameSource&&plan.ready?<p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">Neue Programmänderungen stehen zur Veröffentlichung bereit.</p>:null}
 {blockers.length?<details className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-950"><summary className="cursor-pointer text-sm font-semibold">{blockers.length} {blockers.length===1?'Sperre beheben':'Sperren beheben'}</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{blockers.map(x=><li key={x}>{x}</li>)}</ul></details>:null}
 {plan.migrations.some(m=>!m.reviewed)?<div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Technische Prüfung">
  <h3 className="font-semibold">Datenbankänderungen im Manager prüfen und freigeben</h3>
  <p className="text-sm">1. Technische Prüfung starten. 2. Prüfbericht ansehen und bestätigen. 3. Freigeben. Die Prüfung verändert LIVE nicht.</p>
  <p className="text-xs text-slate-600">Automatisch prüfbar sind zusätzliche einfache Spalten und Indizes. Rechteänderungen, Funktionen, Datenänderungen und Löschungen brauchen eine gesonderte technische Prüfung. Es werden leere Tabellen mit LIVE-Struktur und synthetische Daten verwendet, keine echten LIVE-Inhalte. Die Prüfung ersetzt keinen vollständigen Funktionstest.</p>
  {!plan.technicalReview?.available?<p className="text-sm">{plan.technicalReview?.message??'Technische Prüfung wird eingerichtet.'}</p>:null}
  <button type="button" className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 disabled:opacity-50" disabled={busy||!!reviewRunning||reviewRequested||!plan.technicalReview?.canStart} onClick={()=>void reviewAction('review')}>{reviewRunning||reviewRequested?'Technische Prüfung läuft…':'Technische Prüfung starten'}</button>
  {reviewNotice?<p role="status" className="text-sm">{reviewNotice}</p>:null}
  {plan.technicalReview?.url?<a className="ml-3 text-sm underline" href={plan.technicalReview.url} target="_blank" rel="noreferrer">Prüfablauf ansehen ↗</a>:null}
  {plan.technicalReview?.report?<div className="space-y-2"><p className="font-semibold">{plan.technicalReview.canApprove?'Prüfung bestanden – Freigabe möglich':'Noch nicht freigabefähig'}</p><ul className="space-y-2 text-sm">{plan.technicalReview.report.findings.map((f,i)=><li key={i}><strong>{f.passed?'Bestanden':'Prüfung nötig'}: {f.path.split('/').pop()}</strong><br/>{f.message}</li>)}</ul></div>:null}
  {plan.technicalReview?.message?<p className="text-sm">{plan.technicalReview.message}</p>:null}
  {plan.technicalReview?.approval?.conclusion==='failure'?<p role="alert" className="text-sm text-red-800">Freigabe konnte nicht gespeichert werden. Bitte den Prüfablauf ansehen und erneut „Stand prüfen“ drücken.</p>:null}
  {plan.technicalReview?.canApprove&&!reviewRequested&&!approvalRunning?<><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewConfirmed} disabled={busy} onChange={e=>setReviewConfirmed(e.target.checked)}/>Ich habe den Prüfbericht und die Änderungen geprüft und gebe genau diesen Stand frei.</label><button type="button" className="min-h-11 rounded-xl bg-emerald-700 px-4 font-semibold text-white disabled:bg-slate-200 disabled:text-slate-600" disabled={busy||!reviewConfirmed} onClick={()=>void reviewAction('approve')}>Geprüfte Datenbankänderungen freigeben</button></>:null}
 </div>:null}
 {warnings.length?<details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"><summary className="cursor-pointer text-sm font-semibold">{warnings.length} {warnings.length===1?'Hinweis prüfen':'Hinweise prüfen'}</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{warnings.map(x=><li key={x}>{x}</li>)}</ul></details>:null}
 {plan.changedFiles!==undefined?<p className="text-sm text-slate-600">{plan.changedFiles} geänderte Dateien{plan.comparisonComplete===false?' · Vergleich unvollständig':' · Dateivergleich vollständig'}</p>:null}
 {plan.commits.length?<details><summary className="cursor-pointer font-semibold">Entwicklungsstände gegenüber LIVE ({plan.totalCommits??plan.commits.length})</summary><ul className="mt-2 max-h-60 space-y-2 overflow-auto text-sm">{plan.commits.map(c=><li key={c.sha}>{c.message}</li>)}</ul></details>:null}
 {plan.migrations.length?<details><summary className="cursor-pointer font-semibold">Datenbankänderungen ({plan.migrations.length})</summary><ul className="mt-2 max-h-48 space-y-2 overflow-auto break-all text-xs">{plan.migrations.map(m=><li key={m.path}>{m.reviewed?'Freigegeben':'Freigabe fehlt'}: {m.path.split('/').pop()}</li>)}</ul></details>:null}
 {(plan.functions??[]).length?<details><summary className="cursor-pointer font-semibold">Serverfunktionen ({plan.functions?.length})</summary><ul className="mt-2 space-y-2 text-xs">{plan.functions?.map(f=><li key={f.path}>{f.reviewed?'Freigegeben':'Freigabe fehlt'}: {f.path.split('/')[2]}</li>)}</ul><p className="mt-2 text-xs text-slate-600">Werden nach den Datenbankänderungen mit geschütztem Zugriff bereitgestellt.</p></details>:null}
 {!sameSource?<label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={!plan.ready||busy||waiting||!!error} onChange={e=>setConfirmed(e.target.checked)}/>Ich habe diesen TEST-Stand geprüft und möchte genau diese Version LIVE veröffentlichen.</label>:null}
 <button type="button" className="min-h-11 rounded-xl border border-[rgb(var(--club-accent-rgb))] bg-[rgb(var(--club-primary-rgb))] px-4 font-bold text-[var(--club-on-primary)] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100" disabled={sameSource||!plan.ready||!confirmed||busy||waiting||!!error} onClick={()=>void publish()}>{current?'LIVE ist aktuell':sameSource?'LIVE-Bestätigung ausstehend':'Geprüften Stand LIVE veröffentlichen'}</button>
 {waiting?<p role="status" className="text-sm">Veröffentlichung angefordert. Der Verlauf wird automatisch geprüft.</p>:null}
 {plan.runs.length?<div><h3 className="font-semibold">Veröffentlichungsverlauf</h3>{plan.runs.map(r=><p key={r.id} className="mt-2 text-sm"><a href={r.url} target="_blank" rel="noreferrer" className="underline">{r.title}</a><br/>{r.status!=='completed'?'In Bearbeitung':r.conclusion==='success'?'LIVE-Version bestätigt':`Nicht erfolgreich abgeschlossen (${r.conclusion??'unbekannt'}). LIVE-Stand prüfen.`}</p>)}</div>:null}
 </>:!error?<p role="status">Verbindung und Versionen werden geprüft…</p>:null}
 {error?<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>:null}
 </section>;
}
