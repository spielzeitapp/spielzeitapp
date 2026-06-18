import React, { useEffect, useState } from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import { useTeamTrainingSummary } from '../../hooks/useTeamTrainingSummary';
import { countUpcomingTeamTrainings } from '../../lib/trainingSeasonCounts';
import { ProfileHighlightTile } from './ProfileHighlightTile';
import { TrainingOverviewHero } from './TrainingOverviewHero';
import { COACH_STAT_TILES, StatIconTrendingUp } from './profile/profileStatIcons';
import { PARTICIPATION_EXPLICIT_BASIS_SUB } from '../../lib/trainingSummaryDisplay';
import { PremiumCard, PremiumEmptyState, SectionTitle } from '../../ui';
import { Gem } from 'lucide-react';

type Props = {
  players: PlayerItem[];
  teamSeasonId: string;
};

export const TeamTrainingPublicOverview: React.FC<Props> = ({ players, teamSeasonId }) => {
  const { ratedTrainingsCount, participationLabel, ranking, rankingLoading, rankingError } = useTeamTrainingSummary(
    players,
    teamSeasonId,
    true,
  );
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

  const busy = rankingLoading;
  const ratedLabel =
    busy && ratedTrainingsCount === 0
      ? '…'
      : ratedTrainingsCount > 0
        ? String(ratedTrainingsCount)
        : 'Noch keine Daten';

  const ratedSub =
    upcomingTrainings > 0
      ? `${upcomingTrainings} ausständig`
      : ratedTrainingsCount > 0
        ? 'Basis dieser Saison'
        : undefined;

  return (
    <PremiumCard
      variant="subtle"
      showAmbientGlow={false}
      className="mb-4 w-full max-w-none !px-3 !py-4 sm:!px-5 sm:!py-5"
    >
      <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
        Trainingszentrale
      </SectionTitle>

      <div className="mt-4">
        <TrainingOverviewHero
          sessionsCount={ratedTrainingsCount}
          participationLabel={busy ? '…' : participationLabel}
          sessions={ranking.sessionParticipations}
          loading={busy}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <ProfileHighlightTile
          icon={<COACH_STAT_TILES.trainings />}
          title="Trainings"
          value={ratedLabel}
          sub={ratedSub}
        />
        <ProfileHighlightTile
          icon={<StatIconTrendingUp />}
          title="Ø Beteiligung"
          value={busy ? '…' : participationLabel}
          sub={participationLabel !== 'Noch keine Daten' ? PARTICIPATION_EXPLICIT_BASIS_SUB : undefined}
        />
        <ProfileHighlightTile
          icon={<Gem className="h-[4.75rem] w-[4.75rem] text-red-400/[0.18]" strokeWidth={1.4} aria-hidden />}
          title="Challenge"
          value="Gaberl-Challenge"
          sub="Aktiv · Öffnen"
          className="col-span-2"
          compactValue
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.22)] bg-gradient-to-br from-[rgba(18,18,20,0.98)] to-[rgba(60,10,18,0.18)] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_rgba(220,38,38,0.08)]">
        <p className="text-[12px] leading-relaxed text-white/60">
          Mannschaftswerte aus vergangenen Team-Trainings. Ausständige Termine zählen nicht.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-white/50">
          Persönliche Spielerquote und Aktivität findest du im Spielerprofil deines Kindes.
        </p>
      </div>

      {rankingError ? <p className="mt-3 text-[12px] text-red-300/90">{rankingError}</p> : null}

      {!busy && ratedTrainingsCount === 0 ? (
        <PremiumEmptyState variant="subtle" title="Noch keine Trainingsdaten" className="mt-4 py-4" />
      ) : null}
    </PremiumCard>
  );
};
