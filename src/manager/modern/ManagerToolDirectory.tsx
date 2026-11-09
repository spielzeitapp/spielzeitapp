import React, {useState} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {ArrowUpRight, Search, ChevronRight} from 'lucide-react';
import {useManagerWorkMode} from '../ManagerWorkModeContext';
import {useManagerClubModules} from '../ManagerClubModulesContext';
import {useCommunicationAccess} from '../CommunicationAccessContext';
import {isStagingApp} from '../../lib/appEnvironment';
import {managerSurfaceHref} from '../../lib/managerComparison';
import {centralToolsForContext, searchCentralTools} from './centralWorkspace';

/** The same live catalogue as desktop navigation; no second mobile feature list. */
export function ManagerToolDirectory({fotoboxTo}: {fotoboxTo?: string} = {}) {
  const {workMode, supportSession} = useManagerWorkMode();
  const {isModuleEnabled} = useManagerClubModules();
  const {access} = useCommunicationAccess();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const tools = centralToolsForContext({mode:workMode, support:Boolean(supportSession), staging:isStagingApp(), isModuleEnabled, speaker:access.speaker, music:access.music});
  const results = searchCentralTools(tools, query);
  const sections = [...new Set(results.map(tool => tool.section))];
  return <section className="central-tool-directory" aria-label="Alle verfügbaren Managerfunktionen">
    <div className="central-directory-heading"><h2>Alle Funktionen</h2><span>{tools.length} freigegeben</span></div>
    <label className="central-directory-search"><Search size={18} aria-hidden/><span className="sr-only">Managerfunktionen durchsuchen</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Kader, Fotos, ÖFB, Training …"/></label>
    {sections.map(section => <section className="central-directory-section" key={section}><h3>{section}</h3><div className="central-directory-grid">{results.filter(tool => tool.section === section).map(tool => <Link key={tool.id} to={tool.id === 'fotobox' && fotoboxTo ? fotoboxTo : tool.to!}><span>{tool.label}</span><ChevronRight size={18} aria-hidden/></Link>)}</div></section>)}
    {!results.length && <p role="status">Kein passender Bereich gefunden.</p>}
    <footer className="central-directory-footer">
      <a href={managerSurfaceHref(`${location.pathname}${location.search}${location.hash}`, false)}>Bisherige Ansicht · gleiche Daten <ArrowUpRight size={16} aria-hidden/></a>
      <a href="/app/home">Zur SpielzeitApp <ArrowUpRight size={16} aria-hidden/></a>
      <a href="/manager-install.html">Manager-Icon hinzufügen <ArrowUpRight size={16} aria-hidden/></a>
    </footer>
  </section>;
}
