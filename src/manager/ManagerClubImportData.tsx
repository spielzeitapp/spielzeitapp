import React, { useState } from 'react';
import { ManagerRosterPhotos } from './ManagerRosterPhotos';
import { getOefbTableSettings } from '../lib/oefbTableSettings';
import { supabase } from '../lib/supabaseClient';

type Preview = { name: string; rows: Array<{rank:number;team:string;played:number;points:number}>; suggestedTeam?:string|null };
export function ManagerClubImportData({seasonId,rosterUrl,tableUrl,onSaved}:{seasonId:string;rosterUrl:string;tableUrl:string;onSaved:()=>void}) {
 const [photo,setPhoto]=useState(false),[table,setTable]=useState<Preview|null>(null),[team,setTeam]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[existing,setExisting]=useState(false),[confirmed,setConfirmed]=useState(false);
 async function preview(){setBusy(true);setMessage('');setTable(null);setConfirmed(false);setExisting(false);try{
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
  <div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-lg border bg-white px-3 text-sm font-semibold" onClick={()=>setPhoto(!photo)}>Mannschaftsfoto {photo?'schließen':'importieren'}</button><button type="button" disabled={busy} className="min-h-11 rounded-lg border bg-white px-3 text-sm font-semibold disabled:opacity-50" onClick={()=>void preview()}>{busy?'Bitte warten…':'Tabelle automatisch lesen'}</button></div>
  {photo&&<ManagerRosterPhotos seasonId={seasonId} sourceUrl={rosterUrl} onSaved={()=>{onSaved();window.dispatchEvent(new Event('manager-setup-changed'));}}/>}
  {message&&<p role="status" className="text-sm text-slate-700">{message}</p>}
  {table&&<div className="space-y-3 rounded-xl border bg-white p-3"><h4 className="font-bold">{table.name}</h4><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Platz</th><th>Mannschaft</th><th>Spiele</th><th>Punkte</th></tr></thead><tbody>{table.rows.map(r=><tr key={r.team}><td>{r.rank}</td><td>{r.team}</td><td>{r.played}</td><td>{r.points}</td></tr>)}</tbody></table></div>
   {!existing&&<><label className="block text-sm">Eigene Mannschaft in dieser Tabelle<select className="mt-1 min-h-11 w-full rounded-lg border px-3" value={team} onChange={e=>{setTeam(e.target.value);setConfirmed(false);}}><option value="">Bitte wählen…</option>{table.rows.map(r=><option key={r.team} value={r.team}>{r.team}</option>)}</select></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Bewerb, Saison und eigene Mannschaft stimmen überein.</label><button type="button" disabled={busy||!confirmed||!team} className="min-h-11 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50" onClick={()=>void save()}>Tabelle übernehmen</button></>}
  </div>}
 </div>;
}
