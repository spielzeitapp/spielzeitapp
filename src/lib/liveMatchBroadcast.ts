/**
 * Leichtgewichtiger Cross-Surface-Broadcast nach Trainer-Live-Aktionen
 * (Anpfiff, Pause, Ende, Score). Kein Ersatz für Realtime — nur Sofort-Invalidierung
 * für Match Center, Bottom-Nav und Turniercenter im selben Browser-Tab.
 */

export const LIVE_MATCH_STATE_CHANGED_EVENT = 'spielzeit:live-match-state-changed';

export type LiveMatchStateChangeDetail = {
  matchId: string;
  status: 'live' | 'finished' | 'paused' | 'updated';
  reason?: string;
};

export function broadcastLiveMatchStateChanged(detail: LiveMatchStateChangeDetail): void {
  if (typeof window === 'undefined') return;
  const matchId = String(detail.matchId ?? '').trim();
  if (!matchId) return;
  window.dispatchEvent(
    new CustomEvent<LiveMatchStateChangeDetail>(LIVE_MATCH_STATE_CHANGED_EVENT, {
      detail: { ...detail, matchId },
    }),
  );
}

export function subscribeLiveMatchStateChanged(
  handler: (detail: LiveMatchStateChangeDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onEvent = (event: Event) => {
    const detail = (event as CustomEvent<LiveMatchStateChangeDetail>).detail;
    if (!detail?.matchId) return;
    handler(detail);
  };
  window.addEventListener(LIVE_MATCH_STATE_CHANGED_EVENT, onEvent);
  return () => window.removeEventListener(LIVE_MATCH_STATE_CHANGED_EVENT, onEvent);
}
