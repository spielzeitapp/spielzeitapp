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

/** Teamname ohne führende Altersklasse — für Kalenderanzeige. */
export function teamCalendarClubNameFromTeamName(name: string): string {
  const stripped = String(name ?? '').replace(AGE_GROUP_NAME_PREFIX, '').trim();
  return stripped || String(name ?? '').trim() || 'Team';
}

/**
 * Abgeleiteter Legacy-Slug ohne Altersklasse (nur Fallback, wenn kein calendar_slug).
 * „U11 SPG Rohrbach“ → spg-rohrbach
 */
export function teamCalendarStableSlugFromTeamName(name: string): string {
  return teamCalendarSlugFromTeamName(teamCalendarClubNameFromTeamName(name));
}

/** Legacy-Slug ohne führendes uNN-. */
export function teamCalendarSlugWithoutAgePrefix(slug: string): string {
  return String(slug ?? '')
    .trim()
    .toLowerCase()
    .replace(AGE_GROUP_SLUG_PREFIX, '')
    .replace(/^-+|-+$/g, '');
}

/**
 * Kanonischer Feed-Segment: teams.calendar_slug, sonst Legacy aus Name, sonst Team-UUID.
 */
export function resolveTeamCalendarFeedSegment(input: {
  calendarSlug?: string | null;
  teamName?: string | null;
  teamId?: string | null;
}): string | null {
  const fromDb = String(input.calendarSlug ?? '')
    .trim()
    .toLowerCase();
  if (fromDb) return fromDb;
  const name = String(input.teamName ?? '').trim();
  if (name) return teamCalendarStableSlugFromTeamName(name);
  const id = String(input.teamId ?? '').trim();
  return id || null;
}

/** Anzeigename fürs Abo (ohne technische Slug-Anzeige). */
export function teamCalendarDisplayTitle(teamName: string | null | undefined): string {
  return `${teamCalendarClubNameFromTeamName(teamName ?? 'Team')} Termine`;
}

/** Kalender-Feed-URL (calendar_slug / Legacy-Slug / UUID). */
export function buildTeamIcsFeedUrl(baseUrl: string, teamSlugOrUuid: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const seg = String(teamSlugOrUuid).trim();
  return `${trimmedBase}${TEAM_ICS_PATH}/${encodeURIComponent(seg)}.ics`;
}
