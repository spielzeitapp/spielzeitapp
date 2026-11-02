import React, { useRef, useState } from 'react';
import { Check, ChevronDown, Search, Users, X } from 'lucide-react';
import type { SessionTeamSeasonItem } from '../../auth/useSession';
import { formatTeamSeasonCompactSwitcherLabel, isSeasonActive, isSeasonArchived } from '../../lib/seasonLifecycle';
import type { ManagerWorkMode } from '../managerWorkMode';
import { ClubLogo } from '../../components/branding/ClubLogo';
import { getClubLogo } from '../../lib/teamLogos';
export const managerModeLabel = (mode: ManagerWorkMode) => mode === 'platform_admin' ? 'Plattformverwaltung' : mode === 'club_admin' ? 'Vereinsverwaltung' : 'Trainerbereich';
export function managerPickerSeasons(seasons: SessionTeamSeasonItem[], query: string) {
 return seasons.filter(s => `${s.display_name||''} ${s.team?.name||''} ${s.age_group||''} ${s.season?.name||''}`.toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de'))).slice().sort((a,b)=>Number(isSeasonArchived(a.status))-Number(isSeasonArchived(b.status)) || Number(isSeasonActive(b.status))-Number(isSeasonActive(a.status)));
}
export function ManagerContextPicker({seasons,value,label,onSelect,modes,mode,onModeChange}:{seasons:SessionTeamSeasonItem[];value:string;label:string;onSelect:(id:string)=>void;modes:ManagerWorkMode[];mode:ManagerWorkMode;onModeChange:(m:ManagerWorkMode)=>void}) {
 const ref=useRef<HTMLDialogElement>(null),[search,setSearch]=useState('');
 return <>
  <button type="button" className="manager-context-trigger" aria-haspopup="dialog" onClick={()=>{setSearch('');ref.current?.showModal();}}>
   <Users className="h-5 w-5 shrink-0" aria-hidden/><span className="min-w-0 flex-1 text-left"><span className="block text-[10px] font-bold uppercase tracking-widest opacity-60">{managerModeLabel(mode)}</span><span className="block truncate text-[13px] font-bold">{label}</span></span><ChevronDown className="h-4 w-4 shrink-0" aria-hidden/>
  </button>
  <dialog ref={ref} className="manager-context-dialog" aria-label="Mannschaft, Saison und Arbeitsbereich wählen" onClick={e=>{if(e.target===e.currentTarget)ref.current?.close();}}>
   <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4"><h2 className="text-lg font-black">Dein Arbeitsbereich</h2><button type="button" autoFocus onClick={()=>ref.current?.close()} aria-label="Auswahl schließen" className="manager-round-button"><X className="h-5 w-5"/></button></div>
   <div className="space-y-4 overflow-y-auto overscroll-contain p-4">
    {modes.length>1?<section><h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">Ansicht</h3><div className="grid gap-2">{modes.map(m=><button type="button" key={m} aria-pressed={m===mode} onClick={()=>{if(modes.includes(m)){ref.current?.close();onModeChange(m);}}} className="manager-context-option"><span>{managerModeLabel(m)}</span>{m===mode?<Check className="h-5 w-5"/>:null}</button>)}</div></section>:null}
    <section><h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">Freigegebene Mannschaften & Saisonen</h3><label className="relative mb-3 block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/50"/><input aria-label="Mannschaft oder Saison suchen" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Mannschaft oder Saison suchen" className="min-h-11 w-full rounded-xl border border-white/15 bg-white/5 pl-10 pr-3 text-sm text-white"/></label>
    <div className="space-y-2">{managerPickerSeasons(seasons,search).map(s=><button key={s.id} type="button" aria-pressed={s.id===value} className="manager-context-option" onClick={()=>{if(seasons.some(row=>row.id===s.id)){onSelect(s.id);ref.current?.close();}}}>
     <ClubLogo src={getClubLogo(s.team?.name||'',{logoUrl:s.team?.logo_url})} alt="" className="h-10 w-10 shrink-0 object-contain"/><span className="min-w-0 flex-1 text-left text-sm font-bold">{formatTeamSeasonCompactSwitcherLabel({displayName:s.display_name,teamName:s.team?.name,ageGroup:s.age_group,seasonName:s.season?.name,status:s.status},{markArchived:true,markCurrent:isSeasonActive(s.status)})}</span>{s.id===value?<Check className="h-5 w-5 shrink-0"/>:null}
    </button>)}</div>{managerPickerSeasons(seasons,search).length===0?<p className="py-4 text-sm text-white/55">Keine freigegebene Mannschaft gefunden.</p>:null}</section>
    <p className="text-xs leading-relaxed text-white/50">Archivierte Saisonen bleiben lesbar. Fan-Favoriten findest du über den Stern; sie erteilen keine Bearbeitungsrechte.</p>
   </div>
  </dialog>
 </>;
}
