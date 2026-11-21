import type { TeamQuickAction } from './teamOverviewActions';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSetup, setupSteps, type SetupSnapshot } from '../lib/managerSetup';
import { getOefbTableSettings } from '../lib/oefbTableSettings';
import { supabase } from '../lib/supabaseClient';

export function ManagerTeamDataStatus({ seasonId, actionUrl }: { seasonId: string; actionUrl: (action?: TeamQuickAction) => string }) {
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
 const steps=data?setupSteps(data.snapshot):[];
 const checks: {name:string;step:TeamQuickAction;state:string;note:string}[]=data?[
  {name:'Foto',step:'photo',state:data.photo?'done':'missing',note:''},
  ...([{name:'Trainer',key:'staff'},{name:'Kader',key:'roster'},{name:'Spiele',key:'matches'},{name:'Training',key:'training'}] as const).map(c=>({name:c.name,step:c.key,state:steps.find(s=>s.key===c.key)?.state||'missing',note:c.key==='roster'&&data.snapshot.jerseys_missing?`${data.snapshot.jerseys_missing} Nummern fehlen`:''})),
  {name:'Tabelle',step:'table',state:data.table?'done':'unconfigured',note:''},
 ]:[];
 const missing=checks.filter(c=>c.state==='missing').length;
 const open=checks.filter(c=>!['done','skipped','unconfigured'].includes(c.state)).length;
 return <div className="mt-3 space-y-3" aria-label="Datenstatus der Mannschaft">
  <div className="flex flex-wrap gap-2">{checks.map(c=><Link key={c.name} to={actionUrl(c.step)} className={`inline-flex min-h-8 items-center rounded-lg border px-2 py-1 text-xs font-semibold hover:underline focus-visible:outline focus-visible:outline-2 ${c.state==='done'?'border-emerald-300 bg-emerald-100 text-emerald-900':c.state==='missing'?'border-red-300 bg-red-100 text-red-900':['skipped','unconfigured'].includes(c.state)?'border-slate-200 bg-slate-50 text-slate-600':'border-orange-300 bg-orange-100 text-orange-900'}`}>{c.state==='done'?'✓':c.state==='missing'?'!':'?'} {c.name}{c.note?` · ${c.note}`:c.state==='missing'?' fehlt':c.state==='review'?' · noch prüfen':c.state==='skipped'?' · entfällt':c.state==='unconfigured'?' · optional, nicht eingerichtet':''}</Link>)}</div>
  <Link to={actionUrl()} className={`inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold ${!data?'bg-amber-100 text-amber-950':missing?'bg-red-700 text-white':open?'bg-orange-100 text-orange-950':'bg-emerald-700 text-white'}`}>{!data?(error?'Status nicht prüfbar · Einrichtung öffnen':'Status wird geprüft…'):open?`${open} Bereiche offen · Einrichtung öffnen`:'Datenbereiche geprüft · Einrichtung öffnen'} →</Link>
 </div>;
}
