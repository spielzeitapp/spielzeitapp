import { useCallback, useEffect, useState } from 'react';
import type { TrainingAttendanceStats } from '../lib/trainingAttendance';
import {
  EMPTY_TRAINING_STATS,
  loadPlayerTrainingStats,
  loadPlayerTrainingStatsAcrossSeasons,
} from '../lib/trainingStatsLoader';
import { useDemoMode } from '../demo/DemoContext';
import { getDemoTrainingParticipationPct, isDemoPlayerId } from '../demo/demoPlayers';

/**
 * Trainingsbeteiligung: eine Saison oder Career (mehrere team_season_ids).
 * Demo: Werte aus Fixture-trainingPct, kein Supabase.
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
      const pct = getDemoTrainingParticipationPct(pid);
      const sessions = 20;
      const present = Math.round((pct / 100) * sessions);
      const absent = Math.max(0, sessions - present);
      setStats({
        teamRatePct: pct,
        activityRatePct: pct,
        present,
        absent,
        sick: 0,
        injured: 0,
        external: 0,
        open: 0,
        legacyUnknown: 0,
        sessionsCounted: sessions,
      });
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
      setStats(EMPTY_TRAINING_STATS);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [playerId, teamSeasonId, enabled, mode, careerKey, demo]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, loading, error, refetch: load };
}
