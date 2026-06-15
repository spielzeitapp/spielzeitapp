import React, { useMemo, useState } from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import { useTeamTrainingRanking } from '../../hooks/useTeamTrainingRanking';
import { useJugglingChallenge } from '../../hooks/useJugglingChallenge';
import { deriveJugglingAwards } from '../../lib/challengeScoring';
import { hasTrainingActivityBasis, type TrainingRankingResult } from '../../lib/trainingRanking';
import { TrainingKaiserCard } from './TrainingKaiserCard';
import { JugglingChallengeCard } from './JugglingChallengeCard';
import { GlassCard, PremiumCard, PremiumEmptyState, PremiumTab, PremiumTabTrack, SectionTitle } from '../../ui';
import { cn } from '../../ui/lib/cn';

type TrainingSubTab = 'overview' | 'kaiser' | 'challenge';

type Props = {
  players: PlayerItem[];
  teamSeasonId: string;
  trainingCount: number;
  onPlayerClick?: (player: PlayerItem) => void;
};

function StatSummaryCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <GlassCard variant="subtle" showAmbientGlow={false} className={cn('px-3 py-2.5', className)}>
      <p className="text-[11px] font-medium text-white/55">{label}</p>
      <p className="mt-1 truncate text-[15px] font-bold leading-tight text-white">{value}</p>
      {sub ? <p className="mt-0.5 truncate text-[11px] text-white/50">{sub}</p> : null}
    </GlassCard>
  );
}

function averageTeamParticipationPct(qualified: { stats: { teamRatePct: number } }[]): number | null {
  if (qualified.length === 0) return null;
  return Math.round(qualified.reduce((sum, row) => sum + row.stats.teamRatePct, 0) / qualified.length);
}

export const TeamTrainingDashboard: React.FC<Props> = ({
  players,
  teamSeasonId,
  trainingCount,
  onPlayerClick,
}) => {
  const [subTab, setSubTab] = useState<TrainingSubTab>('overview');

  const {
    qualified,
    unqualified,
    sessionsCount,
    minimumBasis,
    teamAverageActivityPct,
    loading: rankingLoading,
    error: rankingError,
  } = useTeamTrainingRanking(players, teamSeasonId, true);

  const ranking: TrainingRankingResult = useMemo(
    () => ({
      qualified,
      unqualified,
      sessionsCount,
      minimumBasis,
      teamAverageActivityPct,
    }),
    [qualified, unqualified, sessionsCount, minimumBasis, teamAverageActivityPct],
  );

  const jugglingState = useJugglingChallenge(players, teamSeasonId, true);

  const leader = qualified[0] ?? null;
  const avgTeamPct = useMemo(() => averageTeamParticipationPct(qualified), [qualified]);

  const jugglingAwards = useMemo(() => {
    if (!jugglingState.session) return null;
    const inputs = jugglingState.rows.map((row) => ({
      playerId: row.player.id,
      playerName: row.player.display_name,
      startValue: row.startValue,
      endValue: row.endValue,
    }));
    return deriveJugglingAwards(inputs, jugglingState.session.min_start_for_percent);
  }, [jugglingState.rows, jugglingState.session]);

  const trainingsLabel =
    trainingCount > 0 ? String(trainingCount) : sessionsCount > 0 ? String(sessionsCount) : 'Noch keine Daten';

  const participationLabel =
    avgTeamPct != null
      ? `${avgTeamPct} %`
      : teamAverageActivityPct != null
        ? `${teamAverageActivityPct} %`
        : 'Noch keine Daten';

  const kaiserLabel = leader ? leader.player.display_name : 'Noch keine Wertung';
  const kaiserSub =
    leader && hasTrainingActivityBasis(leader.stats)
      ? `Aktivität ${leader.stats.activityRatePct} %`
      : undefined;

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className="mb-4 sm:p-5">
      <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
        Trainingszentrale
      </SectionTitle>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatSummaryCard label="Trainings" value={trainingsLabel} />
        <StatSummaryCard label="Ø Beteiligung" value={participationLabel} />
        <StatSummaryCard label="Trainingskaiser" value={kaiserLabel} sub={kaiserSub} />
        <StatSummaryCard label="Challenge" value="Jonglier-Challenge" sub="Aktiv · Öffnen" />
      </div>

      <PremiumTabTrack className="mt-4" aria-label="Training Unterbereiche">
        <PremiumTab active={subTab === 'overview'} onClick={() => setSubTab('overview')}>
          Übersicht
        </PremiumTab>
        <PremiumTab active={subTab === 'kaiser'} onClick={() => setSubTab('kaiser')}>
          Kaiser
        </PremiumTab>
        <PremiumTab active={subTab === 'challenge'} onClick={() => setSubTab('challenge')}>
          Challenge
        </PremiumTab>
      </PremiumTabTrack>

      <div className="mt-4" role="tabpanel">
        {subTab === 'overview' ? (
          <div className="space-y-3">
            <TrainingKaiserCard
              players={players}
              teamSeasonId={teamSeasonId}
              onPlayerClick={onPlayerClick}
              variant="overview"
              onViewAll={() => setSubTab('kaiser')}
              ranking={ranking}
              loading={rankingLoading}
              error={rankingError}
            />
            <JugglingChallengeCard variant="teaser" />
            {trainingCount > 0 ? (
              <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-2.5">
                <p className="text-[12px] text-white/60">
                  {trainingCount} vergangene Trainingseinheiten in dieser Saison.
                  {avgTeamPct != null ? ` Ø Team-Beteiligung: ${avgTeamPct} %.` : ''}
                </p>
              </GlassCard>
            ) : null}
          </div>
        ) : null}

        {subTab === 'kaiser' ? (
          <TrainingKaiserCard
            players={players}
            teamSeasonId={teamSeasonId}
            onPlayerClick={onPlayerClick}
            variant="full"
            ranking={ranking}
            loading={rankingLoading}
            error={rankingError}
          />
        ) : null}

        {subTab === 'challenge' ? (
          <JugglingChallengeCard
            variant="full"
            awards={jugglingAwards}
            loading={jugglingState.loading}
          />
        ) : null}
      </div>

      {rankingError ? <p className="mt-3 text-[12px] text-red-300/90">{rankingError}</p> : null}
      {trainingCount === 0 && subTab === 'overview' && !rankingLoading ? (
        <PremiumEmptyState variant="subtle" title="Noch keine Trainingsdaten" className="mt-3 py-4" />
      ) : null}
    </PremiumCard>
  );
};
