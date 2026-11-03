import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
type Conflict = { field: string; trainer: string; oefb: string };
export function formatOefbConflictValue(c: Conflict, value: string): string {
 if(c.field!=='starts_at')return value;
 const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('de-AT',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Vienna'}).format(date):'Unbekannter Zeitpunkt';
}
export function OefbConflictNotice({ eventId, onResolved }: { eventId: string; onResolved: () => void }) {
 const [conflict,setConflict]=useState<Conflict|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{const controller=new AbortController();const load=async()=>{
  const r=await supabase.from('events').select('oefb_sync_conflict').eq('id',eventId).abortSignal(controller.signal).maybeSingle();
  if(!controller.signal.aborted){if(r.error)setMessage('ÖFB-Hinweis konnte nicht geladen werden.');else setConflict(r.data?.oefb_sync_conflict??null);}
 };void load();const focus=()=>void load();window.addEventListener('focus',focus);return()=>{controller.abort();window.removeEventListener('focus',focus);};},[eventId]);
 async function resolve(choice:'keep'|'source'){
  if(!conflict||busy)return;setBusy(true);setMessage('');
  try{const r=await supabase.rpc('resolve_oefb_event_conflict',{p_event:eventId,p_expected:conflict,p_choice:choice});if(r.error)throw new Error(r.error.message);
   setConflict(null);setMessage(choice==='keep'?'Trainerangabe bleibt erhalten. Dieser ÖFB-Hinweis ist bestätigt.':'ÖFB-Wert übernommen.');onResolved();
  }catch(e){setMessage(e instanceof Error?e.message:'Speichern fehlgeschlagen.');}finally{setBusy(false);}
 }
 if(!conflict&&!message)return null;
 return <section className="sz-club-feed-inset rounded-2xl border p-4" aria-label="ÖFB-Abweichung">
 {conflict?<><h2 className="sz-club-feed-accent-text font-bold">ÖFB meldet {conflict.field==='score'?'ein anderes Ergebnis':'einen anderen Anpfiff'}</h2>
 <p className="mt-2 text-sm text-white/75">Deine Angabe bleibt erhalten, bis du dich entscheidest.</p>
 <dl className="my-3 grid grid-cols-2 gap-2"><dt>Trainerangabe</dt><dd>{formatOefbConflictValue(conflict,conflict.trainer)}</dd><dt>ÖFB</dt><dd>{formatOefbConflictValue(conflict,conflict.oefb)}</dd></dl>
 <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void resolve('keep')} className="min-h-11 rounded-xl border border-white/30 px-3 font-semibold">Trainerangabe behalten</button><button disabled={busy} onClick={()=>void resolve('source')} className="min-h-11 rounded-xl border border-[rgb(var(--club-accent-rgb))] bg-[rgb(var(--club-primary-rgb))] px-3 font-semibold text-[var(--club-on-primary)]">ÖFB-Wert übernehmen</button></div></>:null}
 {message?<p role="status" className="mt-2 text-sm">{message}</p>:null}
 </section>;
}
