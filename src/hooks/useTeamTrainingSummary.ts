import { useMemo } from 'react';
import type { PlayerItem } from './usePlayers';
import { useTeamTrainingRanking } from './useTeamTrainingRanking';
import { useJugglingChallenge } from './useJugglingChallenge';
import { deriveJugglingAwards } from '../lib/challengeScoring';
import type { TrainingRankingResult } from '../lib/trainingRanking';
import {
  formatParticipationLabel,
  kaiserActivitySub,
  kaiserTileName,
  resolveKaiserLeader,
  resolveTeamParticipationPct,
} from '../lib/trainingSummaryDisplay';

export function useTeamTrainingSummary(
  players: PlayerItem[],
  teamSeasonId: string | null,
  enabled = true,
  opts?: { squadMode?: 'active_only' | 'as_provided' },
) {
  const {
    qualified,
    unqualified,
    sessionsCount,
    minimumBasis,
    teamAverageActivityPct,
    teamParticipationPct,
    sessionParticipations,
    loading: rankingLoading,
    error: rankingError,
  } = useTeamTrainingRanking(players, teamSeasonId, enabled, opts);

  const ranking: TrainingRankingResult = useMemo(
    () => ({
      qualified,
      unqualified,
      sessionsCount,
      minimumBasis,
      teamAverageActivityPct,
      teamParticipationPct,
      sessionParticipations,
    }),
    [
      qualified,
      unqualified,
      sessionsCount,
      minimumBasis,
      teamAverageActivityPct,
      teamParticipationPct,
      sessionParticipations,
    ],
  );

  const jugglingState = useJugglingChallenge(players, teamSeasonId, enabled);

  const participationPct = useMemo(() => resolveTeamParticipationPct(ranking), [ranking]);

  const leader = useMemo(() => resolveKaiserLeader(ranking), [ranking]);
  const kaiserName = leader ? kaiserTileName(leader.player) : null;
  const kaiserSub = kaiserActivitySub(leader);

  const gaberlKing = useMemo(() => {
    if (!jugglingState.session) return null;
    const inputs = jugglingState.rows.map((row) => ({
      playerId: row.player.id,
      playerName: row.player.display_name,
      startValue: row.startValue,
      endValue: row.endValue,
    }));
    return deriveJugglingAwards(inputs, jugglingState.session.min_start_for_percent);
  }, [jugglingState.rows, jugglingState.session]);

  return {
    ranking,
    ratedTrainingsCount: sessionsCount,
    participationPct,
    participationLabel:
      rankingLoading && participationPct == null
        ? '…'
        : formatParticipationLabel(participationPct),
    kaiserName,
    kaiserSub,
    gaberlKing: gaberlKing?.king ?? null,
    jugglingAwards: gaberlKing,
    jugglingLoading: jugglingState.loading,
    rankingLoading,
    rankingError,
  };
}
