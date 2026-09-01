export type MatchdayPlayerMotifCandidate = {
  playerId: string;
  imageUrl: string;
  playerName?: string | null;
};

export type MatchdayPlayerMotif = {
  playerId: string | null;
  imageUrl: string;
  playerName: string | null;
  source: 'event_override' | 'roster_rotation' | 'demo_fallback';
};

/**
 * Neutrale, fiktive Übergangsmotive. Sie werden ausschließlich verwendet,
 * wenn im aktiven Kader kein einziger freigestellter Spieler vorhanden ist.
 */
export const MATCHDAY_DEMO_PLAYER_CANDIDATES: MatchdayPlayerMotifCandidate[] = [
  {
    playerId: 'demo-matchday-player-01',
    imageUrl: '/feed/demo-matchday-player-01.webp',
    playerName: 'Demo-Spieler 1',
  },
  {
    playerId: 'demo-matchday-player-02',
    imageUrl: '/feed/test-player-daniel.PNG',
    playerName: 'Demo-Spieler 2',
  },
];

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizedCandidates(
  candidates: MatchdayPlayerMotifCandidate[],
): MatchdayPlayerMotifCandidate[] {
  const byPlayer = new Map<string, MatchdayPlayerMotifCandidate>();
  for (const candidate of candidates) {
    const playerId = candidate.playerId.trim();
    const imageUrl = candidate.imageUrl.trim();
    if (!playerId || !imageUrl || byPlayer.has(playerId)) continue;
    byPlayer.set(playerId, {
      playerId,
      imageUrl,
      playerName: candidate.playerName?.trim() || null,
    });
  }
  return [...byPlayer.values()].sort((a, b) => a.playerId.localeCompare(b.playerId));
}

/**
 * Stabile Auswahl pro Spiel: gleiches Event behält sein Motiv, verschiedene Spiele rotieren.
 * Wenn mindestens zwei Motive vorhanden sind, wird das zuletzt verwendete ausgeschlossen.
 */
export function chooseMatchdayPlayerMotif(params: {
  eventId: string;
  candidates: MatchdayPlayerMotifCandidate[];
  previousPlayerId?: string | null;
  source?: 'roster_rotation' | 'demo_fallback';
}): MatchdayPlayerMotif | null {
  const all = normalizedCandidates(params.candidates);
  if (all.length === 0) return null;

  const previous = params.previousPlayerId?.trim() || null;
  const selectable =
    all.length > 1 && previous ? all.filter((candidate) => candidate.playerId !== previous) : all;
  const pool = selectable.length > 0 ? selectable : all;
  const selected = pool[stableHash(params.eventId.trim() || 'matchday') % pool.length]!;

  return {
    playerId: selected.playerId,
    imageUrl: selected.imageUrl,
    playerName: selected.playerName?.trim() || null,
    source: params.source ?? 'roster_rotation',
  };
}

export function eventOverrideMatchdayMotif(imageUrl: string): MatchdayPlayerMotif | null {
  const normalized = imageUrl.trim();
  if (!normalized) return null;
  return {
    playerId: null,
    imageUrl: normalized,
    playerName: null,
    source: 'event_override',
  };
}
