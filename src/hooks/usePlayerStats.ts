import { useEffect, useMemo, useState } from 'react';
import {
  getPlayerProfileStatsBundle,
  type PlayerLastMatchRow,
  type PlayerSeasonStats,
} from '../lib/stats/playerStatsService';

const EMPTY_STATS: PlayerSeasonStats = {
  games: 0,
  goals: 0,
  minutes: 0,
  goalsPer90: 0,
  yellowCards: 0,
  redCards: 0,
};

export function usePlayerStats(playerId: string | null | undefined, teamSeasonId: string | null | undefined) {
  const [stats, setStats] = useState<PlayerSeasonStats>(EMPTY_STATS);
  const [lastMatches, setLastMatches] = useState<PlayerLastMatchRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pid = playerId?.trim();
    const tid = teamSeasonId?.trim();
    if (!pid || !tid) {
      setStats(EMPTY_STATS);
      setLastMatches([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void (async () => {
      const { stats: nextStats, lastMatches: lm, error: err } = await getPlayerProfileStatsBundle(pid, tid);
      if (cancelled) return;
      setIsLoading(false);
      if (err) {
        setError(err);
        setStats(EMPTY_STATS);
        setLastMatches([]);
        return;
      }
      setStats(nextStats);
      setLastMatches(lm);
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId, teamSeasonId]);

  return useMemo(
    () => ({
      data: stats,
      lastMatches,
      isLoading,
      error,
    }),
    [stats, lastMatches, isLoading, error],
  );
}
