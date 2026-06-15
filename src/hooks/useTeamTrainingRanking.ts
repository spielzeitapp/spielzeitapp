import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlayerItem } from './usePlayers';
import { buildTrainingRanking, type TrainingRankingResult } from '../lib/trainingRanking';
import { loadTeamPlayersTrainingStats } from '../lib/trainingStatsLoader';

const EMPTY_RESULT: TrainingRankingResult = {
  qualified: [],
  unqualified: [],
  sessionsCount: 0,
  minimumBasis: 0,
  teamAverageActivityPct: null,
};

export function useTeamTrainingRanking(
  players: PlayerItem[],
  teamSeasonId: string | null,
  enabled = true,
) {
  const [result, setResult] = useState<TrainingRankingResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlayers = useMemo(
    () => players.filter((p) => (p.status ?? 'active') === 'active'),
    [players],
  );

  const load = useCallback(async () => {
    if (!enabled) {
      setResult(EMPTY_RESULT);
      setError(null);
      setLoading(false);
      return;
    }

    const sid = (teamSeasonId ?? '').trim();
    if (!sid || activePlayers.length === 0) {
      setResult(EMPTY_RESULT);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const playerIds = activePlayers.map((p) => p.id);
      const { events, statsByPlayerId } = await loadTeamPlayersTrainingStats(playerIds, sid);
      const sessionsCount = events.length;
      setResult(buildTrainingRanking(activePlayers, statsByPlayerId, sessionsCount));
    } catch (e) {
      setResult(EMPTY_RESULT);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activePlayers, teamSeasonId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...result, loading, error, refetch: load };
}
