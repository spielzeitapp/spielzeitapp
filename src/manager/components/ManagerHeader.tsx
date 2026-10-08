import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Headphones, LogOut, UserRound, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useProfile, getDisplayFirstName, profileDisplayName } from '../../auth/useProfile';
import { useSession, type SessionTeamSeasonItem } from '../../auth/useSession';
import {
  formatTeamSeasonContextLabel,
  formatTeamSeasonCompactSwitcherLabel,
  getSeasonStatusLabel,
  isSeasonActive,
  isSeasonArchived,
  resolveTeamSeasonSwitcherAction,
} from '../../lib/seasonLifecycle';
import { useManagerWorkMode } from '../ManagerWorkModeContext';
import { MANAGER_TO_APP_HOME_PATH, ManagerMenuButton } from './ManagerSidebar';
import { dsGlassIconButtonClass, dsTrainerPillClass } from '../../lib/premiumDesignSystem';

type Props = {
  onOpenSidebar: () => void;
};

function labelForTeamSeason(ts: SessionTeamSeasonItem): string {
  return formatTeamSeasonCompactSwitcherLabel(
    {
      displayName: ts.display_name,
      ageGroup: ts.age_group,
      teamName: ts.team?.name,
      seasonName: ts.season?.name,
      status: ts.status,
    },
    {
      markArchived: true,
      markCurrent: isSeasonActive(ts.status),
    },
  );
}

/**
 * Header mit Verein/Team/Saison-Kontext (bestehende Session-Zuordnung).
 */
