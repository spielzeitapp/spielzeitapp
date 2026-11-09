import { ManagerAppearanceToggle, useManagerAppearance } from '../appearance/ManagerAppearance';
import { managerSurfaceHref } from '../../lib/managerComparison';
import { TeamSwitcher } from '../../app/components/TeamSwitcher';
import { ManagerComparisonPlatformContextSelect } from './ManagerComparisonPlatformContextSelect';
import {ManagerReferenceContextSelect} from '../modern/ManagerReferenceContextSelect';
import {centralPage} from '../modern/centralWorkspace';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Headphones, X, Menu, Bell, ChevronRight } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useProfile, getDisplayFirstName, profileDisplayName } from '../../auth/useProfile';
import { useSession } from '../../auth/useSession';
import {resolveTeamSeasonSwitcherAction} from '../../lib/seasonLifecycle';
import { useManagerWorkMode } from '../ManagerWorkModeContext';
import { MANAGER_TO_APP_HOME_PATH } from './ManagerSidebar';

type Props = {
  onOpenSidebar: () => void;
};

/**
 * Header mit Verein/Team/Saison-Kontext (bestehende Session-Zuordnung).
 */
export function ManagerComparisonHeader({ onOpenSidebar }: Props): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { clubName } = useManagerAppearance();
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const updateHeight = () => setHeaderHeight(header.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const { user: authUser } = useAuth();
  const {
    teamSeasons,
    selectedTeamSeasonId,
    setSelectedTeamSeasonId,
    viewTeamSeasonId,
    setViewTeamSeasonId,
    signOut,
    membershipRole,
    backendRole,
  } = useSession();
  const {
    contextTeamSeasons,
    availableModes,
    setWorkMode,
    isTrainerMode,
    isAdministrationMode,
    workMode,
    selectTrainerTeamSeasonId,
    supportSession,
    endSupportSession,
  } = useManagerWorkMode();
  const { profile } = useProfile(authUser?.id);

  // Administration may select existing memberships even outside club support.
  // Trainer and support modes must never fall back to unrelated memberships.
  const headerTeamSeasons = isTrainerMode || supportSession || contextTeamSeasons.length > 0
    ? contextTeamSeasons
    : teamSeasons;

  const displayName =
    getDisplayFirstName(profile) ??
    profileDisplayName(profile) ??
    (authUser?.email ? authUser.email.split('@')[0] : null) ??
    'Trainer';

  const selectValue = viewTeamSeasonId ?? selectedTeamSeasonId ?? '';

  const onContextChange = (raw: string) => {
    const id = raw || null;
    if (!id) {
      setViewTeamSeasonId(null);
      return;
    }
    const ts = headerTeamSeasons.find((row) => row.id === id);
    if (!ts) return;
    // Leave season-bound forms before changing their work scope.
    navigate('/manager');
    if (isTrainerMode) {
      selectTrainerTeamSeasonId(id);
      const action = resolveTeamSeasonSwitcherAction(ts.status);
      if (action === 'select-work') {
        setSelectedTeamSeasonId(id);
      } else {
        setViewTeamSeasonId(id);
      }
      return;
    }
    const action = resolveTeamSeasonSwitcherAction(ts.status);
    if (action === 'select-work') {
      setSelectedTeamSeasonId(id);
      return;
    }
    setViewTeamSeasonId(id);
  };

  const onLogout = async () => {
    await signOut();
    navigate('/manager/login?next=%2Fmanager%3Fentry%3Dplatform', { replace: true });
  };

  const roleHint = isTrainerMode
    ? (membershipRole || 'trainer').trim()
    : isAdministrationMode && workMode === 'platform_admin'
      ? 'ADMIN'
      : isAdministrationMode
        ? 'Vereinsadmin'
        : (membershipRole || backendRole || '').trim();
  const mobileRoleLabel = roleHint === 'Plattformadmin' ? 'Admin' : roleHint.replace(/_/g, ' ');

  return <>
    <div aria-hidden className="shrink-0 md:hidden" style={{height:headerHeight||148}} />
    <header ref={headerRef} className="manager-header szc-reference-header fixed inset-x-0 top-0 z-30 shrink-0 pt-[env(safe-area-inset-top)] md:sticky md:inset-x-auto">
      <div className="szc-topbar"><div className="szc-breadcrumb"><button type="button" className="szc-mobileMenu szc-icon" aria-label="Navigation öffnen" onClick={onOpenSidebar}><Menu size={20}/></button><span>Workspace</span><ChevronRight size={13}/><strong>{centralPage(location.pathname,location.search).label}</strong></div>
       <div className="szc-topRight"><span className="szc-connection"><i/>TEST · Gemeinsame Daten</span><ManagerAppearanceToggle/><Link className="szc-icon" to="/manager/nachrichten" aria-label="Benachrichtigungen"><Bell size={18}/></Link><details className="manager-tools-menu"><summary className="szc-avatar" aria-label="Profil und Manager-Aktionen">{displayName.slice(0,2).toUpperCase()}</summary><div className="manager-tools-popover"><p>{displayName} · {mobileRoleLabel}</p><Link to="/manager/mehr">Profil & Einstellungen</Link><div className="manager-tools-favorites"><span>Favoriten</span><TeamSwitcher iconOnly openInApp/></div><a href={managerSurfaceHref(`${location.pathname}${location.search}${location.hash}`, false)} target="_blank" rel="noopener noreferrer">Bisherige Ansicht · gleiche Daten ↗</a><Link to={MANAGER_TO_APP_HOME_PATH}>Zur SpielzeitApp ↗</Link><button type="button" onClick={()=>void onLogout()}>Abmelden</button></div></details></div>
      </div>
      <div className="szc-context">{workMode==='platform_admin'&&!supportSession?<ManagerComparisonPlatformContextSelect/>:<ManagerReferenceContextSelect seasons={headerTeamSeasons} value={selectValue} onSelect={onContextChange} clubName={clubName}/>}
       <div className="szc-contextEnd">{availableModes.length>1&&!supportSession?<label className="szc-selector"><span>ARBEITSMODUS</span><select aria-label="Arbeitsmodus" value={workMode} onChange={e=>setWorkMode(e.target.value as typeof workMode)}>{availableModes.map(mode=><option key={mode} value={mode}>{mode==='platform_admin'?'Plattformadmin':mode==='club_admin'?'Vereinsadmin':'Trainer'}</option>)}</select></label>:<span>{mobileRoleLabel}</span>}</div>
      </div>
      {supportSession&&<div className="szc-support"><span><Headphones size={15}/>Vereinsverwaltung: <strong>{supportSession.clubName}</strong></span><button type="button" onClick={endSupportSession}><X size={14}/>{supportSession.returnPath?'Zur Vereinsübersicht':'Zur Plattformverwaltung'}</button></div>}
    </header>
  </>;
}
