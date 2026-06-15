import { useCallback, useEffect, useState } from 'react';
import { fetchSeasonMatchBoard } from '../lib/seasonMatchStats';
import { countPastTeamTrainings } from '../lib/trainingSeasonCounts';

export type TeamSeasonCoachStats = {
  trainings: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  pointsPerGame: string;
};

const EMPTY_STATS: TeamSeasonCoachStats = {
  trainings: 0,
  matches: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  pointsPerGame: '–',
};

export function useTeamSeasonCoachStats(teamSeasonId: string | null) {
  const [stats, setStats] = useState<TeamSeasonCoachStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!teamSeasonId) {
      setStats(EMPTY_STATS);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [trainings, board] = await Promise.all([
        countPastTeamTrainings(teamSeasonId),
        fetchSeasonMatchBoard(teamSeasonId),
      ]);
      const s = board.summary;
      setStats({
        trainings,
        matches: s.played,
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        pointsPerGame: s.pointsPerGame,
      });
      setError(null);
    } catch (e) {
      setStats(EMPTY_STATS);
      setError(e instanceof Error ? e.message : 'Statistik konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [teamSeasonId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { stats, loading, error, refetch };
}

export function staffRoleWatermarkCode(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === 'head_coach') return 'CH';
  if (r === 'co_trainer') return 'CT';
  return 'TR';
}
