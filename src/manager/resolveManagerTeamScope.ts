import type { SessionContextValue, SessionTeamSeasonItem } from '../auth/useSession';
import { normalizeRole } from '../lib/roles';
import type { ManagerWorkMode } from './managerWorkMode';

/** A UI scope only. Supabase continues to enforce the signed-in user's permissions. */
export function resolveManagerTeamScope(session: SessionContextValue, mode: ManagerWorkMode, seasons: SessionTeamSeasonItem[]): SessionContextValue | null {
  const readId = session.viewTeamSeasonId ?? session.selectedTeamSeasonId;
  const readSeason = seasons.find(season => season.id === readId);
  if (!readSeason) return null;
  const membership = session.memberships.find(row => row.team_season_id === readSeason.id) ?? null;
  const memberRole = normalizeRole(membership?.role);
  const platformAdmin = mode === 'platform_admin' && normalizeRole(session.backendRole) === 'admin';
  const allowed = platformAdmin || (mode === 'trainer' && memberRole === 'trainer') || (mode === 'club_admin' && memberRole === 'admin');
  if (!allowed) return null;
  const role = platformAdmin || mode === 'club_admin' ? 'admin' : 'trainer';
  const activeSeason = seasons.find(season => season.id === session.selectedTeamSeasonId) ?? null;
  return {
    ...session,
    teamSeasons: seasons,
    selectedTeamId: String(readSeason.team?.id ?? readSeason.team_id ?? session.selectedTeamId),
    selectedTeamSeason: activeSeason,
    viewTeamSeasonId: readSeason.id,
    viewTeamSeason: readSeason,
    teamViewFilter: null,
    filteredTeamSeasonIds: [readSeason.id],
    effectiveRole: role,
    role,
    user: session.user ? { ...session.user, role } : null,
    selectedMembership: membership,
    membershipRole: membership?.role ?? null,
    previewRole: null,
    canAccess: feature => role === 'admin' || feature !== 'roles_admin',
  };
}
