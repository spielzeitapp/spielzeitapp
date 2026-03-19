export function buildTeamIcsFeedUrl(baseUrl: string, teamId: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const safeTeamId = encodeURIComponent(teamId);
  return `${trimmedBase}/api/calendar/team/${safeTeamId}.ics`;
}

