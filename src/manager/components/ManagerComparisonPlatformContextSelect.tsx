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
 const selectClass='manager-header-select min-h-10 w-full truncate rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-500/30';
 return <div className={mobile ? "manager-platform-context-mobile" : "hidden min-w-0 gap-2 md:flex"} aria-label="Verein und Mannschaft auswählen">
  <label className="min-w-0 max-w-[13rem] text-[10px] font-semibold text-white/60">Verein<select aria-label="Verein wählen" className={selectClass} value={clubs.some(c=>c.id===clubId)?clubId:''} onChange={e=>{navigate(e.target.value ? `/manager/vereine/${encodeURIComponent(e.target.value)}` : '/manager/plattform');}}><option value="">{error?'Vereine nicht verfügbar':'Plattform · Alle Vereine'}</option>{clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
  <label hidden={mobile && !clubId} className="min-w-0 max-w-[19rem] text-[10px] font-semibold text-white/60">Mannschaft / Saison<select aria-label="Mannschaft und Saison wählen" disabled={!clubId||!detail?.team_seasons.length} className={selectClass+' disabled:opacity-50'} value={detail?.team_seasons.some(s=>s.id===seasonId)?seasonId:''} onChange={e=>{if(e.target.value)navigate(`/manager/vereine/${encodeURIComponent(clubId)}?setupSeason=${encodeURIComponent(e.target.value)}#manager-setup-checklist`);}}><option value="">{clubId&&!detail?'Mannschaften laden…':detail&&!detail.team_seasons.length?'Noch keine eigene Mannschaftssaison':'Mannschaft wählen…'}</option>{detail?.team_seasons.map(s=><option key={s.id} value={s.id}>{s.team_name} · {s.age_group} · {s.season_name}{s.status==='archived'?' · Archiv':''}</option>)}</select></label>
 </div>;
}
