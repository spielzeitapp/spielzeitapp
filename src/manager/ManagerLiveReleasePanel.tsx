import { isStagingApp } from '../lib/appEnvironment';
import React, { useCallback, useEffect, useState } from 'react';
import { eventSaveTask } from '../lib/eventSaveTask';
import { supabase } from '../lib/supabaseClient';
type Plan={warnings?:string[];changedFiles?:number;comparisonComplete?:boolean;trafficLight?:'red'|'yellow'|'green';head?:string;main?:string;planDigest?:string;ready:boolean;blockers:string[];checks:{name:string;state:string}[];migrations:{path:string;reviewed:boolean}[];commits:{sha:string;message:string}[];totalCommits?:number;runs:{id:number;status:string;conclusion:string|null;url:string;title:string}[]};
async function api(method='GET',body?:unknown){
 const {data:{session}}=await eventSaveTask('Sitzung prüfen',supabase.auth.getSession(),8000);if(!session)throw new Error('Bitte erneut anmelden.');
 const response=await fetch('/api/release/manage',{method,signal:AbortSignal.timeout(25000),headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Veröffentlichung konnte nicht geprüft werden.');return result;
}
export function ManagerLiveReleasePanel(){
 const [plan,setPlan]=useState<Plan|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[requested,setRequested]=useState('');
 const isTest=isStagingApp()||(typeof window!=='undefined'&&window.location.hostname==='localhost');
 const refresh=useCallback(async()=>{setBusy(true);setConfirmed(false);try{setPlan(await api());setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}},[]);
 useEffect(()=>{if(isTest)void refresh();},[isTest,refresh]);
 const active=plan?.runs.some(r=>!r.conclusion&&r.status!=='completed');
 const tracking=!!requested&&!plan?.runs.some(r=>r.title.includes(requested)&&r.status==='completed');
 useEffect(()=>{if(!isTest||(!active&&!tracking))return;const id=setInterval(()=>void refresh(),15000);return()=>clearInterval(id);},[isTest,active,tracking,refresh]);
 if(!isTest)return null;
 const requestRun=plan?.runs.find(r=>requested&&r.title.includes(requested));
 const waiting=!!requested&&!requestRun;
 const warnings=plan?.warnings??[];
 const light=error||plan?.blockers.length?'red':warnings.length?'yellow':plan?.ready?'green':null;
 const lightLabel=light==='red'?'Gesperrt':light==='yellow'?'Bereit mit Hinweisen':light==='green'?'Bereit zur Veröffentlichung':'Noch nicht geprüft';
 async function publish(){if(!plan?.ready||!confirmed||busy||waiting)return;setBusy(true);setError('');try{
  const r=await api('POST',{head:plan.head,main:plan.main,planDigest:plan.planDigest});setRequested(r.requestId);setConfirmed(false);await refresh();
 }catch(e){setError(`${e instanceof Error?e.message:String(e)} Bitte zuerst den Verlauf aktualisieren, bevor du erneut startest.`);setConfirmed(false);}finally{setBusy(false);}}
 return <section className="manager-release-panel mx-4 my-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm md:mx-0 md:mb-7 md:mt-0 md:p-6" aria-label="LIVE-Veröffentlichung">
 <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold">LIVE-Veröffentlichung</h2><span role="status" className={`manager-release-status manager-release-status--${light??'neutral'}`}><span aria-hidden className="manager-release-status__dot"/>{busy?'Wird geprüft…':lightLabel}</span></div><button type="button" className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50 disabled:cursor-wait" disabled={busy} onClick={()=>void refresh()}>{busy?'Prüfe…':'Stand prüfen'}</button></div>
 <p className="text-sm">Übernimmt den geprüften Programmstand und technisch freigegebene Datenbankänderungen. TEST-Spieler, Testspiele und andere TEST-Inhalte werden nicht kopiert.</p>
 {plan?<><p className="text-sm">TEST: <strong>{plan.head?.slice(0,8)||'Verbindung fehlt'}</strong> · LIVE: <strong>{plan.main?.slice(0,8)||'noch nicht geprüft'}</strong></p>
 {plan.checks.map(c=><p className="text-sm" key={c.name}>{c.name}: {c.state==='success'?'erfolgreich':c.state==='pending'?'läuft':'noch nicht erfolgreich'}</p>)}
 <p className="text-xs text-slate-600">Grün: bereit · Gelb: Hinweise prüfen, Veröffentlichung möglich · Rot: zuerst Sperren beheben</p>
 {plan.blockers.length?<details className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-950"><summary className="cursor-pointer text-sm font-semibold">{plan.blockers.length} {plan.blockers.length===1?'Sperre beheben':'Sperren beheben'}</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{plan.blockers.map(x=><li key={x}>{x}</li>)}</ul></details>:null}
 {warnings.length?<details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"><summary className="cursor-pointer text-sm font-semibold">{warnings.length} {warnings.length===1?'Hinweis prüfen':'Hinweise prüfen'}</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{warnings.map(x=><li key={x}>{x}</li>)}</ul></details>:null}
 {plan.changedFiles!==undefined?<p className="text-sm text-slate-600">{plan.changedFiles} geänderte Dateien{plan.comparisonComplete===false?' · Vergleich unvollständig':' · Dateivergleich vollständig'}</p>:null}
 {plan.commits.length?<details><summary className="cursor-pointer font-semibold">Entwicklungsstände gegenüber LIVE ({plan.totalCommits??plan.commits.length})</summary><ul className="mt-2 max-h-60 space-y-2 overflow-auto text-sm">{plan.commits.map(c=><li key={c.sha}>{c.message}</li>)}</ul></details>:null}
 {plan.migrations.length?<details><summary className="cursor-pointer font-semibold">Datenbankänderungen ({plan.migrations.length})</summary><ul className="mt-2 max-h-48 space-y-2 overflow-auto break-all text-xs">{plan.migrations.map(m=><li key={m.path}>{m.reviewed?'Freigegeben':'Freigabe fehlt'}: {m.path.split('/').pop()}</li>)}</ul></details>:null}
 <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={!plan.ready||busy||waiting||!!error} onChange={e=>setConfirmed(e.target.checked)}/>Ich habe diesen TEST-Stand geprüft und möchte genau diese Version LIVE veröffentlichen.</label>
 <button type="button" className="min-h-11 rounded-xl border border-[rgb(var(--club-accent-rgb))] bg-[rgb(var(--club-primary-rgb))] px-4 font-bold text-[var(--club-on-primary)] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-600 disabled:opacity-100" disabled={!plan.ready||!confirmed||busy||waiting||!!error} onClick={()=>void publish()}>Geprüften Stand LIVE veröffentlichen</button>
 {waiting?<p role="status" className="text-sm">Veröffentlichung angefordert. Der Verlauf wird automatisch geprüft.</p>:null}
 {plan.runs.length?<div><h3 className="font-semibold">Veröffentlichungsverlauf</h3>{plan.runs.map(r=><p key={r.id} className="mt-2 text-sm"><a href={r.url} target="_blank" rel="noreferrer" className="underline">{r.title}</a><br/>{r.status!=='completed'?'In Bearbeitung':r.conclusion==='success'?'LIVE-Version bestätigt':`Nicht erfolgreich abgeschlossen (${r.conclusion??'unbekannt'}). LIVE-Stand prüfen.`}</p>)}</div>:null}
 </>:!error?<p role="status">Verbindung und Versionen werden geprüft…</p>:null}
 {error?<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>:null}
 </section>;
}
