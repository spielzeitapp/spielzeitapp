import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlayerItem } from './usePlayers';
import { buildTrainingRanking, type TrainingRankingResult } from '../lib/trainingRanking';
import { fetchTeamTrainingParticipationPct } from '../lib/teamTrainingParticipation';
import { loadSquadTrainingParticipation } from '../lib/teamTrainingParticipationStats';
import { loadTeamPlayersTrainingStats } from '../lib/trainingStatsLoader';
import { useDemoMode } from '../demo/DemoContext';
import { isDemoPlayerId } from '../demo/demoPlayers';
import {
  buildDemoSessionParticipations,
  buildDemoStatsByPlayerId,
  computeDemoSquadParticipationPct,
  getDemoPastTrainingEvents,
} from '../demo/demoTrainingStats';

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
  opts?: {
    /**
     * active_only (Default): nur status=active im Nenner.
     * as_provided: übergebene Liste ist bereits der historische Trainingskader.
     */
    squadMode?: 'active_only' | 'as_provided';
  },
) {
  const demo = useDemoMode();
  const [result, setResult] = useState<TrainingRankingResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);
  const squadMode = opts?.squadMode ?? 'active_only';

  const squadPlayers = useMemo(() => {
    if (squadMode === 'as_provided') return players;
    return players.filter((p) => (p.status ?? 'active') === 'active');
  }, [players, squadMode]);

  const demoAttendanceKey = demo
    ? demo.attendanceRows.map((r) => `${r.event_id}:${r.player_id}:${r.status}`).join('|')
    : '';

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

    const useDemoData = Boolean(demo) || squadPlayers.some((p) => isDemoPlayerId(p.id));

    setLoading(true);
    setError(null);
    try {
      if (useDemoData && demo) {
        const pastEvents = getDemoPastTrainingEvents(demo.data.events);
        const playerIds = squadPlayers.map((p) => p.id);
        const statsByPlayerId = buildDemoStatsByPlayerId(
          playerIds,
          pastEvents,
          demo.attendanceRows,
        );
        const sessionParticipations = buildDemoSessionParticipations(
          pastEvents,
          playerIds,
          demo.attendanceRows,
        );
        const ranking = buildTrainingRanking(squadPlayers, statsByPlayerId, pastEvents.length);
        setResult({
          ...ranking,
          teamParticipationPct: computeDemoSquadParticipationPct(sessionParticipations),
          sessionParticipations,
        });
        return;
      }

      if (squadPlayers.length === 0) {
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

      const playerIds = squadPlayers.map((p) => p.id);
      const [{ events, statsByPlayerId }, squadParticipation, participationRpc] = await Promise.all([
        loadTeamPlayersTrainingStats(playerIds, sid),
        loadSquadTrainingParticipation(sid, playerIds),
        fetchTeamTrainingParticipationPct(sid),
      ]);
      const sessionsCount = events.length;
      const ranking = buildTrainingRanking(squadPlayers, statsByPlayerId, sessionsCount);
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
  }, [squadPlayers, teamSeasonId, enabled, demo, demoAttendanceKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...result, loading, error, refetch: load };
}
