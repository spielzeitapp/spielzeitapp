/** Route zur Match-Vorbereitung (Kader, Aufstellung, Feed-Automatisierung). */
export function matchPreparationPath(matchId: string): string {
  return `/app/match-preparation?matchId=${encodeURIComponent(matchId.trim())}`;
}

/** Route zur Aufstellungsseite eines Spiels. */
export function matchLineupPath(matchId: string): string {
  return `/app/match-lineup?matchId=${encodeURIComponent(matchId.trim())}`;
}

/** Route zum Livespiel. */
export function liveMatchPath(matchId: string): string {
  return `/app/live?matchId=${encodeURIComponent(matchId.trim())}`;
}

/** Kader vor Anpfiff bearbeitbar; danach nur noch Live-Wechsel. */
export function isMatchSquadEditable(params: {
  status?: string | null;
  live_started_at?: string | null;
}): boolean {
  const status = String(params.status ?? '').trim().toLowerCase();
  if (status === 'live' || status === 'finished') return false;
  if (params.live_started_at) return false;
  return true;
}

export function isMatchPreparationAccessible(
  ...statuses: Array<string | null | undefined>
): boolean {
  return !statuses.some((raw) => {
    const s = (raw ?? '').trim().toLowerCase();
    return s === 'finished' || s === 'ended' || s === 'completed';
  });
}

/** Match beendet, Kalender-Termin noch offen (Nacharbeit / Review). */
export function isMatchReviewPending(params: {
  eventStatus?: string | null;
  matchStatus?: string | null;
}): boolean {
  const ms = String(params.matchStatus ?? '').trim().toLowerCase();
  const es = String(params.eventStatus ?? '').trim().toLowerCase();
  return ms === 'finished' && es !== 'finished' && es !== 'canceled';
}
