import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlayerItem } from './usePlayers';
import { buildTrainingRanking, type TrainingRankingRow } from '../lib/trainingRanking';
import { loadTeamPlayersTrainingStats } from '../lib/trainingStatsLoader';

export function useTeamTrainingRanking(
  players: PlayerItem[],
  teamSeasonId: string | null,
  enabled = true,
) {
  const [ranking, setRanking] = useState<TrainingRankingRow[]>([]);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlayers = useMemo(
    () => players.filter((p) => (p.status ?? 'active') === 'active'),
    [players],
  );

  const load = useCallback(async () => {
    if (!enabled) {
      setRanking([]);
      setSessionsCount(0);
      setError(null);
      setLoading(false);
      return;
    }

    const sid = (teamSeasonId ?? '').trim();
    if (!sid || activePlayers.length === 0) {
      setRanking([]);
      setSessionsCount(0);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const playerIds = activePlayers.map((p) => p.id);
      const { events, statsByPlayerId } = await loadTeamPlayersTrainingStats(playerIds, sid);
      setSessionsCount(events.length);
      setRanking(buildTrainingRanking(activePlayers, statsByPlayerId));
    } catch (e) {
      setRanking([]);
      setSessionsCount(0);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activePlayers, teamSeasonId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ranking, sessionsCount, loading, error, refetch: load };
}
