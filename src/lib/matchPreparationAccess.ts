/** Route zur Match-Vorbereitung (Kader, Aufstellung, Feed-Automatisierung). */
export function matchPreparationPath(matchId: string): string {
  return `/app/match-preparation?matchId=${encodeURIComponent(matchId.trim())}`;
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
