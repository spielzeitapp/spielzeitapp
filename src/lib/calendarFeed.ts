const TEAM_ICS_PATH = '/api/calendar/team';

/** Altersklasse am Namensanfang (U11, U12, U10a, …). */
const AGE_GROUP_NAME_PREFIX = /^\s*U\d{1,2}[a-z]?\s+/i;
/** Altersklasse am Slug-Anfang (u11-, u12-, …) — Legacy-Feeds. */
const AGE_GROUP_SLUG_PREFIX = /^u\d{1,2}[a-z]?-/i;

/**
 * Öffentlicher Slug aus dem Roh-Teamnamen (lowercase, Bindestriche).
 * „U11 SPG Rohrbach“ → u11-spg-rohrbach (Legacy-kompatibel).
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

/** Teamname ohne führende Altersklasse — für Kalendername & stabile URL. */
export function teamCalendarClubNameFromTeamName(name: string): string {
  const stripped = String(name ?? '').replace(AGE_GROUP_NAME_PREFIX, '').trim();
  return stripped || String(name ?? '').trim() || 'Team';
}

/**
 * Saisonübergreifender Team-Slug (ohne Altersklasse).
 * „U11 SPG Rohrbach“ / „U12 SPG Rohrbach“ → spg-rohrbach
 */
export function teamCalendarStableSlugFromTeamName(name: string): string {
  return teamCalendarSlugFromTeamName(teamCalendarClubNameFromTeamName(name));
}

/** Legacy-Slug ohne führendes uNN- → stabiler Team-Slug. */
export function teamCalendarSlugWithoutAgePrefix(slug: string): string {
  return String(slug ?? '')
    .trim()
    .toLowerCase()
    .replace(AGE_GROUP_SLUG_PREFIX, '')
    .replace(/^-+|-+$/g, '');
}

/** Kalender-Feed-URL (stabiler Team-Slug bevorzugt; UUID weiterhin vom Server akzeptiert). */
export function buildTeamIcsFeedUrl(baseUrl: string, teamSlugOrUuid: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const seg = String(teamSlugOrUuid).trim();
  return `${trimmedBase}${TEAM_ICS_PATH}/${encodeURIComponent(seg)}.ics`;
}
