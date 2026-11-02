import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Users, Trophy, Download, Building2, Dumbbell, MapPinned } from 'lucide-react';
import { useSession } from '../../auth/useSession';
import { useManagerWorkMode } from '../ManagerWorkModeContext';
import { useManagerClubModules } from '../ManagerClubModulesContext';
import { isSeasonArchived } from '../../lib/seasonLifecycle';
import { managerModuleKeyForLocation } from '../managerWorkMode';
export function ManagerMobileShortcuts() {
 const {viewTeamSeasonId,selectedTeamSeasonId}=useSession();
 const {contextTeamSeasons,workMode,supportSession}=useManagerWorkMode();
 const {isModuleEnabled}=useManagerClubModules();
 const season=contextTeamSeasons.find(s=>s.id===(viewTeamSeasonId??selectedTeamSeasonId));
 const global=workMode==='platform_admin'&&!supportSession;
 const items=global?[{to:'/manager/vereine',label:'Vereine verwalten',icon:Building2},{to:'/manager/vereine?neu=1',label:'Verein einrichten',icon:Download}]:[
  {to:'/manager/termine',label:'Termine',icon:CalendarDays},
  {to:'/manager/team',label:'Team & Kader',icon:Users},
  {to:'/manager/training/einheiten',label:'Trainingsplanung',icon:Dumbbell},
  {to:'/manager/spiele',label:'Spiele & Berichte',icon:Trophy},
  ...(season&&!isSeasonArchived(season.status)?[{to:`/manager/saisons/${season.id}/oefb-import`,label:'ÖFB-Import & Spieldauer',icon:Download}]:[]),
  ...(isModuleEnabled('venues')?[{to:'/manager/platzbelegung',label:'Platzbelegung',icon:MapPinned}]:[]),
 ];
 return <nav className="manager-mobile-shortcuts" aria-label="Schnellzugriff">{items.filter(i=>global||isModuleEnabled(managerModuleKeyForLocation(i.to,'')??undefined)).map(({to,label,icon:Icon})=><Link key={to} to={to}><Icon aria-hidden/><span>{label}</span></Link>)}</nav>;
}
