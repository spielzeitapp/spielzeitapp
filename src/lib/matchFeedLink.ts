export type MatchGameLinkStatus = 'upcoming' | 'live' | 'finished' | 'ended' | 'completed' | 'canceled' | string;

const FINISHED_STATUSES = new Set(['finished', 'ended', 'completed']);

/**
 * Ziel-Route für „Zum Spiel“ — moderne Vorbereitungs-/Detailseite, Live-Screen oder Ergebnis.
 * Vermeidet die Legacy-Route /app/match/:id (altes Scoreboard).
 */
export function resolveMatchGameHref(params: {
  matchId?: string | null;
  eventId?: string | null;
  status?: MatchGameLinkStatus | null;
}): string {
  const mid = (params.matchId ?? '').trim();
  const eid = (params.eventId ?? '').trim();
  const status = (params.status ?? 'upcoming').toLowerCase();

  if (status === 'live') {
    if (mid) return `/app/live/${encodeURIComponent(mid)}`;
    return '/app/live';
  }

  if (FINISHED_STATUSES.has(status)) {
    if (mid) return `/app/match-preparation?matchId=${encodeURIComponent(mid)}`;
    if (eid) return `/app/events/${encodeURIComponent(eid)}`;
    return '/app/termine';
  }

  if (mid) return `/app/match-preparation?matchId=${encodeURIComponent(mid)}`;
  if (eid) return `/app/events/${encodeURIComponent(eid)}`;
  return '/app/termine';
}
