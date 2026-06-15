import React, { useEffect, useState } from 'react';
import { Gem } from 'lucide-react';
import type { PlayerItem } from '../../hooks/usePlayers';
import { useTeamTrainingSummary } from '../../hooks/useTeamTrainingSummary';
import { countUpcomingTeamTrainings } from '../../lib/trainingSeasonCounts';
import type { TrainingRankingResult } from '../../lib/trainingRanking';
import { TrainingKaiserCard } from './TrainingKaiserCard';
import { JugglingChallengeCard } from './JugglingChallengeCard';
import { ProfileHighlightTile } from './ProfileHighlightTile';
import { COACH_STAT_TILES, StatIconTrendingUp } from './profile/profileStatIcons';
import { GlassCard, PremiumCard, PremiumEmptyState, PremiumTab, PremiumTabTrack, SectionTitle } from '../../ui';

type TrainingSubTab = 'overview' | 'kaiser' | 'challenge';

type Props = {
  players: PlayerItem[];
  teamSeasonId: string;
  onPlayerClick?: (player: PlayerItem) => void;
};

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
    ranking,
    ratedTrainingsCount,
    participationLabel,
    kaiserName,
    kaiserSub,
    jugglingAwards,
    jugglingLoading,
    rankingLoading,
    rankingError,
  } = useTeamTrainingSummary(players, teamSeasonId, true);

  const ratedTrainingsLabel =
    rankingLoading && ratedTrainingsCount === 0
      ? '…'
      : ratedTrainingsCount > 0
        ? String(ratedTrainingsCount)
        : 'Noch keine Daten';

  const ratedTrainingsSub =
    upcomingTrainings > 0 ? `${upcomingTrainings} ausständig` : undefined;

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className="mb-4 w-full max-w-none !px-3 !py-4 sm:!px-5 sm:!py-5">
      <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
        Trainingszentrale
      </SectionTitle>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <ProfileHighlightTile
          icon={<COACH_STAT_TILES.trainings />}
          title="Gewertete Trainings"
          value={ratedTrainingsLabel}
          sub={ratedTrainingsSub ?? (ratedTrainingsCount > 0 ? 'Basis dieser Saison' : undefined)}
        />
        <ProfileHighlightTile
          icon={<StatIconTrendingUp />}
          title="Ø Beteiligung"
          value={participationLabel}
          sub={participationLabel !== 'Noch keine Daten' ? 'aus gewerteten Trainings' : undefined}
        />
        <ProfileHighlightTile
          icon={<COACH_STAT_TILES.wins />}
          title="Trainingskaiser"
          value={kaiserName?.primary ?? 'Noch keine Wertung'}
          valueLine2={kaiserName?.secondary}
          sub={kaiserSub}
          compactValue
        />
        <ProfileHighlightTile
          icon={<Gem className="h-[4.75rem] w-[4.75rem] text-red-400/[0.18]" strokeWidth={1.4} aria-hidden />}
          title="Challenge"
          value="Gaberl-Challenge"
          sub="Aktiv · Öffnen"
          compactValue
        />
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
                  {ranking.qualified.length > 0 && participationLabel !== 'Noch keine Daten'
                    ? ` Ø gewertete Spieler (Beteiligung): ${participationLabel}.`
                    : ''}
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
            loading={jugglingLoading}
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
