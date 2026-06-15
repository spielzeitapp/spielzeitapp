import { useSeasonMatchBoard } from './useSeasonMatchBoard';

/** @deprecated Nutze useSeasonMatchBoard */
export function useCoachSeasonMatchDetails(teamSeasonId: string | null, recentLimit = 5) {
  const { finishedMatches, recentMatches, achievements, loading, error, refetch } =
    useSeasonMatchBoard(teamSeasonId, recentLimit);

  return {
    matches: finishedMatches,
    recentMatches,
    achievements,
    loading,
    error,
    refetch,
  };
}
