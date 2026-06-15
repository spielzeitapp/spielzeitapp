import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeCoachSeasonAchievements,
  fetchCoachSeasonMatchDetails,
  type CoachSeasonAchievements,
  type CoachSeasonMatchDetail,
} from '../lib/seasonMatchStats';

export function useCoachSeasonMatchDetails(teamSeasonId: string | null, recentLimit = 5) {
  const [matches, setMatches] = useState<CoachSeasonMatchDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const sid = (teamSeasonId ?? '').trim();
    if (!sid) {
      setMatches([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCoachSeasonMatchDetails(sid);
      setMatches(rows);
    } catch (e) {
      setMatches([]);
      setError(e instanceof Error ? e.message : 'Spiele konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [teamSeasonId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const achievements: CoachSeasonAchievements = useMemo(
    () => computeCoachSeasonAchievements(matches),
    [matches],
  );

  const recentMatches = useMemo(() => matches.slice(0, recentLimit), [matches, recentLimit]);

  return { matches, recentMatches, achievements, loading, error, refetch };
}
