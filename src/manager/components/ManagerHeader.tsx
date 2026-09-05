import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { AppHomeIcon, MANAGER_TO_APP_HOME_PATH, ManagerMenuButton } from './ManagerSidebar';
import spielzeitappHeader from '../../assets/branding/spielzeitapp-header.png';

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
    navigate('/login', { replace: true });
  };

  const roleHint = isTrainerMode
    ? (membershipRole || 'trainer').trim()
    : isAdministrationMode && workMode === 'platform_admin'
      ? 'Plattformadmin'
      : isAdministrationMode
        ? 'Vereinsadmin'
        : (membershipRole || backendRole || '').trim();

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#090909]/[0.98] text-white backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="relative flex min-h-[72px] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 lg:px-8 xl:px-10 2xl:px-12">
        <div className="hidden sm:block"><ManagerMenuButton onClick={onOpenSidebar} /></div>

        <div className="min-w-0 flex-1">
          <img src={spielzeitappHeader} alt="SpielzeitApp" className="h-10 w-[10.2rem] max-w-[48vw] object-cover object-[50%_32%] sm:hidden" />
          <p className="hidden truncate text-[18px] font-bold tracking-tight text-white sm:block sm:text-[20px]">Manager</p>
          <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/60 sm:hidden">Manager · {roleHint.replace(/_/g, ' ')}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Link
            to={MANAGER_TO_APP_HOME_PATH}
            className="hidden h-11 min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[12px] font-semibold text-white shadow-sm hover:bg-white/10 sm:inline-flex lg:hidden"
            aria-label="Zur SpielzeitApp"
            title="Zur SpielzeitApp"
          >
            <AppHomeIcon className="h-4 w-4 shrink-0 object-contain" />
            <span className="hidden min-[380px]:inline">Zur App</span>
          </Link>

          <Link to="/manager/mehr" className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 sm:hidden" aria-label="Profil und Einstellungen">
            <UserRound className="h-5 w-5" />
          </Link>

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
        <div className="border-t border-white/10 px-3 py-2 sm:hidden">
          <select
            value={selectValue}
            onChange={(e) => onContextChange(e.target.value)}
            className="manager-header-select w-full rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[12px] font-semibold text-white"
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
  );
}
