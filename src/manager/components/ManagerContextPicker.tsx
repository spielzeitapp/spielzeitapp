import { PremiumButton } from '../../ui';
import React, { useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Search, Users } from 'lucide-react';
import type { SessionTeamSeasonItem } from '../../auth/useSession';
import { formatTeamSeasonContextLabel, isSeasonActive, isSeasonArchived } from '../../lib/seasonLifecycle';
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
  <dialog ref={ref} className="manager-context-dialog sz-club-surface" aria-label="Mannschaft, Saison und Arbeitsbereich wählen" onClick={e=>{if(e.target===e.currentTarget)ref.current?.close();}}>
   <div className="shrink-0 px-3 pt-3">
    <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/30" aria-hidden />
    <div className="flex items-center justify-between gap-2 px-1 pb-2 pt-1">
     <PremiumButton variant="interactive" autoFocus onClick={()=>ref.current?.close()} className="!min-h-11 !px-4 !text-sm"><ArrowLeft className="h-4 w-4 sz-club-accent-text" aria-hidden /> Zurück</PremiumButton>
     <PremiumButton onClick={()=>ref.current?.close()} className="!min-h-11 !px-5 !text-sm">Fertig</PremiumButton>
    </div>
    <div className="px-2 pb-4 pt-1 text-center">
     <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-[rgb(var(--club-border-rgb)/0.45)] bg-[rgb(var(--club-primary-rgb)/0.16)]"><Users className="h-6 w-6 text-[rgb(var(--club-accent-text-rgb))]" aria-hidden /></div>
     <h2 className="text-[22px] font-black leading-tight text-white">Mannschaft wählen</h2>
     <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-white/65">Wähle deine Arbeitsmannschaft und Saison. Deine Favoriten erreichst du über den Stern.</p>
    </div>
   </div>
   <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
    <label className="relative mb-3 block"><Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 sz-club-accent-text"/><input aria-label="Mannschaft oder Saison suchen" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Verein oder Mannschaft suchen" className="min-h-[50px] w-full rounded-xl border border-[rgb(var(--club-border-rgb)/0.3)] bg-[#111114] py-3 pl-11 pr-3 text-[15px] text-white placeholder:text-white/45 focus:border-[rgb(var(--club-border-rgb))] focus:outline-none"/></label>
    {modes.length>1?<details className="mb-4 rounded-[20px] border border-white/10 bg-white/[0.025] px-4"><summary className="cursor-pointer py-4 text-sm font-bold text-white/85">{managerModeLabel(mode)} · Ansicht wechseln</summary><div className="space-y-2 pb-3">{modes.map(m=><button type="button" key={m} aria-pressed={m===mode} onClick={()=>{if(modes.includes(m)){ref.current?.close();onModeChange(m);}}} className="manager-context-option"><span>{managerModeLabel(m)}</span>{m===mode?<Check className="h-5 w-5"/>:null}</button>)}</div></details>:null}
    {[{archive:false,title:'Meine Arbeitsmannschaften'},{archive:true,title:'Archiv & Vorbereitung · einzeln anzeigen'}].map(group=>{
     const items=managerPickerSeasons(seasons,search).filter(s=>!isSeasonActive(s.status)===group.archive);
     return items.length?<section key={group.title} className={group.archive?'mt-4 border-t border-white/10 pt-4':''}>
      <h3 className="mb-2 px-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">{group.title}</h3>
      {items.map(s=><button key={s.id} data-manager-season={s.id} type="button" aria-pressed={s.id===value} className={`relative mb-3 flex min-h-[104px] w-full items-center justify-between gap-3 rounded-[22px] border px-4 py-4 text-left text-[16px] font-bold leading-snug shadow-[0_4px_16px_rgba(0,0,0,0.16)] transition-colors ${s.id===value?'sz-club-showcase-card text-white':'border-white/10 bg-white/[0.035] text-white/90 hover:bg-white/[0.08]'}`} onClick={()=>{if(seasons.some(row=>row.id===s.id)){onSelect(s.id);ref.current?.close();}}}>
       <ClubLogo src={getClubLogo(s.team?.name||'',{logoUrl:s.team?.logo_url})} alt="" className="h-11 w-11 shrink-0 object-contain"/>
       <span className="min-w-0 flex-1"><span className="block [overflow-wrap:anywhere]">{formatTeamSeasonContextLabel({displayName:s.display_name,teamName:s.team?.name,ageGroup:s.age_group},{includeSeason:false})}</span><span className="mt-1 block text-[14px] font-medium text-white/75">{s.season?.name}</span><span className="mt-1 block text-[12px] font-medium text-white/55">{isSeasonActive(s.status)?'Aktuelle Mannschaft':s.status==='draft'?'In Vorbereitung':'Archiv'}</span></span>
       <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${s.id===value?'border-[rgb(var(--club-border-rgb)/0.65)] bg-[rgb(var(--club-primary-rgb)/0.75)]':'border-white/20'}`}>{s.id===value?<Check className="h-5 w-5 text-white" aria-hidden />:null}</span>
      </button>)}
     </section>:null;
    })}
    {managerPickerSeasons(seasons,search).length===0?<p className="py-4 text-center text-sm text-white/55">Keine freigegebene Mannschaft gefunden.</p>:null}
   </div>
  </dialog>
 </>;
}
