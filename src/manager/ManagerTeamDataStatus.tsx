import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSetup, type SetupSnapshot } from '../lib/managerSetup';
import { getOefbTableSettings } from '../lib/oefbTableSettings';
import { supabase } from '../lib/supabaseClient';

export function ManagerTeamDataStatus({ seasonId, setupUrl }: { seasonId: string; setupUrl: string }) {
 const [data,setData]=useState<{snapshot:SetupSnapshot;photo:boolean;table:boolean}|null>(null);
 const [error,setError]=useState(false);
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{try{
   const [setup,photo,table]=await Promise.all([loadSetup(seasonId),supabase.from('team_photos').select('photo_url').eq('team_season_id',seasonId).maybeSingle(),getOefbTableSettings(seasonId)]);
   if(setup.error||!setup.data||photo.error||table.error)throw Error();
   if(active){setData({snapshot:setup.data,photo:Boolean(photo.data?.photo_url),table:Boolean(table.data)});setError(false);}
  }catch{if(active){setData(null);setError(true);}}};
  setData(null);setError(false);void refresh();
  window.addEventListener('focus',refresh);window.addEventListener('manager-setup-changed',refresh);
  return()=>{active=false;window.removeEventListener('focus',refresh);window.removeEventListener('manager-setup-changed',refresh);};
 },[seasonId]);
 const checks=data?[
  {name:'Foto',ok:data.photo},{name:'Trainer',ok:data.snapshot.staff>0},{name:'Kader',ok:data.snapshot.players>0},
  {name:'Spiele',ok:data.snapshot.matches>0},{name:'Training',ok:data.snapshot.trainings>0},{name:'Tabelle',ok:data.table},
 ]:[];
 const missing=checks.filter(c=>!c.ok).length;
 return <div className="mt-3 space-y-3" aria-label="Datenstatus der Mannschaft">
  <div className="flex flex-wrap gap-2">{checks.map(c=><Link key={c.name} to={setupUrl} className={`rounded-lg border px-2 py-1 text-xs font-semibold ${c.ok?'border-emerald-300 bg-emerald-100 text-emerald-900':'border-red-300 bg-red-100 text-red-900'}`}>{c.ok?'✓':'!'} {c.name}{!c.ok?' fehlt':''}</Link>)}</div>
  <Link to={setupUrl} className={`inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold ${!data?'bg-amber-100 text-amber-950':missing?'bg-red-700 text-white':'bg-emerald-700 text-white'}`}>{!data?(error?'Status nicht prüfbar · Einrichtung öffnen':'Status wird geprüft…'):missing?`${missing} Bereiche offen · Einrichtung öffnen`:'Daten vorhanden · Einrichtung prüfen'} →</Link>
  <p className="text-xs text-slate-500">Daten vorhanden ≠ vollständig geprüft. Tabelle oder Training können je nach Mannschaft entfallen.</p>
 </div>;
}
