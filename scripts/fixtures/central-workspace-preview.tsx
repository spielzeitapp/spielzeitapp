// Development-only full-shell inspection. All values below are EXAMPLE DATA.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {ManagerCentralWorkspace} from '../../src/manager/modern/ManagerCentralWorkspace';
import {ManagerReferenceDashboard} from '../../src/manager/modern/ManagerReferenceDashboard';
import {ManagerReferenceSidebar} from '../../src/manager/modern/ManagerReferenceSidebar';
import {ManagerComparisonHeader} from '../../src/manager/components/ManagerComparisonHeader';
import {clubAppearance} from '../../src/manager/appearance/clubAppearance';
const query=new URLSearchParams(location.search),mode=query.get('mode')==='day'?'day':'night',melk=query.get('club')==='melk';
const palette=clubAppearance(melk?'#164A9D':'#111114',melk?'#F5C400':'#FFFFFF',melk?'#F5C400':'#E6E8EB',mode);
function Preview(){const [open,setOpen]=useState(false);return <div data-manager-modern="true" data-manager-appearance={mode} className="szc-app manager-club-workspace flex min-w-0 w-full" style={{minHeight:'100vh','--manager-club-primary':palette.primary,'--manager-club-secondary':palette.secondary,'--manager-action':palette.accent,'--manager-accent-soft':'color-mix(in srgb,var(--manager-action) 12%,var(--manager-surface))','--manager-on-action':palette.onAccent,'--manager-link':palette.link,'--accent':palette.accent,'--secondary':palette.primary,'--accent-ink':palette.onAccent} as React.CSSProperties}>
 <ManagerReferenceSidebar open={open} onClose={()=>setOpen(false)}/><div className="flex min-w-0 flex-1 flex-col"><ManagerComparisonHeader onOpenSidebar={()=>setOpen(true)}/><main className="manager-mobile-workspace"><div className="manager-shell__content"><p style={{fontSize:10,marginBottom:12,color:'var(--manager-muted)'}}>UI-PRÜFUNG · BEISPIELDATEN</p><ManagerCentralWorkspace><ManagerReferenceDashboard/></ManagerCentralWorkspace></div></main></div></div>;}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/manager']}><Preview/></MemoryRouter>);
