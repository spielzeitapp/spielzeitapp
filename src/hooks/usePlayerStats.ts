import { useEffect, useMemo, useState } from 'react';
import {
  getPlayerStats,
  type PlayerLastMatchRow,
  type PlayerSeasonStats,
} from '../lib/stats/playerStatsService';
import { useDemoMode } from '../demo/DemoContext';
import {
  getDemoPlayerLastMatches,
  getDemoPlayerSeasonStats,
  isDemoPlayerId,
} from '../demo/demoPlayers';

const EMPTY_STATS: PlayerSeasonStats = {
  games: 0,
  goals: 0,
  assists: 0,
  minutes: 0,
  goalsPerGame: 0,
  averageMinutesPerGame: 0,
  goalsPer90: 0,
  yellowCards: 0,
  redCards: 0,
};

export type PlayerStatsMode = 'season' | 'career';

export function usePlayerStats(
  playerId: string | null | undefined,
  teamSeasonId: string | null | undefined,
  mode: PlayerStatsMode = 'season',
) {
  const demo = useDemoMode();
  const [stats, setStats] = useState<PlayerSeasonStats>(EMPTY_STATS);
  const [tournamentStats, setTournamentStats] = useState<PlayerSeasonStats>(EMPTY_STATS);
  const [lastMatches, setLastMatches] = useState<PlayerLastMatchRow[]>([]);
  const [lastTournamentMatches, setLastTournamentMatches] = useState<PlayerLastMatchRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pid = playerId?.trim();
    if (!pid) {
      setStats(EMPTY_STATS);
      setTournamentStats(EMPTY_STATS);
      setLastMatches([]);
      setLastTournamentMatches([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (demo || isDemoPlayerId(pid)) {
      setStats(getDemoPlayerSeasonStats(pid));
      setTournamentStats(EMPTY_STATS);
      setLastMatches(getDemoPlayerLastMatches(pid));
      setLastTournamentMatches([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (mode === 'season' && !teamSeasonId?.trim()) {
      setStats(EMPTY_STATS);
      setTournamentStats(EMPTY_STATS);
      setLastMatches([]);
      setLastTournamentMatches([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void (async () => {
      const {
        stats: nextStats,
        tournamentStats: nextTournamentStats,
        lastMatches: lm,
        lastTournamentMatches: tournamentLm,
        error: err,
      } = await getPlayerStats({
        playerId: pid,
        mode,
        teamSeasonId,
      });
      if (cancelled) return;
      setIsLoading(false);
      if (err) {
        setError(err);
        setStats(EMPTY_STATS);
        setTournamentStats(EMPTY_STATS);
        setLastMatches([]);
        setLastTournamentMatches([]);
        return;
      }
      setStats(nextStats);
      setTournamentStats(nextTournamentStats);
      setLastMatches(lm);
      setLastTournamentMatches(tournamentLm);
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId, teamSeasonId, mode, demo]);

  return useMemo(
    () => ({
      data: stats,
      tournamentData: tournamentStats,
      lastMatches,
      lastTournamentMatches,
      isLoading,
      error,
    }),
    [stats, tournamentStats, lastMatches, lastTournamentMatches, isLoading, error],
  );
}
