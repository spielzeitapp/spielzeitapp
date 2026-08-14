export type MatchGameLinkStatus = 'upcoming' | 'live' | 'finished' | 'ended' | 'completed' | 'canceled' | string;

const FINISHED_STATUSES = new Set(['finished', 'ended', 'completed']);

/**
 * Ziel-Route für „Zum Spiel“ — moderne Vorbereitungs-/Detailseite, Live-Screen oder Ergebnis.
 * Vermeidet die Legacy-Route /app/match/:id (altes Scoreboard).
 *
 * canManage steuert die Rollen-Navigation:
 * - Trainer/Co-Trainer/Cheftrainer/Admin (true): Vorbereitungs-/Live-Routen.
 * - Eltern/Spieler/Fans (false/undefined): immer Event-Detailseite (Zu-/Absagen,
 *   Kalender, Navigation, Matchday-Infos) — nie /app/match-preparation.
 */
export function resolveMatchGameHref(params: {
  matchId?: string | null;
  eventId?: string | null;
  status?: MatchGameLinkStatus | null;
  canManage?: boolean;
  basePath?: '/app' | '/demo';
}): string {
  const base = params.basePath ?? '/app';
  const mid = (params.matchId ?? '').trim();
  const eid = (params.eventId ?? '').trim();
  const status = (params.status ?? 'upcoming').toLowerCase();

  if (params.canManage !== true) {
    if (eid) return `${base}/events/${encodeURIComponent(eid)}`;
    // Ohne Event-Id: sichere Fallbacks, aber nie die Vorbereitung.
    if (status === 'live' && mid) return `${base}/live/${encodeURIComponent(mid)}`;
    if (FINISHED_STATUSES.has(status) && mid) return `${base}/live?matchId=${encodeURIComponent(mid)}`;
    return `${base}/termine`;
  }

  if (status === 'live') {
    if (mid) return `${base}/live/${encodeURIComponent(mid)}`;
    return `${base}/live`;
  }

  if (FINISHED_STATUSES.has(status)) {
    if (mid) return `${base}/match-preparation?matchId=${encodeURIComponent(mid)}`;
    if (eid) return `${base}/events/${encodeURIComponent(eid)}`;
    return `${base}/termine`;
  }

  if (mid) return `${base}/match-preparation?matchId=${encodeURIComponent(mid)}`;
  if (eid) return `${base}/events/${encodeURIComponent(eid)}`;
  return `${base}/termine`;
}
