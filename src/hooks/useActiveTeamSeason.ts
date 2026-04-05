import { useMemo } from 'react';
import {
  useSession,
  getTeamNameFromMembership,
  getSeasonLabelFromMembership,
} from '../auth/useSession';

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

  const teamLabel = useMemo(() => {
    const ts = selectedTeamSeason;
    if (ts) {
      const teamName = (ts.team?.name ?? '').trim() || 'Team';
      const seasonName = (ts.season?.name ?? '').trim();
      return seasonName !== '' ? `${teamName} (${seasonName})` : teamName;
    }
    const t = getTeamNameFromMembership(selectedMembership)?.trim();
    const s = getSeasonLabelFromMembership(selectedMembership)?.trim();
    if (t && s && s !== '—') return `${t} (${s})`;
    if (t) return t;
    return null;
  }, [selectedTeamSeason, selectedMembership]);

  const roleRaw = (effectiveRole ?? '').toString().trim().toLowerCase();
  const role = roleRaw !== '' ? roleRaw : null;

  return {
    teamLabel,
    teamSeasonId,
    role,
    loading,
    error: membershipError,
  };
}
