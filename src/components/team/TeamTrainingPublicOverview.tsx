import React from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import { useTeamTrainingSummary } from '../../hooks/useTeamTrainingSummary';
import { ProfileHighlightTile } from './ProfileHighlightTile';
import { COACH_STAT_TILES, StatIconTrendingUp } from './profile/profileStatIcons';
import { PARTICIPATION_EXPLICIT_BASIS_SUB } from '../../lib/trainingSummaryDisplay';
import { GlassCard, PremiumCard, PremiumEmptyState, SectionTitle } from '../../ui';
import { Gem } from 'lucide-react';

type Props = {
  players: PlayerItem[];
  teamSeasonId: string;
};

export const TeamTrainingPublicOverview: React.FC<Props> = ({ players, teamSeasonId }) => {
  const { ratedTrainingsCount, participationLabel, rankingLoading } = useTeamTrainingSummary(
    players,
    teamSeasonId,
    true,
  );

  const busy = rankingLoading;
  const ratedLabel =
    busy && ratedTrainingsCount === 0
      ? '…'
      : ratedTrainingsCount > 0
        ? String(ratedTrainingsCount)
        : '0';

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className="mb-4 w-full max-w-none !px-3 !py-4 sm:!px-5 sm:!py-5">
      <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
        Training
      </SectionTitle>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <ProfileHighlightTile
          icon={<COACH_STAT_TILES.trainings />}
          title="Gewertete Trainings"
          value={ratedLabel}
          sub={ratedTrainingsCount > 0 ? 'Basis dieser Saison' : undefined}
        />
        <ProfileHighlightTile
          icon={<StatIconTrendingUp />}
          title="Ø Beteiligung"
          value={busy ? '…' : participationLabel}
          sub={participationLabel !== 'Noch keine Daten' ? PARTICIPATION_EXPLICIT_BASIS_SUB : undefined}
        />
        <ProfileHighlightTile
          icon={<Gem className="h-[4.75rem] w-[4.75rem] text-red-400/[0.18]" strokeWidth={1.4} aria-hidden />}
          title="Aktive Challenge"
          value="Gaberl-Challenge"
          sub="Team-Challenge läuft"
          className="col-span-2"
          compactValue
        />
      </div>

      <GlassCard variant="subtle" showAmbientGlow={false} className="mt-4 px-3.5 py-3">
        <p className="text-[12px] leading-relaxed text-white/60">
          Trainingswerte werden aus vergangenen Teamtrainings berechnet.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-white/55">
          Für persönliche Trainingswerte öffne das Spielerprofil deines Kindes.
        </p>
      </GlassCard>

      {!busy && ratedTrainingsCount === 0 ? (
        <PremiumEmptyState variant="subtle" title="Noch keine Trainingsdaten" className="mt-4 py-4" />
      ) : null}
    </PremiumCard>
  );
};
