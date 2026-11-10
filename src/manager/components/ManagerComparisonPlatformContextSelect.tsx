import {formatTeamSelectionLabel} from '../../lib/teamDisplayName';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getPlatformClub, listPlatformClubs, type ClubDetail, type ClubListRow } from '../../lib/platformClubAdmin';

/** Platform browsing context is independent of the user's trainer work season. */
export function ManagerComparisonPlatformContextSelect({ mobile = false }: { mobile?: boolean } = {}) {
 const location=useLocation(),navigate=useNavigate();
 const clubId=/^\/manager\/vereine\/([^/]+)\/?$/.exec(location.pathname)?.[1]||'';
 const seasonId=new URLSearchParams(location.search).get('setupSeason')||'';
 const [clubs,setClubs]=useState<ClubListRow[]>([]),[detail,setDetail]=useState<ClubDetail|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;void listPlatformClubs({status:'active'}).then(r=>{if(active){setClubs(r.data);setError(r.error||'');}});return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;setDetail(null);if(clubId)void getPlatformClub(clubId).then(r=>{if(active){setDetail(r.data);setError(r.error||'');}});return()=>{active=false;};},[clubId]);
 const selected=detail?.team_seasons.find(s=>s.id===seasonId);
 const teams=detail?.team_seasons.filter((s,i,all)=>all.findIndex(t=>t.team_id===s.team_id)===i)??[];
 const seasons=detail?.team_seasons.filter(s=>s.team_id===selected?.team_id)??[];
 const open=(id:string)=>navigate(`/manager/vereine/${encodeURIComponent(clubId)}?setupSeason=${encodeURIComponent(id)}#manager-setup-checklist`);
 return <div className="szc-context-selectors" aria-label="Verein und Mannschaft auswählen">
  <label className="szc-selector"><span>VEREIN</span><select aria-label="Verein wählen" value={clubs.some(c=>c.id===clubId)?clubId:''} onChange={e=>navigate(e.target.value?`/manager/vereine/${encodeURIComponent(e.target.value)}`:'/manager/plattform')}><option value="">{error?'Vereine nicht verfügbar':'Plattform · Alle Vereine'}</option>{clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  <label className="szc-selector"><span>MANNSCHAFT</span><select aria-label="Mannschaft wählen" disabled={!teams.length} value={selected?.team_id??''} onChange={e=>{const rows=detail?.team_seasons.filter(s=>s.team_id===e.target.value)??[];const next=rows.find(s=>s.season_name===selected?.season_name)??rows.find(s=>s.status==='active')??rows[0];if(next)open(next.id);}}><option value="" disabled>{clubId&&!detail?'Mannschaften laden…':'Mannschaft wählen…'}</option>{teams.map(s=><option key={s.team_id} value={s.team_id}>{formatTeamSelectionLabel(clubs.find(c=>c.id===clubId)?.name,s.team_name,s.age_group)}</option>)}</select></label>
  <label className="szc-selector"><span>SAISON</span><select aria-label="Saison wählen" disabled={!selected} value={selected?.id??''} onChange={e=>open(e.target.value)}><option value="" disabled>Saison wählen…</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.season_name}{s.status==='archived'?' · Archiv':''}</option>)}</select></label>
 </div>;
}
