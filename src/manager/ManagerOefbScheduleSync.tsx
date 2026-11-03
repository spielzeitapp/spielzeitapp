import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

type Settings = { source_url: string; team_name: string; mode: string; enabled: boolean; last_success: string | null; last_error: string | null };
type Conflict = { id: string; opponent: string; detail: { field: string; trainer: string; oefb: string } };
export function ManagerOefbScheduleSync({ seasonId, disabled }: { seasonId: string; disabled: boolean }) {
 const [url,setUrl]=useState(''),[team,setTeam]=useState(''),[mode,setMode]=useState('schedule'),[enabled,setEnabled]=useState(false);
 const [settings,setSettings]=useState<Settings|null>(null),[conflicts,setConflicts]=useState<Conflict[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const load=useCallback(async(signal?:AbortSignal)=>{
  let query=supabase.rpc('get_oefb_schedule_sync',{p_season:seasonId}); if(signal)query=query.abortSignal(signal);
  const r=await query; if(signal?.aborted)return; if(r.error){setMessage(r.error.message);return;}
  const s=r.data?.settings as Settings|null; setSettings(s);setConflicts(r.data?.conflicts??[]);
  if(s){setUrl(s.source_url);setTeam(s.team_name);setMode(s.mode);setEnabled(s.enabled);}
 },[seasonId]);
 useEffect(()=>{const c=new AbortController();void load(c.signal);return()=>c.abort();},[load]);
 async function save(){setBusy(true);setMessage('');try{
  const r=await supabase.rpc('save_oefb_schedule_sync',{p_season:seasonId,p_url:url,p_team:team,p_mode:mode,p_enabled:enabled});
  if(r.error)throw new Error(r.error.message);await load();setMessage('Gespeichert. Aktivierte Spielpläne werden automatisch geprüft.');
 }catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <section className="sz-club-surface mt-4 space-y-3 rounded-2xl border p-4" aria-label="Automatischer Mannschaftsspielplan">
  <h2 className="font-bold">Spielplan automatisch aktuell halten</h2>
  <p>Funktioniert auch ohne Tabelle. Einmal die Mannschafts-Spielplanadresse dieser Saison verknüpfen. Danach werden neue Spiele ergänzt und Termine etwa alle 15 Minuten geprüft. Eigene Spielaufzeichnungen bleiben erhalten.</p>
  <label className="block">ÖFB-Mannschaftsspielplan dieser Saison<input className="mt-1 w-full rounded-xl border p-3" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://vereine.oefb.at/…/Mannschaften/Saison-2026-27/U12/Spiele" disabled={disabled||busy}/></label>
  <label className="block">Mannschaftsname im ÖFB-Spielplan (ohne Altersklasse)<input className="mt-1 w-full rounded-xl border p-3" value={team} onChange={e=>setTeam(e.target.value)} disabled={disabled||busy}/></label>
  <label className="block">Übernahme<select className="ml-2 rounded-xl border p-2" value={mode} onChange={e=>setMode(e.target.value)} disabled={disabled||busy}><option value="schedule">Nur Spieltermine</option><option value="results">Spieltermine und Endstände</option></select></label>
  <label className="flex gap-2"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} disabled={disabled||busy}/>Automatisch aktualisieren</label>
  <button type="button" className="sz-club-button-primary min-h-11 rounded-xl border px-4" onClick={()=>void save()} disabled={disabled||busy||!url||!team}>{busy?'Speichert…':'Einstellung speichern'}</button>
  {settings?.last_success?<p>Letzter erfolgreicher Abruf: {new Date(settings.last_success).toLocaleString('de-AT',{timeZone:'Europe/Vienna'})}</p>:null}
  {settings?.last_error?<p role="status">Abruf fehlgeschlagen, wird erneut versucht: {settings.last_error}</p>:null}
  {message?<p role="status">{message}</p>:null}
  {conflicts.length?<div><h3 className="font-bold">Abweichende Trainerangaben – bleiben erhalten</h3>{conflicts.map(c=><div key={c.id} className="mt-2 rounded-xl border p-3"><strong>{c.opponent}</strong><p>{c.detail.field==='score'?'Ergebnis':'Anpfiff'}: Trainer {c.detail.trainer} · ÖFB {c.detail.oefb}</p><Link className="underline" to={`/app/events/${c.id}`}>Spiel prüfen und bei Bedarf korrigieren</Link></div>)}</div>:null}
 </section>;
}
