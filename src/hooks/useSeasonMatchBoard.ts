import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeCoachSeasonAchievements,
  fetchSeasonMatchBoard,
  type CoachSeasonAchievements,
  type SeasonMatchBoard,
  type SeasonMatchCardData,
  type SeasonMatchSummary,
} from '../lib/seasonMatchStats';
import { countPastTeamTrainings } from '../lib/trainingSeasonCounts';

const EMPTY_SUMMARY: SeasonMatchSummary = {
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points: 0,
  pointsPerGame: '–',
};

const EMPTY_BOARD: SeasonMatchBoard = {
  summary: EMPTY_SUMMARY,
  upcoming: [],
  recent: [],
  all: [],
};

export function useSeasonMatchBoard(
  teamSeasonId: string | null,
  recentLimit = 10,
  opts?: { includeOrphanMatches?: boolean },
) {
  const [board, setBoard] = useState<SeasonMatchBoard>(EMPTY_BOARD);
  const [trainings, setTrainings] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const includeOrphanMatches = opts?.includeOrphanMatches === true;

  const refetch = useCallback(async () => {
    const sid = (teamSeasonId ?? '').trim();
    if (!sid) {
      setBoard(EMPTY_BOARD);
      setTrainings(0);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [next, trainingCount] = await Promise.all([
        fetchSeasonMatchBoard(sid, recentLimit, { includeOrphanMatches }),
        countPastTeamTrainings(sid),
      ]);
      setBoard(next);
      setTrainings(trainingCount);
    } catch (e) {
      setBoard(EMPTY_BOARD);
      setTrainings(0);
      setError(e instanceof Error ? e.message : 'Spiele konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [teamSeasonId, recentLimit, includeOrphanMatches]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const finishedMatches: SeasonMatchCardData[] = useMemo(
    () => board.all.filter((m) => m.outcome != null),
    [board.all],
  );

  const achievements: CoachSeasonAchievements = useMemo(
    () => computeCoachSeasonAchievements(finishedMatches),
    [finishedMatches],
  );

  return {
    summary: board.summary,
    upcoming: board.upcoming,
    recent: board.recent,
    all: board.all,
    finishedMatches,
    achievements,
    trainings,
    loading,
    error,
    refetch,
  };
}
