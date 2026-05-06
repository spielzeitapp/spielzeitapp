const TEAM_ICS_PATH = '/api/calendar/team';

/**
 * Öffentlicher Slug für die Kalender-URL (lowercase, Bindestriche, URL-sicher).
 * Muss mit der Auflösung in `api/calendar/teamIcsCore.js` übereinstimmen.
 */
export function teamCalendarSlugFromTeamName(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'team';
}

/** Kalender-Feed-URL (Slug bevorzugt; UUID weiterhin vom Server akzeptiert). */
export function buildTeamIcsFeedUrl(baseUrl: string, teamSlugOrUuid: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const seg = String(teamSlugOrUuid).trim();
  return `${trimmedBase}${TEAM_ICS_PATH}/${encodeURIComponent(seg)}.ics`;
}

