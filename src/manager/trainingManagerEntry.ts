import { isTrainerStaffMembershipRole, type ManagerWorkModeMembership } from './managerWorkMode';

/** Explicit App-to-plan entry; never grants a role or access to another team. */
export function resolveTrainingTrainerEntry(pathname: string, search: string,
  memberships: readonly ManagerWorkModeMembership[]): string | null {
  if (!/^\/manager\/training\/einheiten\/(?:neu|[0-9a-f-]{36})$/i.test(pathname)) return null;
  const params = new URLSearchParams(search);
  if (params.get('workMode') !== 'trainer') return null;
  const seasonId = params.get('teamSeason');
  return seasonId && memberships.some(m => m.team_season_id === seasonId && isTrainerStaffMembershipRole(m.role))
    ? seasonId : null;
}

export function trainingPlanManagerHref(input: {
  sessionId?: string | null; eventId: string; teamSeasonId: string; startsAtIso: string;
}): string {
  const params = new URLSearchParams({
    workMode: 'trainer', teamSeason: input.teamSeasonId,
    returnTo: `/app/events/${encodeURIComponent(input.eventId)}`,
  });
  if (!input.sessionId) { params.set('event', input.eventId); params.set('starts', input.startsAtIso); }
  return `/manager/training/einheiten/${input.sessionId ? encodeURIComponent(input.sessionId) : 'neu'}?${params}`;
}
