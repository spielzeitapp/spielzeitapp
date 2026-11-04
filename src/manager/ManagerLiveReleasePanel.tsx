import React, { useCallback, useEffect, useState } from 'react';
import { eventSaveTask } from '../lib/eventSaveTask';
import { supabase } from '../lib/supabaseClient';
type Plan={head?:string;main?:string;planDigest?:string;ready:boolean;blockers:string[];checks:{name:string;state:string}[];migrations:{path:string;reviewed:boolean}[];commits:{sha:string;message:string}[];totalCommits?:number;runs:{id:number;status:string;conclusion:string|null;url:string;title:string}[]};
async function api(method='GET',body?:unknown){
 const {data:{session}}=await eventSaveTask('Sitzung prüfen',supabase.auth.getSession(),8000);if(!session)throw new Error('Bitte erneut anmelden.');
 const response=await fetch('/api/release/manage',{method,signal:AbortSignal.timeout(25000),headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Veröffentlichung konnte nicht geprüft werden.');return result;
}
export function ManagerLiveReleasePanel(){
 const [plan,setPlan]=useState<Plan|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[requested,setRequested]=useState('');
 const isTest=String(import.meta.env?.VITE_SUPABASE_URL??'').includes('acbaecjzoabafbsjrzvr')||(typeof window!=='undefined'&&['app.spielzeitapp.at','localhost'].includes(window.location.hostname));
 const refresh=useCallback(async()=>{setBusy(true);setConfirmed(false);try{setPlan(await api());setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}},[]);
 useEffect(()=>{if(isTest)void refresh();},[isTest,refresh]);
 const active=plan?.runs.some(r=>!r.conclusion&&r.status!=='completed');
 const tracking=!!requested&&!plan?.runs.some(r=>r.title.includes(requested)&&r.status==='completed');
 useEffect(()=>{if(!isTest||(!active&&!tracking))return;const id=setInterval(()=>void refresh(),15000);return()=>clearInterval(id);},[isTest,active,tracking,refresh]);
 if(!isTest)return null;
 const requestRun=plan?.runs.find(r=>requested&&r.title.includes(requested));
 const waiting=!!requested&&!requestRun;
 async function publish(){if(!plan?.ready||!confirmed||busy||waiting)return;setBusy(true);setError('');try{
  const r=await api('POST',{head:plan.head,main:plan.main,planDigest:plan.planDigest});setRequested(r.requestId);setConfirmed(false);await refresh();
 }catch(e){setError(`${e instanceof Error?e.message:String(e)} Bitte zuerst den Verlauf aktualisieren, bevor du erneut startest.`);setConfirmed(false);}finally{setBusy(false);}}
 return <section className="sz-club-surface mx-4 mt-4 space-y-3 rounded-2xl border border-slate-300 p-4 md:mx-0" aria-label="LIVE-Veröffentlichung">
 <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">LIVE-Veröffentlichung</h2><button type="button" className="min-h-11 rounded-xl border px-3" disabled={busy} onClick={()=>void refresh()}>{busy?'Prüfe…':'Stand prüfen'}</button></div>
 <p className="text-sm">Übernimmt den geprüften Programmstand und technisch freigegebene Datenbankänderungen. TEST-Spieler, Testspiele und andere TEST-Inhalte werden nicht kopiert.</p>
 {plan?<><p className="text-sm">TEST: <strong>{plan.head?.slice(0,8)||'Verbindung fehlt'}</strong> · LIVE: <strong>{plan.main?.slice(0,8)||'noch nicht geprüft'}</strong></p>
 {plan.checks.map(c=><p className="text-sm" key={c.name}>{c.name}: {c.state==='success'?'erfolgreich':c.state==='pending'?'läuft':'noch nicht erfolgreich'}</p>)}
 {plan.blockers.length?<div role="status" className="rounded-xl border border-amber-500/50 p-3"><strong>Veröffentlichung noch gesperrt</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{plan.blockers.map(x=><li key={x}>{x}</li>)}</ul></div>:null}
 {plan.commits.length?<details><summary className="cursor-pointer font-semibold">Änderungen gegenüber LIVE ({plan.totalCommits??plan.commits.length})</summary><ul className="mt-2 max-h-60 space-y-2 overflow-auto text-sm">{plan.commits.map(c=><li key={c.sha}>{c.message}</li>)}</ul></details>:null}
 {plan.migrations.length?<details><summary className="cursor-pointer font-semibold">Datenbankänderungen ({plan.migrations.length})</summary><ul className="mt-2 max-h-48 space-y-2 overflow-auto break-all text-xs">{plan.migrations.map(m=><li key={m.path}>{m.reviewed?'Freigegeben':'Freigabe fehlt'}: {m.path.split('/').pop()}</li>)}</ul></details>:null}
 <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={!plan.ready||busy||waiting||!!error} onChange={e=>setConfirmed(e.target.checked)}/>Ich habe diesen TEST-Stand geprüft und möchte genau diese Version LIVE veröffentlichen.</label>
 <button type="button" className="min-h-11 rounded-xl border border-[rgb(var(--club-accent-rgb))] bg-[rgb(var(--club-primary-rgb))] px-4 font-bold text-[var(--club-on-primary)] disabled:opacity-40" disabled={!plan.ready||!confirmed||busy||waiting||!!error} onClick={()=>void publish()}>Geprüften Stand LIVE veröffentlichen</button>
 {waiting?<p role="status" className="text-sm">Veröffentlichung angefordert. Der Verlauf wird automatisch geprüft.</p>:null}
 {plan.runs.length?<div><h3 className="font-semibold">Veröffentlichungsverlauf</h3>{plan.runs.map(r=><p key={r.id} className="mt-2 text-sm"><a href={r.url} target="_blank" rel="noreferrer" className="underline">{r.title}</a><br/>{r.status!=='completed'?'In Bearbeitung':r.conclusion==='success'?'LIVE-Version bestätigt':`Nicht erfolgreich abgeschlossen (${r.conclusion??'unbekannt'}). LIVE-Stand prüfen.`}</p>)}</div>:null}
 </>:!error?<p role="status">Verbindung und Versionen werden geprüft…</p>:null}
 {error?<p role="alert" className="rounded-xl border border-red-500/50 p-3 text-sm">{error}</p>:null}
 </section>;
}
