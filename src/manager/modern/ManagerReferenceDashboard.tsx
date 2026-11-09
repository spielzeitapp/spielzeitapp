import React from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Users,Shield,CalendarDays,CheckCheck,ArrowUpRight,ChevronRight,Download,Radio,Dumbbell} from 'lucide-react';
import {useSession,type SessionTeamSeasonItem} from '../../auth/useSession';
import {useManagerWorkMode} from '../ManagerWorkModeContext';
import {useManagerAppearance} from '../appearance/ManagerAppearance';
import {useEvents} from '../../hooks/useEvents';
import {usePlayers} from '../../hooks/usePlayers';
import {ManagerComparisonWelcome} from '../components/ManagerComparisonWelcome';
import {useReferenceData,referenceSteps} from './ManagerReferenceData';
import {isSeasonActive} from '../../lib/seasonLifecycle';

export function ManagerReferenceDashboard(){
 const session=useSession(),navigate=useNavigate();
 const {contextTeamSeasons,workMode,selectTrainerTeamSeasonId}=useManagerWorkMode();
 const {branding,clubName}=useManagerAppearance();
 const {seasonId,clubId,snapshot,photo,loading,canReviewClub}=useReferenceData();
 const season=session.viewTeamSeason??session.selectedTeamSeason;
 const {events,loading:eventsLoading,error:eventsError}=useEvents(seasonId);
 const {players,loading:playersLoading,error:playersError}=usePlayers(seasonId,{mode:'active'});
 const clubSeasons=contextTeamSeasons.filter(s=>!season?.team?.club_id||s.team?.club_id===season.team.club_id);
 const currentSeasons=clubSeasons.filter(s=>s.season?.name===season?.season?.name);
 const teams=currentSeasons.filter((s,i,all)=>all.findIndex(t=>t.team?.id===s.team?.id)===i);
 const steps=referenceSteps(snapshot,photo,clubId,seasonId,canReviewClub);
 const done=steps.filter(s=>['done','skipped'].includes(s.state)).length;
 const next=steps.find(s=>!['done','skipped'].includes(s.state));
 const upcoming=events.filter(e=>!['finished','canceled'].includes(e.status)&&new Date(e.starts_at).getTime()>=Date.now()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,3);
 const setup=clubId&&session.backendRole==='admin'?`/manager/vereine/${clubId}${seasonId?'?setupSeason='+seasonId:''}#manager-setup-checklist`:'/manager/saisons';
 function openTeam(team:SessionTeamSeasonItem){if(isSeasonActive(team.status)){if(workMode==='trainer')selectTrainerTeamSeasonId(team.id);session.setSelectedTeamSeasonId(team.id);session.setViewTeamSeasonId(null);}else session.setViewTeamSeasonId(team.id);navigate('/manager/team');}
 const stats=[{label:'Mannschaften',value:teams.length,hint:'Freigegeben in dieser Saison',to:'/manager/teams',icon:Users},{label:'Spieler im Kader',value:playersLoading?'…':playersError?'—':players.length,hint:'In dieser Mannschaft',to:'/manager/spieler',icon:Shield},{label:'Termine & Spiele',value:eventsLoading?'…':eventsError?'—':events.length,hint:'Zentral organisiert',to:'/manager/termine',icon:CalendarDays},{label:'Setup-Schritte',value:snapshot?`${done}/${steps.length}`:loading?'…':'—',hint:snapshot?'Dein geprüfter Fortschritt':'Einrichtung öffnen',to:setup,icon:CheckCheck}];
 return <div className="szc-mainColumn">
  <ManagerComparisonWelcome clubName={clubName??season?.team?.name} season={season?.season?.name} actionLabel="Verein einrichten" actionTo={setup}/>
  <div className="szc-stats">{stats.map(({label,value,hint,to,icon:Icon})=><Link key={label} to={to} className="szc-stat"><Icon size={18}/><strong>{value}</strong><b>{label}</b><small>{hint}</small></Link>)}</div>
  <div className="szc-sectionHeading"><h2>Deine Mannschaften <span>{teams.length}</span></h2><Link className="szc-link" to="/manager/teams">Alle anzeigen <ArrowUpRight size={15}/></Link></div>
  <div className="szc-teamsGrid">{teams.slice(0,3).map(team=><button type="button" key={team.id} className={'szc-teamCard '+(team.id===seasonId?'selected':'')} onClick={()=>openTeam(team)}><div className="szc-teamCardTop"><span className="szc-miniBadge">{branding?.logo_url?<img src={branding.logo_url} alt=""/>:<Shield size={18}/>}</span><span className="szc-badge szc-gray">{team.status==='archived'?'Archiv':team.status==='draft'?'Vorbereitet':'Aktive Saison'}</span></div><h3>{team.age_group??team.team?.age_group??team.team?.name}</h3><p>{team.team?.name} · {team.season?.name}</p><footer><span>{team.id===seasonId&&!playersLoading&&!playersError?players.length+' Spieler':'Mannschaft'}</span><span>Kader öffnen <ChevronRight size={14}/></span></footer></button>)}</div>
  {!teams.length&&<div className="szc-panel"><p>Noch keine freigegebene Mannschaft in dieser Saison.</p><Link className="szc-link" to="/manager/teams">Mannschaften öffnen →</Link></div>}
  <div className="szc-lowerGrid"><article className="szc-panel"><div className="szc-sectionHeading"><h2>Als Nächstes</h2><CalendarDays size={17}/></div>{eventsError?<p role="status">Termine konnten nicht geladen werden.</p>:upcoming.map(event=><Link key={event.id} className="szc-agenda" to={'/manager/events/'+event.id}><div className="szc-dateBlock"><b>{new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',day:'2-digit'}).format(new Date(event.starts_at))}</b><small>{new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',month:'short'}).format(new Date(event.starts_at))}</small></div><div><strong>{event.opponent||(event.kind==='training'?'Training':'Termin')}</strong><small>{new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',hour:'2-digit',minute:'2-digit'}).format(new Date(event.starts_at))} Uhr · {season?.age_group}</small></div><ChevronRight size={16}/></Link>)}{!eventsLoading&&!eventsError&&!upcoming.length&&<div className="szc-empty">Keine kommenden Termine.<Link className="szc-link" to="/manager/termine">Termin anlegen →</Link></div>}</article>
  <article className="szc-panel"><div className="szc-sectionHeading"><h2>Dein nächster Schritt</h2><span className="szc-badge szc-amber">Setup</span></div><div className="szc-nextStep"><span className="szc-stepBig">{snapshot?String(Math.max(1,steps.findIndex(s=>s===next)+1)).padStart(2,'0'):'→'}</span><div><h3>{snapshot?next?.title??'Einrichtung geprüft':'Einrichtung prüfen'}</h3><p>{snapshot?next?.detail??'Alle Einrichtungsbereiche sind geprüft.':'Öffne die vorhandene Saisonverwaltung und prüfe die Mannschaftsdaten.'}</p></div></div><Link className="szc-outline szc-full" to={snapshot?next?.to??setup:setup}>Schritt öffnen <ChevronRight size={16}/></Link></article></div>
  <div className="szc-sectionHeading"><h2>Schnellzugriff</h2><span className="szc-muted">Für deinen Vereinsalltag</span></div><div className="szc-quick">{[{label:'ÖFB-Import',hint:'Daten abgleichen',to:seasonId?`/manager/saisons/${seasonId}/oefb-import`:'/manager/saisons',icon:Download},{label:'Live-Spieltag',hint:'Mittendrin statt daneben',to:'/manager/live',icon:Radio},{label:'Trainingsplanung',hint:'Die nächste Einheit',to:'/manager/training/einheiten',icon:Dumbbell}].map(({label,hint,to,icon:Icon})=><Link key={label} to={to}><Icon size={20}/><span><b>{label}</b><small>{hint}</small></span><ArrowUpRight size={17}/></Link>)}</div>
 </div>;
}
