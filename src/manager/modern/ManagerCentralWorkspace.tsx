import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Search, Database, X } from 'lucide-react';
import { useManagerWorkMode } from '../ManagerWorkModeContext';
import { useManagerClubModules } from '../ManagerClubModulesContext';
import { useCommunicationAccess } from '../CommunicationAccessContext';
import { isStagingApp } from '../../lib/appEnvironment';
import { centralPage, centralToolsForContext, searchCentralTools, relatedCentralTools } from './centralWorkspace';

export function ManagerCentralWorkspace({children}:{children:React.ReactNode}) {
  const {pathname,search}=useLocation();
  const {workMode,supportSession}=useManagerWorkMode();
  const {isModuleEnabled}=useManagerClubModules();
  const {access}=useCommunicationAccess();
  const [query,setQuery]=useState('');
  const page=centralPage(pathname,search);
  const tools=centralToolsForContext({mode:workMode,support:Boolean(supportSession),staging:isStagingApp(),isModuleEnabled,speaker:access.speaker,music:access.music});
  const results=searchCentralTools(tools,query);
  const related=relatedCentralTools(tools,pathname,page.section);
  return <div className="central-workspace" data-central-section={page.section}>
    <div className="central-workspace-toolbar">
      <nav aria-label="Pfad in der Vereinszentrale" className="central-breadcrumb">
        <Link to={workMode==='platform_admin'&&!supportSession?'/manager/plattform':'/manager'}>Zentrale</Link>
        <ChevronRight size={14} aria-hidden/><span>{page.label}</span>
      </nav>
      <details className="central-tool-search" key={pathname+search}>
        <summary aria-label="Bereich suchen"><Search size={16} aria-hidden/><span>Bereich suchen</span></summary>
        <div className="central-tool-search-panel">
          <label htmlFor="central-tool-query">Alle freigegebenen Funktionen</label>
          <div className="central-search-input"><Search size={16} aria-hidden/><input id="central-tool-query" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Kader, Training, Fotos …"/>{query&&<button type="button" aria-label="Suche leeren" onClick={()=>setQuery('')}><X size={16}/></button>}</div>
          <div className="central-tool-results">{results.map(tool=><Link key={tool.id} to={tool.to!}><span>{tool.label}</span><small>{tool.section}</small><ChevronRight size={14} aria-hidden/></Link>)}{!results.length&&<p role="status">Kein passender Bereich gefunden.</p>}</div>
        </div>
      </details>
    </div>
    {related.length>1&&<nav className="central-section-tabs" aria-label={page.section+' – Bereiche'}>{related.map(tool=><Link key={tool.id} to={tool.to!} aria-current={page.id===tool.id||(page.id==='detail'&&pathname.startsWith(tool.to!.split('?')[0]+'/'))?'page':undefined}>{tool.label}</Link>)}</nav>}
    <p className="central-data-note"><Database size={13} aria-hidden/>{isStagingApp()?'Gemeinsamer TEST-Datenstand':'Gemeinsamer Datenstand'} · Änderungen sind auch im bisherigen Manager sichtbar.</p>
    <div className="central-page-content">{children}</div>
  </div>;
}
