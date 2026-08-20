import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ManagerMenuButton } from './ManagerSidebar';

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
    <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-5 lg:px-8 xl:px-10 2xl:px-12">
        <ManagerMenuButton onClick={onOpenSidebar} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Arbeitskontext
          </p>
          <p className="truncate text-[15px] font-semibold text-slate-900 sm:text-[16px]">{contextLine}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {headerTeamSeasons.length > 1 ? (
            <label className="hidden min-w-0 sm:block">
              <span className="sr-only">Team und Saison wählen</span>
              <select
                value={selectValue}
                onChange={(e) => onContextChange(e.target.value)}
                className="max-w-[14rem] truncate rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-800 shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 lg:max-w-[18rem]"
              >
                {headerTeamSeasons.map((ts) => (
                  <option key={ts.id} value={ts.id}>
                    {labelForTeamSeason(ts)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {canSwitchMode ? (
            <button
              type="button"
              onClick={() => {
                if (isTrainerMode) switchToAdministration();
                else switchToTrainer();
              }}
              className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:inline-flex"
              title={isTrainerMode ? adminSwitchButtonLabel : 'Als Trainer arbeiten'}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
              <span className="max-w-[9rem] truncate">
                {isTrainerMode ? adminSwitchButtonLabel : 'Als Trainer arbeiten'}
              </span>
            </button>
          ) : null}

          <div className="hidden text-right md:block">
            <p className="truncate text-[13px] font-semibold text-slate-800">{displayName}</p>
            {roleHint ? (
              <p className="truncate text-[11px] capitalize text-slate-400">{roleHint.replace(/_/g, ' ')}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void onLogout()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:px-3"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </div>

      {headerTeamSeasons.length > 1 ? (
        <div className="border-t border-slate-100 px-3 py-2 sm:hidden">
          <select
            value={selectValue}
            onChange={(e) => onContextChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-800"
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
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
              {isTrainerMode ? adminSwitchButtonLabel : 'Als Trainer arbeiten'}
            </button>
          ) : null}
        </div>
      ) : canSwitchMode ? (
        <div className="border-t border-slate-100 px-3 py-2 sm:hidden">
          <button
            type="button"
            onClick={() => {
              if (isTrainerMode) switchToAdministration();
              else switchToTrainer();
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-700"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
            {isTrainerMode ? adminSwitchButtonLabel : 'Als Trainer arbeiten'}
          </button>
        </div>
      ) : null}
    </header>
  );
}
