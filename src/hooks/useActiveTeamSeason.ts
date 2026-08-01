import { useMemo } from 'react';
import { useSession } from '../auth/useSession';
import { formatTeamSeasonDisplayLabel, resolveTeamSeasonLabelParts } from '../lib/seasonLifecycle';

/**
 * Liest aktive Team-Saison und Rolle **nur** aus SessionProvider (kein zweiter Membership-Fetch).
 * Muss innerhalb von SessionProvider verwendet werden.
 */
export function useActiveTeamSeason() {
  const {
    loading,
    membershipError,
    selectedTeamSeasonId,
    selectedTeamSeason,
    selectedMembership,
    effectiveRole,
  } = useSession();

  const teamSeasonId = selectedTeamSeasonId;

  const labelParts = useMemo(() => {
    if (!selectedTeamSeason) return null;
    return resolveTeamSeasonLabelParts({
      displayName: selectedTeamSeason.display_name,
      ageGroup: selectedTeamSeason.age_group,
      teamName: selectedTeamSeason.team?.name,
      seasonName: selectedTeamSeason.season?.name,
      status: selectedTeamSeason.status,
    });
  }, [selectedTeamSeason]);

  const teamLabel = useMemo(() => {
    if (labelParts) return labelParts.full;
    return null;
  }, [labelParts]);

  const teamLine = labelParts?.teamLine ?? null;
  const seasonLine = labelParts?.seasonLine ?? null;

  const roleRaw = (effectiveRole ?? '').toString().trim().toLowerCase();
  const role = roleRaw !== '' ? roleRaw : null;

  return {
    teamSeasonId,
    teamLabel,
    teamLine,
    seasonLine,
    selectedTeamSeason,
    selectedMembership,
    role,
    loading,
    error: membershipError,
    /** Volles Label inkl. Archiv-Markierung (für Picker-ähnliche Anzeigen). */
    teamLabelWithStatus: selectedTeamSeason
      ? formatTeamSeasonDisplayLabel(
          {
            displayName: selectedTeamSeason.display_name,
            ageGroup: selectedTeamSeason.age_group,
            teamName: selectedTeamSeason.team?.name,
            seasonName: selectedTeamSeason.season?.name,
            status: selectedTeamSeason.status,
          },
          { markArchived: true },
        )
      : null,
  };
}
