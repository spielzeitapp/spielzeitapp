import { useCallback, useEffect, useState } from 'react';
import type { TrainingAttendanceStats } from '../lib/trainingAttendance';
import {
  EMPTY_TRAINING_STATS,
  loadPlayerTrainingStats,
  loadPlayerTrainingStatsAcrossSeasons,
} from '../lib/trainingStatsLoader';
import { useDemoMode } from '../demo/DemoContext';
import { isDemoPlayerId } from '../demo/demoPlayers';
import {
  getDemoPastTrainingEvents,
  getDemoPlayerTrainingStatsFromAttendance,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const careerKey = (careerSeasonIds ?? []).slice().sort().join(',');
  const demoAttendanceKey = demo
    ? demo.attendanceRows.map((r) => `${r.event_id}:${r.player_id}:${r.status}`).join('|')
    : '';

  const load = useCallback(async () => {
    if (!enabled) {
      setStats(EMPTY_TRAINING_STATS);
      setError(null);
      setLoading(false);
      return;
    }
    const pid = (playerId ?? '').trim();
    if (!pid) {
      setStats(EMPTY_TRAINING_STATS);
      setError(null);
      return;
    }

    if (demo || isDemoPlayerId(pid)) {
      if (demo) {
        const past = getDemoPastTrainingEvents(demo.data.events);
        setStats(getDemoPlayerTrainingStatsFromAttendance(pid, past, demo.attendanceRows));
      } else {
        setStats(EMPTY_TRAINING_STATS);
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
        setStats(await loadPlayerTrainingStatsAcrossSeasons(pid, ids));
      } else {
        const sid = (teamSeasonId ?? '').trim();
        if (!sid) {
          setStats(EMPTY_TRAINING_STATS);
        } else {
          setStats(await loadPlayerTrainingStats(pid, sid));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStats(EMPTY_TRAINING_STATS);
    } finally {
      setLoading(false);
    }
  }, [enabled, playerId, teamSeasonId, mode, careerKey, demo, demoAttendanceKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, loading, error, refetch: load };
}
