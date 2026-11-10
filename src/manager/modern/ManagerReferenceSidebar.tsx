import React,{useEffect} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Activity,LayoutDashboard,Shield,Users,CalendarDays,Trophy,Image,Radio,Dumbbell,MapPin,Download,Bell,Archive,CheckCheck,Settings,ChevronRight,X,BookOpen,Video,Music2,Share2,Mic} from 'lucide-react';
import {useManagerWorkMode} from '../ManagerWorkModeContext';
import {useManagerClubModules} from '../ManagerClubModulesContext';
import {useCommunicationAccess} from '../CommunicationAccessContext';
import {useManagerAppearance} from '../appearance/ManagerAppearance';
import {useSession} from '../../auth/useSession';
import {useAuth} from '../../auth/AuthProvider';
import {useProfile,getDisplayFirstName,profileDisplayName} from '../../auth/useProfile';
import {centralToolsForContext} from './centralWorkspace';
import {isStagingApp} from '../../lib/appEnvironment';
import {ManagerCentralBrand} from './ManagerCentralBrand';

export function ManagerReferenceSidebar({open,onClose}:{open:boolean;onClose:()=>void}){
 const {pathname,search}=useLocation(),{branding,clubName}=useManagerAppearance();
 const {workMode,supportSession}=useManagerWorkMode(),{isModuleEnabled,clubId}=useManagerClubModules(),{access}=useCommunicationAccess();
 const {backendRole,viewTeamSeasonId,selectedTeamSeasonId}=useSession();
 const {user}=useAuth(),{profile}=useProfile(user?.id);
 const name=profileDisplayName(profile)||getDisplayFirstName(profile)||'Mein Profil';
 const source=viewTeamSeasonId??selectedTeamSeasonId;
 const tools=centralToolsForContext({mode:workMode,support:Boolean(supportSession),staging:isStagingApp(),isModuleEnabled,speaker:access.speaker,music:access.music});
 const used=new Set<string>();
 const lookup=(id:string)=>{const tool=tools.find(t=>t.id===id);if(tool)used.add(id);return tool;};
 type Item={id:string;label:string;to:string;icon:typeof Users};
 const item=(id:string,icon:typeof Users,label?:string):Item|null=>{const tool=lookup(id);return tool?{id,label:label??tool.label,to:tool.to!,icon}:null;};
 const setupId=/^\/manager\/vereine\/([^/]+)/.exec(pathname)?.[1]??supportSession?.clubId??clubId;
 const groups:Array<{label:string;items:Array<Item|null>}>= [
  {label:'ÜBERSICHT',items:[{id:'central',label:'Zentrale',to:workMode==='platform_admin'&&!supportSession?'/manager/plattform':'/manager',icon:LayoutDashboard},backendRole==='admin'?{id:'club-setup',label:'Vereinssetup',to:setupId?`/manager/vereine/${setupId}${source?'?setupSeason='+source:''}`:'/manager/vereine',icon:Shield}:null,item('teams',Users)]},
  {label:'MANNSCHAFT',items:[item('players',Users,'Kader'),{id:'trainers',label:'Trainer',to:'/manager/team?tab=trainers',icon:Shield},item('events',CalendarDays),item('calendar',CalendarDays,'Wochenkalender'),item('matches',Trophy),item('competition',Activity,'Tabellen'),item('media-studio',Image,'Medien')]},
  {label:'ORGANISATION',items:[item('live',Radio),item('training',Dumbbell),item('venues',MapPin),item('oefb-import',Download),item('team-push',Bell,'Push-Mitteilungen')]},
  {label:'VERWALTUNG',items:[item('archive',Archive,'Archiv & Saisonwechsel'),{id:'checklist',label:'Checklisten',to:backendRole==='admin'&&setupId&&source?`/manager/vereine/${setupId}?setupSeason=${source}#manager-setup-checklist`:'/manager/saisons',icon:CheckCheck},item('parents',Users,'Eltern & Zugänge'),item('live-release',Activity,'Veröffentlichung'),item('clubs',Shield),item('notifications',Bell)]},
 ];
 const extraIcons:Record<string,typeof Users>={'training-lib':BookOpen,'training-tpl':BookOpen,'training-chronik':Archive,video:Video,'speaker-studio':Mic,'music-studio':Music2,'social-media':Share2};
 const extras=tools.filter(t=>!used.has(t.id)&&!['dashboard','squad','platform-dashboard','templates','chronicle'].includes(t.id));
 if(extras.length)groups.push({label:'WEITERE WERKZEUGE',items:extras.map(t=>({id:t.id,label:t.label,to:t.to!,icon:extraIcons[t.id]??ChevronRight}))});
 useEffect(()=>{if(!open)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open,onClose]);
 function active(to:string){const [path,query]=to.split('?');if(query)return pathname===path&&search===`?${query}`;if(to==='/manager')return pathname==='/manager'||pathname==='/manager/dashboard';return pathname===path&&!search||pathname.startsWith(path+'/');}
 return <><button type="button" className={'szc-sidebar-backdrop '+(open?'open':'')} tabIndex={open?0:-1} onClick={onClose} aria-label="Navigation schließen"/>
 <aside className={'szc-sidebar '+(open?'open':'')} aria-label="Vereinszentrale-Navigation">
  <Link className="szc-brand" to={workMode==='platform_admin'&&!supportSession?'/manager/plattform':'/manager'} onClick={onClose}><ManagerCentralBrand/></Link>
  <button type="button" className="szc-sidebar-close" onClick={onClose} aria-label="Navigation schließen"><X size={18}/></button>
  <div className="szc-workspace"><span className="szc-miniBadge">{branding?.logo_url?<img src={branding.logo_url} alt=""/>:<Shield size={20}/>}</span><div><strong>{clubName??'SpielzeitApp'}</strong><small>{clubName?'Dein Verein. Deine Zentrale.':'Deine Vereine. Eine Zentrale.'}</small></div></div>
  <nav>{groups.map(group=><div key={group.label}><label>{group.label}</label>{group.items.filter((i):i is Item=>Boolean(i)).map(({id,label,to,icon:Icon})=><Link key={id} to={to} onClick={onClose} className={active(to)?'active':''} aria-current={active(to)?'page':undefined}><Icon size={17}/><span>{label}</span></Link>)}</div>)}</nav>
  <Link className="szc-sideFoot" to="/manager/mehr" onClick={onClose}><span className="szc-avatar">{name.split(' ').map(p=>p[0]).slice(0,2).join('')}</span><div><strong>{name}</strong><small>{workMode==='trainer'?'Trainerbereich':workMode==='club_admin'?'Vereinsverwaltung':'Plattformverwaltung'}</small></div><Settings size={17}/></Link>
 </aside></>;
}
