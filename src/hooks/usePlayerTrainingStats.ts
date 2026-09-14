import { useCallback, useEffect, useState } from 'react';
import type { TrainingAttendanceStats } from '../lib/trainingAttendance';
import {
  computeTrainingHistoryForPlayer,
  EMPTY_TRAINING_STATS,
  loadPlayerTrainingHistory,
  loadPlayerTrainingHistoryAcrossSeasons,
  type PlayerTrainingSession,
} from '../lib/trainingStatsLoader';
import { useDemoMode } from '../demo/DemoContext';
import { isDemoPlayerId } from '../demo/demoPlayers';
import {
  getDemoPastTrainingEvents,
} from '../demo/demoTrainingStats';

/**
 * Trainingsbeteiligung: eine Saison oder Career (mehrere team_season_ids).
 * Demo: aus lokaler Attendance + vergangenen Demo-Trainings (produktive Formel).
 */
export function usePlayerTrainingStats(
  playerId: string | null,
  teamSeasonId: string | null,
  enabled = true,
  options?: { mode?: 'season' | 'career'; careerSeasonIds?: string[] },
) {
  const demo = useDemoMode();
  const mode = options?.mode ?? 'season';
  const careerSeasonIds = options?.careerSeasonIds;
  const [stats, setStats] = useState<TrainingAttendanceStats>(EMPTY_TRAINING_STATS);
  const [sessions, setSessions] = useState<PlayerTrainingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const careerKey = (careerSeasonIds ?? []).slice().sort().join(',');
  const demoAttendanceKey = demo
    ? demo.attendanceRows.map((r) => `${r.event_id}:${r.player_id}:${r.status}`).join('|')
    : '';

  const load = useCallback(async () => {
    if (!enabled) {
      setStats(EMPTY_TRAINING_STATS);
      setSessions([]);
      setError(null);
      setLoading(false);
      return;
    }
    const pid = (playerId ?? '').trim();
    if (!pid) {
      setStats(EMPTY_TRAINING_STATS);
      setSessions([]);
      setError(null);
      return;
    }

    if (demo || isDemoPlayerId(pid)) {
      if (demo) {
        const past = getDemoPastTrainingEvents(demo.data.events);
        const byEvent = new Map<string, string>();
        for (const row of demo.attendanceRows) {
          if (row.player_id.toLowerCase() === pid.toLowerCase()) {
            byEvent.set(row.event_id.toLowerCase(), row.status);
          }
        }
        const history = computeTrainingHistoryForPlayer(past, byEvent);
        setStats(history.stats);
        setSessions(history.sessions);
      } else {
        setStats(EMPTY_TRAINING_STATS);
        setSessions([]);
      }
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'career') {
        const ids = careerSeasonIds?.filter(Boolean) ?? [];
        const history = await loadPlayerTrainingHistoryAcrossSeasons(pid, ids);
        setStats(history.stats);
        setSessions(history.sessions);
      } else {
        const sid = (teamSeasonId ?? '').trim();
        if (!sid) {
          setStats(EMPTY_TRAINING_STATS);
          setSessions([]);
        } else {
          const history = await loadPlayerTrainingHistory(pid, sid);
          setStats(history.stats);
          setSessions(history.sessions);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStats(EMPTY_TRAINING_STATS);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, playerId, teamSeasonId, mode, careerKey, demo, demoAttendanceKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, sessions, loading, error, refetch: load };
}
