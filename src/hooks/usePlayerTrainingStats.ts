import { useCallback, useEffect, useState } from 'react';
import type { TrainingAttendanceStats } from '../lib/trainingAttendance';
import { EMPTY_TRAINING_STATS, loadPlayerTrainingStats } from '../lib/trainingStatsLoader';

/**
 * Trainingsbeteiligung eines Spielers (nur vergangene Trainingseinheiten der Saison).
 */
export function usePlayerTrainingStats(
  playerId: string | null,
  teamSeasonId: string | null,
  enabled = true,
) {
  const [stats, setStats] = useState<TrainingAttendanceStats>(EMPTY_TRAINING_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setStats(EMPTY_TRAINING_STATS);
      setError(null);
      setLoading(false);
      return;
    }
    const pid = (playerId ?? '').trim();
    const sid = (teamSeasonId ?? '').trim();
    if (!pid || !sid) {
      setStats(EMPTY_TRAINING_STATS);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setStats(await loadPlayerTrainingStats(pid, sid));
    } catch (e) {
      setStats(EMPTY_TRAINING_STATS);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [playerId, teamSeasonId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, loading, error, refetch: load };
}
