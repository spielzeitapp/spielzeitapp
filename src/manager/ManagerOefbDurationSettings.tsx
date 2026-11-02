import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
type Fixture = { id: string; label: string; minutes: number | null };
export function DurationField({label,value,onSave,disabled,defaultMinutes}:{label:string;value:number|null;onSave:(n:number|null)=>Promise<void>;disabled:boolean;defaultMinutes?:number|null}) {
 const [draft,setDraft]=useState(value==null?'':String(value));
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState(false);
 useEffect(()=>{setDraft(value==null?'':String(value));setSaved(false);setError(null);},[value]);
 const n=draft.trim()===''?null:Number(draft);
 const valid=n===null||Number.isInteger(n)&&n>=1&&n<=180;
 return <form onSubmit={async e=>{e.preventDefault();if(!valid||busy||disabled)return;setBusy(true);setError(null);setSaved(false);try{await onSave(n);setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Speichern fehlgeschlagen');}finally{setBusy(false);}}} className="rounded-xl border border-slate-200 p-3">
  <label className="block text-sm font-semibold">{label}<input aria-label={label} type="number" min="1" max="180" step="1" placeholder={defaultMinutes?`${defaultMinutes} (Standard)`:'Nicht bestätigt'} value={draft} disabled={disabled||busy} onChange={e=>{setDraft(e.target.value);setSaved(false);}} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
  <p className="mt-1 text-xs text-slate-500">Gesamte Spielzeit ohne Pause. Leer: {defaultMinutes?'Mannschaftsstandard verwenden':'keine eigene Dauer bestätigt'}.</p>
  <button type="submit" disabled={disabled||busy||!valid} className="mt-2 min-h-10 rounded-lg bg-red-700 px-3 text-sm font-semibold text-white disabled:opacity-50">{busy?'Speichert…':'Dauer bestätigen & speichern'}</button>
  {saved?<p role="status" className="mt-2 text-sm text-emerald-700">Gespeichert. Die App berechnet die Einsatzzeiten beim nächsten Öffnen neu.</p>:null}
  {error?<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>:null}
 </form>;
}
export function ManagerOefbDurationSettings({seasonId,disabled}:{seasonId:string;disabled:boolean}) {
 const [state,setState]=useState<{seasonId:string;minutes:number|null;fixtures:Fixture[]}|null>(null);
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{let active=true;setState(null);setError(null);void(async()=>{
  const [season,events]=await Promise.all([supabase.from('team_seasons').select('oefb_duration_default_minutes').eq('id',seasonId).single(),supabase.from('events').select('id,match_id,opponent,starts_at,matches(id,status,oefb_duration_minutes)').eq('team_season_id',seasonId).eq('external_source','oefb').not('match_id','is',null).order('starts_at')]);
  if(season.error||events.error)throw Error(season.error?.message||events.error?.message);
  const fixtures=(events.data??[]).flatMap(e=>{const m=Array.isArray(e.matches)?e.matches[0]:e.matches;return m?.status==='finished'?[{id:m.id,label:`${new Date(e.starts_at).toLocaleDateString('de-AT')} · ${e.opponent}`,minutes:m.oefb_duration_minutes}]:[];});
  if(active)setState({seasonId,minutes:season.data.oefb_duration_default_minutes,fixtures});
 })().catch(e=>{if(active)setError(e.message);});return()=>{active=false};},[seasonId]);
 const current=state?.seasonId===seasonId?state:null;
 async function save(matchId:string|null,minutes:number|null,expected:number|null){
  const {error}=await supabase.rpc('save_oefb_duration',{p_team_season_id:seasonId,p_match_id:matchId,p_minutes:minutes,p_expected:expected});if(error)throw Error(error.message);
  setState(s=>s?.seasonId===seasonId?{...s,minutes:matchId?s.minutes:minutes,fixtures:s.fixtures.map(f=>f.id===matchId?{...f,minutes}:f)}:s);
 }
 return <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
  <h2 className="text-base font-bold">Spieldauer & berechnete ÖFB-Einsatzzeiten</h2>
  <p className="mt-2 text-sm text-slate-600">Bestätigter Standard für diese Mannschaft und Saison, z. B. 80 für 2 × 40 Minuten. Gilt für bestehende und künftige importierte Spiele ohne eigene Dauer. Einzelne Spiele haben Vorrang. Interne Live-Spielzeiten bleiben unverändert.</p>
  {error?<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>:!current?<p role="status" className="mt-3 text-sm">Spieldauern werden geladen…</p>:<div className="mt-3 space-y-3">
   <DurationField key={seasonId} label="Standard-Spieldauer · Minuten" value={current.minutes} disabled={disabled} onSave={n=>save(null,n,current.minutes)} />
   <details><summary className="cursor-pointer py-3 font-semibold">Abweichende Dauer pro abgeschlossenem Spiel ({current.fixtures.length})</summary><div className="space-y-2">{current.fixtures.map(f=><DurationField key={f.id} label={f.label} value={f.minutes} defaultMinutes={current.minutes} disabled={disabled} onSave={n=>save(f.id,n,f.minutes)} />)}</div></details>
  </div>}
 </section>;
}
