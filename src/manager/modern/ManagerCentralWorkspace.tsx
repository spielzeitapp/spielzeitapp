import React,{useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Search,X,Database,Activity,ArrowRight,Eye} from 'lucide-react';
import {useSession} from '../../auth/useSession';
import {useAuth} from '../../auth/AuthProvider';
import {useProfile,getDisplayFirstName} from '../../auth/useProfile';
import {TeamSwitcher} from '../../app/components/TeamSwitcher';
import {useManagerWorkMode} from '../ManagerWorkModeContext';
import {useManagerClubModules} from '../ManagerClubModulesContext';
import {useCommunicationAccess} from '../CommunicationAccessContext';
import {useManagerAppearance} from '../appearance/ManagerAppearance';
import {isStagingApp} from '../../lib/appEnvironment';
import {centralPage,centralToolsForContext,searchCentralTools,relatedCentralTools} from './centralWorkspace';
import {ManagerReferenceData,useReferenceData} from './ManagerReferenceData';
import {ManagerReferenceRail} from './ManagerReferenceRail';
import {ManagerCentralBrand} from './ManagerCentralBrand';

function Workspace({children}:{children:React.ReactNode}){
 const {pathname,search}=useLocation(),{workMode,supportSession}=useManagerWorkMode();
 const {isModuleEnabled}=useManagerClubModules(),{access}=useCommunicationAccess();
 const {backendRole,viewTeamSeason,selectedTeamSeason}=useSession();
 const {clubName}=useManagerAppearance(),{snapshot}=useReferenceData();
 const {user}=useAuth(),{profile}=useProfile(user?.id);
 const [query,setQuery]=useState(''),[rail,setRail]=useState(true);
 const page=centralPage(pathname,search);
 const home=['/manager','/manager/dashboard','/manager/plattform'].includes(pathname);
 const hour=Number(new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',hour:'numeric',hourCycle:'h23'}).format(new Date()));
 const greeting=hour>=5&&hour<12?'Guten Morgen':hour<18?'Guten Tag':'Guten Abend';
 const first=getDisplayFirstName(profile),name=snapshot?.club_name??clubName??'SPIELZEITAPP';
 const current=viewTeamSeason??selectedTeamSeason;
 const global=workMode==='platform_admin'&&!supportSession;
 const tools=centralToolsForContext({mode:workMode,support:Boolean(supportSession),staging:isStagingApp(),isModuleEnabled,speaker:access.speaker,music:access.music});
 const results=searchCentralTools(tools,query);
 const related=relatedCentralTools(tools,pathname,page.section);
 return <div className="central-workspace szc-reference" data-central-section={page.section}>
  <header className="szc-pageTitle"><div><div className="szc-eyebrow">{name.toUpperCase()} · VEREINSZENTRALE</div><h1>{home?greeting+(first?', '+first:'')+'.':page.label}</h1><p>{home?'Hier läuft alles zusammen. Bereit für den nächsten Spieltag?':global?'Vereine und Mannschaften zentral verwalten.':`${current?.team?.name??'Mannschaft'} · ${current?.age_group??''} · ${current?.season?.name??''}`}</p></div>
 <div className="szc-titleActions"><details className="central-tool-search" key={pathname+search}><summary aria-label="Bereich suchen"><Search size={15}/><span>Bereich suchen</span></summary><div className="central-tool-search-panel"><label htmlFor="central-tool-query">Alle freigegebenen Funktionen</label><div className="central-search-input"><Search size={16}/><input id="central-tool-query" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Kader, Training, Fotos …"/>{query&&<button type="button" aria-label="Suche leeren" onClick={()=>setQuery('')}><X size={16}/></button>}</div><div className="central-tool-results">{results.map(tool=><Link key={tool.id} to={tool.to!}><span>{tool.label}</span><small>{tool.section}</small></Link>)}{!results.length&&<p role="status">Kein passender Bereich gefunden.</p>}</div></div></details><div className="szc-favorite-action"><TeamSwitcher iconOnly openInApp/><span>Favoriten</span></div><span className="szc-data-chip" title="Speichern erfolgt mit den vorhandenen Schaltflächen im jeweiligen Formular."><Database size={15}/>{isStagingApp()?'TEST-Daten':'Arbeitsdaten'}</span></div>
  </header>
  <div className="szc-environment" aria-label="Manager, TEST und LIVE"><span><Activity size={16}/><b>Manager</b><small>Zentrale Datenpflege</small></span><ArrowRight size={16}/><span><b>TEST</b><span className="szc-badge szc-gray">{isStagingApp()?'Diese Umgebung':'Separate Umgebung'}</span></span><ArrowRight size={16}/>{backendRole==='admin'?<Link to="/manager/live-veroeffentlichung"><b>LIVE</b><span className="szc-badge szc-gray">Stand prüfen</span></Link>:<span><b>LIVE</b><span className="szc-badge szc-gray">Separate Freigabe</span></span>}<button type="button" className="szc-envNote" aria-expanded={rail} onClick={()=>setRail(v=>!v)}><Eye size={12}/>{rail?'Vorschau ausblenden':'Vorschau & Checkliste'}</button></div>
  {!home&&related.length>1&&<nav className="central-section-tabs" aria-label="Zugehörige Managerbereiche">{related.map(tool=><Link key={tool.id} to={tool.to!} aria-current={tool.to===pathname+search||(!search&&tool.to===pathname)?'page':undefined}>{tool.label}</Link>)}</nav>}
  <div className={'szc-bodyGrid '+(!rail?'szc-without-rail':'')}><section className={'central-page-content szc-native-page '+(page.id==='detail'?'szc-detail-page':'')}>{children}</section>{rail&&<ManagerReferenceRail/>}</div>
  <footer className="szc-mainFooter"><ManagerCentralBrand/><small>{isStagingApp()?'Gemeinsame TEST-Daten':'Gemeinsame Arbeitsdaten'} · {name}</small></footer>
 </div>;
}
export function ManagerCentralWorkspace({children}:{children:React.ReactNode}){return <ManagerReferenceData><Workspace>{children}</Workspace></ManagerReferenceData>;}
