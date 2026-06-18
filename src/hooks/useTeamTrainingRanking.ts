import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlayerItem } from './usePlayers';
import { buildTrainingRanking, type TrainingRankingResult } from '../lib/trainingRanking';
import { fetchTeamTrainingParticipationPct } from '../lib/teamTrainingParticipation';
import { loadSquadTrainingParticipation } from '../lib/teamTrainingParticipationStats';
import { loadTeamPlayersTrainingStats } from '../lib/trainingStatsLoader';

const EMPTY_RESULT: TrainingRankingResult = {
  qualified: [],
  unqualified: [],
  sessionsCount: 0,
  minimumBasis: 0,
  teamAverageActivityPct: null,
  teamParticipationPct: null,
  sessionParticipations: [],
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
    if (!sid) {
      setResult(EMPTY_RESULT);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (activePlayers.length === 0) {
        const participationRpc = await fetchTeamTrainingParticipationPct(sid);
        setResult({
          ...EMPTY_RESULT,
          teamParticipationPct: participationRpc.pct,
        });
        if (participationRpc.error && !participationRpc.rpcMissing) {
          setError(participationRpc.error);
        }
        return;
      }

      const playerIds = activePlayers.map((p) => p.id);
      const [{ events, statsByPlayerId }, squadParticipation, participationRpc] = await Promise.all([
        loadTeamPlayersTrainingStats(playerIds, sid),
        loadSquadTrainingParticipation(sid, playerIds),
        fetchTeamTrainingParticipationPct(sid),
      ]);
      const sessionsCount = events.length;
      const ranking = buildTrainingRanking(activePlayers, statsByPlayerId, sessionsCount);
      setResult({
        ...ranking,
        teamParticipationPct: participationRpc.pct ?? squadParticipation.squadParticipationPct,
        sessionParticipations: squadParticipation.sessions,
      });
      if (participationRpc.error && !participationRpc.rpcMissing && participationRpc.pct == null) {
        setError(participationRpc.error);
      }
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
