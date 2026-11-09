import React from 'react';
import type {SessionTeamSeasonItem} from '../../auth/useSession';
import {isSeasonActive,getSeasonStatusLabel} from '../../lib/seasonLifecycle';

function clubLabel(row:SessionTeamSeasonItem){const c=Array.isArray(row.team?.clubs)?row.team.clubs[0]:row.team?.clubs;return c?.name??row.team?.name??'Verein';}
export function ManagerReferenceContextSelect({seasons,value,onSelect,clubName}:{seasons:SessionTeamSeasonItem[];value:string;onSelect:(id:string)=>void;clubName:string|null}){
 const selected=seasons.find(s=>s.id===value);
 const clubKey=(s:SessionTeamSeasonItem)=>s.team?.club_id??clubLabel(s);
 const club=selected?clubKey(selected):'';
 const clubs=seasons.filter((s,i,all)=>all.findIndex(t=>clubKey(t)===clubKey(s))===i);
 const inClub=seasons.filter(s=>!club||clubKey(s)===club);
 const teams=inClub.filter((s,i,all)=>all.findIndex(t=>t.team?.id===s.team?.id)===i);
 const inTeam=inClub.filter(s=>s.team?.id===selected?.team?.id);
 function choose(rows:SessionTeamSeasonItem[]){const same=rows.find(s=>s.season?.id===selected?.season?.id)??rows.find(s=>isSeasonActive(s.status))??rows[0];if(same)onSelect(same.id);}
 return <div className="szc-context-selectors">
  <label className="szc-selector"><span>VEREIN</span>{clubs.length>1?<select aria-label="Verein" value={club} onChange={e=>choose(seasons.filter(s=>clubKey(s)===e.target.value))}>{clubs.map(s=><option key={clubKey(s)} value={clubKey(s)}>{clubLabel(s)}</option>)}</select>:<strong>{clubName??(selected?clubLabel(selected):'Verein auswählen')}</strong>}</label>
  <label className="szc-selector"><span>MANNSCHAFT</span><select aria-label="Mannschaft" value={selected?.team?.id??''} disabled={!teams.length} onChange={e=>choose(inClub.filter(s=>s.team?.id===e.target.value))}><option value="" disabled>Mannschaft wählen…</option>{teams.map(t=><option key={t.team?.id} value={t.team?.id}>{t.age_group??t.team?.age_group??t.team?.name}</option>)}</select></label>
  <label className="szc-selector"><span>SAISON</span><select aria-label="Saison" value={selected?.id??''} disabled={!selected} onChange={e=>onSelect(e.target.value)}><option value="" disabled>Saison wählen…</option>{inTeam.map(s=><option key={s.id} value={s.id}>{s.season?.name}{isSeasonActive(s.status)?'':' · '+getSeasonStatusLabel(s.status)}</option>)}</select></label>
 </div>;
}
