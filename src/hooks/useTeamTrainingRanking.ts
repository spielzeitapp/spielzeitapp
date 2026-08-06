import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlayerItem } from './usePlayers';
import { buildTrainingRanking, type TrainingRankingResult } from '../lib/trainingRanking';
import { fetchTeamTrainingParticipationPct } from '../lib/teamTrainingParticipation';
import { loadSquadTrainingParticipation } from '../lib/teamTrainingParticipationStats';
import { EMPTY_TRAINING_STATS, loadTeamPlayersTrainingStats } from '../lib/trainingStatsLoader';
import { useDemoMode } from '../demo/DemoContext';
import { getDemoTrainingParticipationPct, isDemoPlayerId } from '../demo/demoPlayers';
import type { TrainingAttendanceStats } from '../lib/trainingAttendance';

const EMPTY_RESULT: TrainingRankingResult = {
  qualified: [],
  unqualified: [],
  sessionsCount: 0,
  minimumBasis: 0,
  teamAverageActivityPct: null,
  teamParticipationPct: null,
  sessionParticipations: [],
};

function demoStatsFromPct(pct: number): TrainingAttendanceStats {
  const sessions = 20;
  const present = Math.round((pct / 100) * sessions);
  const absent = Math.max(0, sessions - present);
  return {
    ...EMPTY_TRAINING_STATS,
    teamRatePct: pct,
    activityRatePct: pct,
    present,
    absent,
    sessionsCounted: sessions,
  };
}

export function useTeamTrainingRanking(
  players: PlayerItem[],
  teamSeasonId: string | null,
  enabled = true,
) {
  const demo = useDemoMode();
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

    const useDemoData =
      Boolean(demo) || activePlayers.some((p) => isDemoPlayerId(p.id));

    setLoading(true);
    setError(null);
    try {
    if (useDemoData) {
      const sessionsCount = 20;
      const statsByPlayerId = new Map(
        activePlayers.map((p) => [p.id, demoStatsFromPct(getDemoTrainingParticipationPct(p.id))]),
      );
      const ranking = buildTrainingRanking(activePlayers, statsByPlayerId, sessionsCount);
      const avg =
        activePlayers.length === 0
          ? null
          : Math.round(
              activePlayers.reduce((sum, p) => sum + getDemoTrainingParticipationPct(p.id), 0) /
                activePlayers.length,
            );
      setResult({
        ...ranking,
        teamParticipationPct: avg,
        sessionParticipations: [],
      });
      return;
    }

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
  }, [activePlayers, teamSeasonId, enabled, demo]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...result, loading, error, refetch: load };
}