export function ManagerHeader({ onOpenSidebar }: Props): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
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
    selectedTeamSeason,
    setSelectedTeamSeasonId,
    viewTeamSeasonId,
    viewTeamSeason,
    setViewTeamSeasonId,
    signOut,
    membershipRole,
    backendRole,
    loading: sessionLoading,
  } = useSession();
  const {
    contextTeamSeasons,
    canSwitchMode,
    isTrainerMode,
    isAdministrationMode,
    switchToAdministration,
    switchToTrainer,
    adminSwitchButtonLabel,
    workMode,
    selectTrainerTeamSeasonId,
    supportSession,
    endSupportSession,
  } = useManagerWorkMode();
  const { profile } = useProfile(authUser?.id);

  const platformGlobal = workMode === 'platform_admin' && !supportSession;
  const headerTeamSeasons = platformGlobal
    ? []
    : contextTeamSeasons.length > 0
      ? contextTeamSeasons
      : teamSeasons;

  const displayName =
    getDisplayFirstName(profile) ??
    profileDisplayName(profile) ??
    (authUser?.email ? authUser.email.split('@')[0] : null) ??
    'Trainer';

  const supportContextSeason = supportSession?.teamSeasons.find(
    (season) => season.id === (viewTeamSeasonId ?? selectedTeamSeasonId),
  ) ?? supportSession?.teamSeasons[0] ?? null;
  const contextSeason = supportContextSeason ?? viewTeamSeason ?? selectedTeamSeason;
  const contextLine = useMemo(() => {
    if (!contextSeason) return sessionLoading ? 'Kontext wird geladen…' : 'Kein Team ausgewählt';
    const status = getSeasonStatusLabel(contextSeason.status);
    const archived = isSeasonArchived(contextSeason.status);
    const base = formatTeamSeasonContextLabel(
      {
        displayName: contextSeason.display_name,
        ageGroup: contextSeason.age_group,
        teamName: contextSeason.team?.name,
        seasonName: contextSeason.season?.name,
        status: contextSeason.status,
      },
      { includeSeason: true },
    );
    return archived
      ? `${base} (${status})`
      : base;
  }, [contextSeason, sessionLoading]);

  const selectValue = viewTeamSeasonId ?? selectedTeamSeasonId ?? '';

  const onContextChange = (raw: string) => {
    const id = raw || null;
    if (!id) {
      setViewTeamSeasonId(null);
      return;
    }
    const ts = headerTeamSeasons.find((row) => row.id === id);
    if (!ts) return;
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
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    navigate(`/manager/login?next=${next}`, { replace: true });
  };

  const roleHint = isTrainerMode
    ? (membershipRole || 'trainer').trim()
    : isAdministrationMode && workMode === 'platform_admin'
      ? 'ADMIN'
      : isAdministrationMode
        ? 'Vereinsadmin'
        : (membershipRole || backendRole || '').trim();
  const mobileRoleLabel = roleHint === 'Plattformadmin' ? 'Admin' : roleHint.replace(/_/g, ' ');

  return (
    <>
    <div aria-hidden className="shrink-0 sm:hidden" style={{ height: headerHeight || 'calc(60px + env(safe-area-inset-top))' }} />
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-30 shrink-0 border-b border-white/10 bg-[#060608] text-white shadow-[0_10px_32px_-8px_rgba(0,0,0,0.65)] pt-[env(safe-area-inset-top)] sm:sticky sm:inset-x-auto sm:bg-[#090909]/[0.98] sm:shadow-none sm:backdrop-blur-md">
      <div className="relative flex min-h-[60px] items-center gap-2 px-3 py-2 sm:min-h-[72px] sm:gap-3 sm:py-2.5 sm:px-5 lg:px-8 xl:px-10 2xl:px-12">
        <ManagerMenuButton onClick={onOpenSidebar} />

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          <img src="/manager-icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl sm:hidden" />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-black tracking-tight text-white sm:hidden">Spielzeit <span className="text-red-400">Manager</span></p>
            <p className="hidden truncate text-[18px] font-bold tracking-tight text-white sm:block sm:text-[20px]">Manager</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="mr-1 flex items-start gap-3 sm:hidden">
            <Link
              to={MANAGER_TO_APP_HOME_PATH}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-[#141416] shadow-[0_4px_16px_rgba(0,0,0,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label="Zurück zur SpielzeitApp"
              title="Zurück zur SpielzeitApp"
            >
              <img src="/icon-192.png" alt="" className="h-[52px] w-[52px] shrink-0 rounded-full object-contain" />
            </Link>
            <div className="flex flex-col items-end gap-0.5">
              <Link to="/manager/mehr" className={dsGlassIconButtonClass()} aria-label="Profil und Einstellungen">
                <UserRound className="h-[1.1rem] w-[1.1rem]" />
              </Link>
              {roleHint ? (
                <span className={`${dsTrainerPillClass()} !max-w-none !px-2`} title={roleHint.replace(/_/g, ' ')}>
                  {mobileRoleLabel}
                </span>
              ) : null}
            </div>
          </div>

          {headerTeamSeasons.length > 1 ? (
            <label className="hidden min-w-0 sm:block">
              <span className="sr-only">Team und Saison wählen</span>
              <select
                value={selectValue}
                onChange={(e) => onContextChange(e.target.value)}
                className="manager-header-select max-w-[14rem] truncate rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-[12px] font-semibold text-white shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 lg:max-w-[20rem]"
              >
                {headerTeamSeasons.map((ts) => (
                  <option key={ts.id} value={ts.id}>
                    {labelForTeamSeason(ts)}
                  </option>
                ))}
              </select>
            </label>
          ) : contextSeason ? (
            <div className="hidden max-w-[20rem] truncate rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-[12px] font-semibold text-white sm:block">
              {contextLine}
            </div>
          ) : null}

          {canSwitchMode && !supportSession ? (
            <button
              type="button"
              onClick={() => {
                if (isTrainerMode) switchToAdministration();
                else switchToTrainer();
              }}
              className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-[11px] font-semibold text-white/80 shadow-sm hover:bg-white/10 sm:inline-flex"
              title={isTrainerMode ? adminSwitchButtonLabel : 'Als Trainer arbeiten'}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
              <span className="max-w-[9rem] truncate">
                {isTrainerMode ? adminSwitchButtonLabel : 'Als Trainer arbeiten'}
              </span>
            </button>
          ) : null}

          <div className="hidden text-right md:block">
            <p className="truncate text-[13px] font-semibold text-white">{displayName}</p>
            {roleHint ? (
              <p className="truncate text-[11px] capitalize text-white/45">{roleHint.replace(/_/g, ' ')}</p>
            ) : null}
          </div>

          <div
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/70 bg-red-600 text-[14px] font-bold text-white shadow-sm sm:flex"
            aria-hidden
            title={displayName}
          >
            {displayName.trim().charAt(0).toUpperCase() || 'T'}
          </div>

          <button
            type="button"
            onClick={() => void onLogout()}
            className="hidden h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[12px] font-semibold text-white/80 shadow-sm hover:bg-white/10 hover:text-white sm:inline-flex sm:px-3"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </div>

      {supportSession ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-300/30 bg-amber-400 px-3 py-2 text-[12px] font-medium text-slate-950 sm:px-5 lg:px-8 xl:px-10 2xl:px-12">
          <span className="inline-flex items-center gap-2">
            <Headphones className="h-4 w-4" aria-hidden />
            Supportmodus: <strong>{supportSession.clubName}</strong> · Änderungen werden als Plattformadmin protokolliert.
          </span>
          <button
            type="button"
            onClick={endSupportSession}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-900/20 bg-white/70 px-3 font-semibold hover:bg-white"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Support beenden
          </button>
        </div>
      ) : null}

      {headerTeamSeasons.length > 1 ? (
        <div className="border-t border-white/10 px-3 py-1.5 sm:hidden">
          <select
            value={selectValue}
            onChange={(e) => onContextChange(e.target.value)}
            className="manager-header-select min-h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white"
            aria-label="Team und Saison wählen"
          >
            {headerTeamSeasons.map((ts) => (
              <option key={ts.id} value={ts.id}>
                {labelForTeamSeason(ts)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </header>
    </>
  );
}
