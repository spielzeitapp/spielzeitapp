import { useMemo } from 'react';
import { useSession } from '../auth/useSession';
import {
  formatTeamSeasonContextLabel,
  formatTeamSeasonDisplayLabel,
  isSeasonArchived,
  resolveTeamSeasonLabelParts,
  SEASON_SOFT_LOCK_MESSAGE,
} from '../lib/seasonLifecycle';

/**
 * Liest aktive + View-Saison aus SessionProvider.
 * Reads (Termine/Kader/Stats-Anzeige) → viewTeamSeasonId
 * Writes → selectedTeamSeasonId (active) + Soft-Lock
 */
export function useActiveTeamSeason() {
  const {
    loading,
    membershipError,
    selectedTeamSeasonId,
    selectedTeamSeason,
    selectedMembership,
    viewTeamSeasonId,
    viewTeamSeason,
    viewTeamSeasonLoading,
    viewTeamSeasonError,
    setViewTeamSeasonId,
    setSelectedTeamSeasonId,
    teamSeasons,
    effectiveRole,
    memberships,
  } = useSession();

  const activeTeamSeasonId = selectedTeamSeasonId;
  const readTeamSeasonId = viewTeamSeasonId ?? selectedTeamSeasonId;
  const readTeamSeason = viewTeamSeasonId ? viewTeamSeason : selectedTeamSeason;
  const isReadOnlyView = Boolean(readTeamSeasonId && readTeamSeasonId !== selectedTeamSeasonId);

  const labelParts = useMemo(() => {
    if (!readTeamSeason) return null;
    return resolveTeamSeasonLabelParts({
      displayName: readTeamSeason.display_name,
      ageGroup: readTeamSeason.age_group,
      teamName: readTeamSeason.team?.name,
      seasonName: readTeamSeason.season?.name,
      status: readTeamSeason.status,
    });
  }, [readTeamSeason]);

  const teamLabel = readTeamSeason
    ? formatTeamSeasonContextLabel({
        displayName: readTeamSeason.display_name,
        ageGroup: readTeamSeason.age_group,
        teamName: readTeamSeason.team?.name,
        seasonName: readTeamSeason.season?.name,
        status: readTeamSeason.status,
      })
    : (labelParts?.full ?? null);
  const teamLine = labelParts?.teamLine ?? null;
  const seasonLine = labelParts?.seasonLine ?? null;

  const isViewingArchive = Boolean(readTeamSeason && isSeasonArchived(readTeamSeason.status));
  const isHistoryReadOnly = isViewingArchive;

  const readMembership = memberships.find(membership => membership.team_season_id === readTeamSeasonId);
  const roleRaw = (isReadOnlyView ? readMembership?.role ?? 'fan' : effectiveRole ?? '').toString().trim().toLowerCase();
  const role = roleRaw !== '' ? roleRaw : null;

  return {
    /** @deprecated Prefer readTeamSeasonId for reads / activeTeamSeasonId for writes */
    teamSeasonId: readTeamSeasonId,
    readTeamSeasonId,
    activeTeamSeasonId,
    viewTeamSeasonId: readTeamSeasonId,
    setViewTeamSeasonId,
    setSelectedTeamSeasonId,
    teamSeasons,
    teamLabel,
    teamLine,
    seasonLine,
    selectedTeamSeason: readTeamSeason,
    /** Explizite Lesesaison (View oder Active). */
    readTeamSeason,
    activeTeamSeason: selectedTeamSeason,
    selectedMembership,
    role,
    isReadOnlyView,
    loading: loading || Boolean(viewTeamSeasonLoading),
    error: viewTeamSeasonError ?? membershipError,
    isViewingArchive,
    isHistoryReadOnly,
    softLockMessage: isHistoryReadOnly ? SEASON_SOFT_LOCK_MESSAGE : null,
    teamLabelWithStatus: readTeamSeason
      ? formatTeamSeasonContextLabel(
          {
            displayName: readTeamSeason.display_name,
            ageGroup: readTeamSeason.age_group,
            teamName: readTeamSeason.team?.name,
            seasonName: readTeamSeason.season?.name,
            status: readTeamSeason.status,
          },
          { markArchived: true },
        )
      : null,
  };
}
