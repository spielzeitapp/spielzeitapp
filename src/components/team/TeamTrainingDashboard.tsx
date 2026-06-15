import React, { useEffect, useMemo, useState } from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import { useTeamTrainingRanking } from '../../hooks/useTeamTrainingRanking';
import { useJugglingChallenge } from '../../hooks/useJugglingChallenge';
import { deriveJugglingAwards } from '../../lib/challengeScoring';
import { countUpcomingTeamTrainings } from '../../lib/trainingSeasonCounts';
import {
  averageQualifiedTeamRatePct,
  hasTrainingActivityBasis,
  type TrainingRankingResult,
} from '../../lib/trainingRanking';
import { TrainingKaiserCard } from './TrainingKaiserCard';
import { JugglingChallengeCard } from './JugglingChallengeCard';
import { GlassCard, PremiumCard, PremiumEmptyState, PremiumTab, PremiumTabTrack, SectionTitle } from '../../ui';
import { cn } from '../../ui/lib/cn';

type TrainingSubTab = 'overview' | 'kaiser' | 'challenge';

type Props = {
  players: PlayerItem[];
  teamSeasonId: string;
  onPlayerClick?: (player: PlayerItem) => void;
};

function StatSummaryCard({
  label,
  value,
  valueLine2,
  sub,
  className,
  compactValue = false,
}: {
  label: string;
  value: string;
  valueLine2?: string;
  sub?: string;
  className?: string;
  compactValue?: boolean;
}) {
  return (
    <GlassCard variant="subtle" showAmbientGlow={false} className={cn('px-3.5 py-3', className)}>
      <p className="text-[11px] font-medium text-white/55">{label}</p>
      <p
        className={cn(
          'mt-1 break-words font-bold leading-snug text-white',
          compactValue ? 'text-[14px]' : 'line-clamp-2 text-[15px]',
        )}
      >
        {value}
      </p>
      {valueLine2 ? (
        <p className="break-words text-[13px] font-semibold leading-snug text-white/90">{valueLine2}</p>
      ) : null}
      {sub ? <p className="mt-0.5 break-words text-[11px] leading-snug text-white/50">{sub}</p> : null}
    </GlassCard>
  );
}

function kaiserTileName(player: PlayerItem): { primary: string; secondary?: string } {
  const first = (player.first_name ?? '').trim();
  const last = (player.last_name ?? '').trim();
  if (first) {
    return last ? { primary: first, secondary: last } : { primary: first };
  }
  const parts = player.display_name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { primary: parts[0], secondary: parts.slice(1).join(' ') };
  }
  return { primary: parts[0] ?? '—' };
}

export const TeamTrainingDashboard: React.FC<Props> = ({
  players,
  teamSeasonId,
  onPlayerClick,
}) => {
  const [subTab, setSubTab] = useState<TrainingSubTab>('overview');
  const [upcomingTrainings, setUpcomingTrainings] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void countUpcomingTeamTrainings(teamSeasonId).then((count) => {
      if (!cancelled) setUpcomingTrainings(count);
    });
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId]);

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
  const avgTeamPct = useMemo(() => averageQualifiedTeamRatePct(qualified), [qualified]);

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

  const ratedTrainingsCount = sessionsCount;
  const ratedTrainingsLabel =
    rankingLoading && ratedTrainingsCount === 0
      ? '…'
      : ratedTrainingsCount > 0
        ? String(ratedTrainingsCount)
        : 'Noch keine Daten';

  const ratedTrainingsSub =
    upcomingTrainings > 0 ? `${upcomingTrainings} ausständig` : undefined;

  const participationLabel =
    avgTeamPct != null
      ? `${avgTeamPct} %`
      : teamAverageActivityPct != null
        ? `${teamAverageActivityPct} %`
        : 'Noch keine Daten';

  const kaiserName = leader ? kaiserTileName(leader.player) : null;
  const kaiserSub =
    leader && hasTrainingActivityBasis(leader.stats)
      ? `${leader.stats.activityRatePct} % Aktivität`
      : undefined;

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className="mb-4 w-full max-w-none !px-3 !py-4 sm:!px-5 sm:!py-5">
      <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
        Trainingszentrale
      </SectionTitle>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <StatSummaryCard
          label="Gewertete Trainings"
          value={ratedTrainingsLabel}
          sub={ratedTrainingsSub}
        />
        <StatSummaryCard label="Ø Beteiligung" value={participationLabel} />
        <StatSummaryCard
          label="🥇 Trainingskaiser"
          value={kaiserName?.primary ?? 'Noch keine Wertung'}
          valueLine2={kaiserName?.secondary}
          sub={kaiserSub}
          compactValue
        />
        <StatSummaryCard label="Challenge" value="Gaberl-Challenge" sub="Aktiv · Öffnen" />
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
              embedded
              onViewAll={() => setSubTab('kaiser')}
              ranking={ranking}
              loading={rankingLoading}
              error={rankingError}
            />
            <JugglingChallengeCard variant="teaser" />
            {ratedTrainingsCount > 0 ? (
              <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-2.5">
                <p className="text-[12px] text-white/60">
                  {ratedTrainingsCount} gewertete Team-Trainings in dieser Saison.
                  {avgTeamPct != null ? ` Ø gewertete Spieler (Beteiligung): ${avgTeamPct} %.` : ''}
                  {upcomingTrainings > 0 ? ` ${upcomingTrainings} ausständig.` : ''}
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
      {ratedTrainingsCount === 0 && subTab === 'overview' && !rankingLoading ? (
        <PremiumEmptyState variant="subtle" title="Noch keine Trainingsdaten" className="mt-3 py-4" />
      ) : null}
    </PremiumCard>
  );
};
