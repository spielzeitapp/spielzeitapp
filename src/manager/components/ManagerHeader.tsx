import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, LogOut } from 'lucide-react';
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
  } = useManagerWorkMode();
  const { profile } = useProfile(authUser?.id);

  const headerTeamSeasons = contextTeamSeasons.length > 0 ? contextTeamSeasons : teamSeasons;

  const displayName =
    getDisplayFirstName(profile) ??
    profileDisplayName(profile) ??
    (authUser?.email ? authUser.email.split('@')[0] : null) ??
    'Trainer';

  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
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
      <div className="flex min-h-[72px] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 lg:px-8 xl:px-10 2xl:px-12">
        <ManagerMenuButton onClick={onOpenSidebar} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-bold tracking-tight text-white sm:text-[20px]">Manager</p>
          <p className="truncate text-[11px] text-white/45 sm:hidden">{contextLine}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Link
            to={MANAGER_TO_APP_HOME_PATH}
            className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[12px] font-semibold text-white shadow-sm hover:bg-white/10 lg:hidden"
            aria-label="Zur SpielzeitApp"
            title="Zur SpielzeitApp"
          >
            <AppHomeIcon className="h-4 w-4 shrink-0 object-contain" />
            <span className="hidden min-[380px]:inline">Zur App</span>
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

          {canSwitchMode ? (
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
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[12px] font-semibold text-white/80 shadow-sm hover:bg-white/10 hover:text-white sm:px-3"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </div>

      {headerTeamSeasons.length > 1 ? (
        <div className="border-t border-white/10 px-3 py-2 sm:hidden">
          <select
            value={selectValue}
            onChange={(e) => onContextChange(e.target.value)}
            className="manager-header-select w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-[12px] font-medium text-white"
            aria-label="Team und Saison wählen"
          >
            {headerTeamSeasons.map((ts) => (
              <option key={ts.id} value={ts.id}>
                {labelForTeamSeason(ts)}
              </option>
            ))}
          </select>
          {canSwitchMode ? (
            <button
              type="button"
              onClick={() => {
                if (isTrainerMode) switchToAdministration();
                else switchToTrainer();
              }}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-[12px] font-semibold text-white/80"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
              {isTrainerMode ? adminSwitchButtonLabel : 'Als Trainer arbeiten'}
            </button>
          ) : null}
        </div>
      ) : canSwitchMode ? (
        <div className="border-t border-white/10 px-3 py-2 sm:hidden">
          <button
            type="button"
            onClick={() => {
              if (isTrainerMode) switchToAdministration();
              else switchToTrainer();
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-[12px] font-semibold text-white/80"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
            {isTrainerMode ? adminSwitchButtonLabel : 'Als Trainer arbeiten'}
          </button>
        </div>
      ) : null}
    </header>
  );
}
