/** Route zur Match-Vorbereitung (Kader, Aufstellung, Feed-Automatisierung). */
export function matchPreparationPath(matchId: string): string {
  return `/app/match-preparation?matchId=${encodeURIComponent(matchId.trim())}`;
}

export function isMatchPreparationAccessible(
  ...statuses: Array<string | null | undefined>
): boolean {
  return !statuses.some((raw) => {
    const s = (raw ?? '').trim().toLowerCase();
    return s === 'finished' || s === 'ended' || s === 'completed';
  });
}
