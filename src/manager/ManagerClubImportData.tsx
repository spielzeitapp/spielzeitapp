import {ManagerClubPeopleImport} from './ManagerClubPeopleImport';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ManagerRosterPhotos } from './ManagerRosterPhotos';
import { getOefbTableSettings } from '../lib/oefbTableSettings';
import { supabase } from '../lib/supabaseClient';

type Preview = { name: string; rows: Array<{rank:number;team:string;played:number;points:number}>; suggestedTeam?:string|null };
export function ManagerClubImportData({seasonId,rosterUrl,tableUrl,onSaved}:{seasonId:string;rosterUrl:string;tableUrl:string;onSaved:()=>void}) {
 const [people,setPeople]=useState(false);
 const [photoStatus,setPhotoStatus]=useState<'loading'|'present'|'missing'|'error'>('loading');
 const [photo,setPhoto]=useState(false),[table,setTable]=useState<Preview|null>(null),[team,setTeam]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[existing,setExisting]=useState(false),[confirmed,setConfirmed]=useState(false);
 useEffect(()=>{let active=true;setExisting(false);void getOefbTableSettings(seasonId).then(result=>{if(active&&!result.error)setExisting(Boolean(result.data));});return()=>{active=false;};},[seasonId]);
 useEffect(()=>{let active=true;setPhotoStatus('loading');setPhoto(false);
  void (async()=>{try{const {data,error}=await supabase.from('team_photos').select('photo_url').eq('team_season_id',seasonId).maybeSingle();if(active)setPhotoStatus(error?'error':data?.photo_url?.trim()?'present':'missing');}catch{if(active)setPhotoStatus('error');}})();
  return()=>{active=false;};
 },[seasonId]);
 async function preview(){setBusy(true);setMessage('');setTable(null);setConfirmed(false);try{
  const [response,saved]=await Promise.all([fetch('/api/oefb/table?view=clubTable&url='+encodeURIComponent(tableUrl),{cache:'no-store',signal:AbortSignal.timeout(15000)}),getOefbTableSettings(seasonId)]);
  const result=await response.json();if(!response.ok||result.error)throw Error(result.error||'Tabelle nicht verfügbar.');if(saved.error)throw Error(saved.error);
  setTable(result);setTeam(result.suggestedTeam||'');setExisting(Boolean(saved.data));
  if(saved.data)setMessage('Eine Tabelle ist bereits zugeordnet. Sie bleibt erhalten. Die erkannte Tabelle siehst du unten zur Kontrolle.');
 }catch(e){setMessage(e instanceof Error?e.message:'Tabelle konnte nicht gelesen werden.');}finally{setBusy(false);}}
 async function save(){if(!table||!team||!confirmed||existing||busy)return;setBusy(true);setMessage('');try{
  const result=await supabase.rpc('admin_set_team_season_club_table',{p_team_season_id:seasonId,p_url:tableUrl,p_team_name:team});if(result.error)throw Error(result.error.message);
  setExisting(true);setMessage('Tabelle verknüpft. Die App lädt sie aktuell vom ÖFB.');onSaved();window.dispatchEvent(new Event('manager-setup-changed'));
 }catch(e){setMessage(e instanceof Error?e.message:'Tabelle konnte nicht gespeichert werden.');}finally{setBusy(false);}}
 return <div className="space-y-3 border-t border-slate-200 pt-3">
  <div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-lg bg-red-700 px-3 text-sm font-semibold text-white" onClick={()=>setPeople(!people)}>Kader &amp; Trainer {people?'schließen':'importieren'}</button>{photoStatus==='present'&&<span className="inline-flex min-h-11 items-center rounded-lg bg-emerald-100 px-3 text-sm font-semibold text-emerald-900">✓ Mannschaftsfoto bereits vorhanden</span>}<button type="button" disabled={photoStatus==='loading'} className="min-h-11 rounded-lg border bg-white px-3 text-sm font-semibold disabled:opacity-50" onClick={()=>setPhoto(!photo)}>{photo?'Mannschaftsfoto schließen':photoStatus==='loading'?'Mannschaftsfoto wird geprüft…':photoStatus==='present'?'Mannschaftsfoto ansehen / ändern':photoStatus==='error'?'Mannschaftsfoto prüfen':'Mannschaftsfoto importieren'}</button>{existing?<><span className="inline-flex min-h-11 items-center rounded-lg bg-emerald-100 px-3 text-sm font-semibold text-emerald-900">✓ Tabelle bereits vorhanden</span><Link className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline" to={`/manager/saisons/${encodeURIComponent(seasonId)}/oefb-import`}>Tabelle öffnen</Link></>:<button type="button" disabled={busy} className="min-h-11 rounded-lg border bg-white px-3 text-sm font-semibold disabled:opacity-50" onClick={()=>void preview()}>{busy?'Bitte warten…':'Tabelle automatisch lesen'}</button>}</div>
  {people&&<ManagerClubPeopleImport key={seasonId+rosterUrl} seasonId={seasonId} rosterUrl={rosterUrl} onSaved={onSaved}/>}
  {photo&&<ManagerRosterPhotos seasonId={seasonId} sourceUrl={photoStatus==='missing'?rosterUrl:undefined} onSaved={()=>{setPhotoStatus('present');onSaved();window.dispatchEvent(new Event('manager-setup-changed'));}}/>}
  {photoStatus==='error'&&<p role="status" className="text-sm text-amber-800">Der gespeicherte Fotostatus konnte nicht geladen werden. Unter „Mannschaftsfoto prüfen“ kannst du das Bild ansehen.</p>}
  {message&&<p role="status" className="text-sm text-slate-700">{message}</p>}
  {table&&<div className="space-y-3 rounded-xl border bg-white p-3"><h4 className="font-bold">{table.name}</h4><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Platz</th><th>Mannschaft</th><th>Spiele</th><th>Punkte</th></tr></thead><tbody>{table.rows.map(r=><tr key={r.team}><td>{r.rank}</td><td>{r.team}</td><td>{r.played}</td><td>{r.points}</td></tr>)}</tbody></table></div>
   {!existing&&<><label className="block text-sm">Eigene Mannschaft in dieser Tabelle<select className="mt-1 min-h-11 w-full rounded-lg border px-3" value={team} onChange={e=>{setTeam(e.target.value);setConfirmed(false);}}><option value="">Bitte wählen…</option>{table.rows.map(r=><option key={r.team} value={r.team}>{r.team}</option>)}</select></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Bewerb, Saison und eigene Mannschaft stimmen überein.</label><button type="button" disabled={busy||!confirmed||!team} className="min-h-11 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50" onClick={()=>void save()}>Tabelle übernehmen</button></>}
  </div>}
 </div>;
}
