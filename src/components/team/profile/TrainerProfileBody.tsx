import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Gem } from 'lucide-react';
import type { TeamStaffMember } from '../../../hooks/useTeamStaff';
import type { TeamSeasonCoachStats } from '../../../hooks/useTeamSeasonCoachStats';
import type { CoachSeasonAchievements, SeasonMatchCardData, SeasonMatchSummary } from '../../../lib/seasonMatchStats';
import type { PlayerItem } from '../../../hooks/usePlayers';
import { useTeamTrainingSummary } from '../../../hooks/useTeamTrainingSummary';
import { buildTrainerAchievementHighlights } from '../../../lib/trainerAchievementDisplay';
import { PARTICIPATION_EXPLICIT_BASIS_SUB } from '../../../lib/trainingSummaryDisplay';
import { ProfileStatTile } from '../ProfileStatTile';
import { ProfileHighlightTile } from '../ProfileHighlightTile';
import { TrainerBalanceCard } from './TrainerBalanceCard';
import { ProfileContactCard } from './ProfileFooterCards';
import { COACH_STAT_TILES, StatIconTrendingUp } from './profileStatIcons';
import { SeasonMatchSummaryCard } from '../SeasonMatchSummaryCard';
import { SeasonMatchCard } from '../SeasonMatchCard';
import { AppButton } from '../../ui/AppButton';
import { GlassCard, PremiumEmptyState } from '../../../ui';

type TrainerProfileTab = 'overview' | 'matches' | 'achievements' | 'training';

const TABS: { id: TrainerProfileTab; label: string }[] = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'matches', label: 'Spiele' },
  { id: 'achievements', label: 'Erfolge' },
  { id: 'training', label: 'Training' },
];

const ACHIEVEMENT_ICONS = [
  COACH_STAT_TILES.wins,
  COACH_STAT_TILES.pointsPerGame,
  COACH_STAT_TILES.goalsFor,
  Flame,
  COACH_STAT_TILES.goalsFor,
] as const;

function FlameWatermark({ className = 'h-[4.75rem] w-[4.75rem] text-red-400/[0.18]' }: { className?: string }) {
  return <Flame className={className} strokeWidth={1.6} aria-hidden />;
}

function GemWatermark({ className = 'h-[4.75rem] w-[4.75rem] text-red-400/[0.18]' }: { className?: string }) {
  return <Gem className={className} strokeWidth={1.4} aria-hidden />;
}

type Props = {
  member: TeamStaffMember;
  teamSeasonId: string;
  teamName: string;
  players: PlayerItem[];
  stats: TeamSeasonCoachStats;
  seasonSummary: SeasonMatchSummary;
  statsLoading: boolean;
  statsError: string | null;
  matchDetails: SeasonMatchCardData[];
  recentMatches: SeasonMatchCardData[];
  matchesLoading: boolean;
  matchesError: string | null;
  achievements: CoachSeasonAchievements;
  canManage: boolean;
  onEdit: () => void;
};

export const TrainerProfileBody: React.FC<Props> = ({
  member,
  teamSeasonId,
  teamName,
  players,
  stats,
  seasonSummary,
  statsLoading,
  statsError,
  matchDetails,
  recentMatches,
  matchesLoading,
  matchesError,
  achievements,
  canManage,
  onEdit,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TrainerProfileTab>('overview');

  const trainingEnabled = Boolean(teamSeasonId);
  const {
    ratedTrainingsCount,
    participationLabel,
    kaiserName,
    kaiserSub,
    gaberlKing,
    rankingLoading,
    jugglingLoading,
  } = useTeamTrainingSummary(players, teamSeasonId, trainingEnabled);

  const overviewTiles = useMemo(
    () =>
      [
        { Icon: COACH_STAT_TILES.games, label: 'Spiele', value: String(stats.matches) },
        { Icon: COACH_STAT_TILES.wins, label: 'Siege', value: String(stats.wins) },
        { Icon: COACH_STAT_TILES.goalsFor, label: 'Tore Team', value: String(stats.goalsFor) },
        { Icon: COACH_STAT_TILES.goalsAgainst, label: 'Gegentore', value: String(stats.goalsAgainst) },
        { Icon: COACH_STAT_TILES.pointsPerGame, label: 'Punkte / Spiel', value: stats.pointsPerGame },
        { Icon: COACH_STAT_TILES.trainings, label: 'Trainings', value: String(stats.trainings) },
      ] as const,
    [stats],
  );

  const trainingBusy = rankingLoading || jugglingLoading;

  const achievementHighlights = useMemo(
    () => buildTrainerAchievementHighlights(achievements, seasonSummary),
    [achievements, seasonSummary],
  );

  const ratedTrainingsValue = trainingBusy
    ? '…'
    : String(ratedTrainingsCount > 0 ? ratedTrainingsCount : stats.trainings);

  return (
    <>
      <div className="sticky top-0 z-10 -mx-3 mb-4 mt-4 border-b border-white/10 bg-[linear-gradient(180deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.82)_100%)] px-1 py-1.5 backdrop-blur-md sm:-mx-4">
        <div className="flex gap-1 rounded-xl border border-white/10 bg-black/40 p-0.5">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={[
                  'min-h-[34px] flex-1 rounded-lg px-1 py-1.5 text-[12px] font-bold transition-all sm:min-h-[38px] sm:px-1.5',
                  active
                    ? 'border border-red-500/40 bg-red-600/25 text-white shadow-[0_0_20px_rgba(220,38,38,0.35)]'
                    : 'border border-transparent text-white/60 hover:text-white/80',
                ].join(' ')}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {statsLoading
              ? [0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={`trainer-stat-skel-${i}`}
                    className="h-[4.75rem] animate-pulse rounded-2xl border border-white/5 bg-white/[0.07]"
                  />
                ))
              : overviewTiles.map((s) => (
                  <ProfileStatTile key={s.label} icon={<s.Icon />} label={s.label} value={s.value} />
                ))}
          </div>
          {!statsLoading && !statsError ? (
            <TrainerBalanceCard wins={stats.wins} draws={stats.draws} losses={stats.losses} />
          ) : null}
          {statsError ? (
            <p className="mt-2 text-center text-[11px] text-amber-400/95">{statsError}</p>
          ) : null}
          {!statsLoading && !statsError && stats.matches === 0 && stats.trainings === 0 ? (
            <p className="mt-2 text-center text-[12px] text-white/60">Noch keine Saisondaten</p>
          ) : null}
        </>
      ) : null}

      {activeTab === 'matches' ? (
        <div className="space-y-4">
          <SeasonMatchSummaryCard summary={seasonSummary} loading={matchesLoading || statsLoading} />

          {matchesError ? (
            <p className="text-center text-[11px] text-amber-400/95">{matchesError}</p>
          ) : null}

          <div>
            <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
              Letzte Spiele
            </h3>
            {matchesLoading ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div
                    key={`match-skel-${i}`}
                    className="h-16 animate-pulse rounded-2xl border border-white/5 bg-white/[0.07]"
                  />
                ))}
              </div>
            ) : recentMatches.length === 0 ? (
              <p className="text-center text-[12px] text-white/60">
                {matchDetails.length > 0
                  ? 'Noch keine abgeschlossenen Spiele'
                  : 'Noch keine gültigen Spiele erfasst.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {recentMatches.map((m) => (
                  <li key={m.id}>
                    <SeasonMatchCard match={m} ourTeamName={teamName} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'achievements' ? (
        <div className="space-y-3">
          {achievementHighlights ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {achievementHighlights.map((item, index) => {
                const Icon = ACHIEVEMENT_ICONS[index] ?? COACH_STAT_TILES.wins;
                const iconNode =
                  Icon === Flame ? <FlameWatermark /> : <Icon />;
                return (
                  <ProfileHighlightTile
                    key={item.title}
                    icon={iconNode}
                    title={item.title}
                    value={item.value}
                    sub={item.sub}
                    compactValue={item.title === 'Torverhältnis'}
                  />
                );
              })}
            </div>
          ) : (
            <GlassCard variant="subtle" showAmbientGlow={false} className="px-4 py-6">
              <PremiumEmptyState
                variant="subtle"
                title="Erfolge entstehen mit den ersten Spielen."
                className="py-2"
              />
            </GlassCard>
          )}
        </div>
      ) : null}

      {activeTab === 'training' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            <ProfileHighlightTile
              icon={<COACH_STAT_TILES.trainings />}
              title="Gewertete Trainings"
              value={ratedTrainingsValue}
              sub={ratedTrainingsCount > 0 ? 'Basis dieser Saison' : undefined}
            />
            <ProfileHighlightTile
              icon={<StatIconTrendingUp />}
              title="Ø Beteiligung"
              value={trainingBusy ? '…' : participationLabel}
              sub={participationLabel !== 'Noch keine Daten' ? PARTICIPATION_EXPLICIT_BASIS_SUB : undefined}
            />
            <ProfileHighlightTile
              icon={<COACH_STAT_TILES.wins />}
              title="Trainingskaiser"
              value={trainingBusy ? '…' : kaiserName?.primary ?? 'Noch keine Wertung'}
              valueLine2={kaiserName?.secondary}
              sub={kaiserSub}
              compactValue
            />
            <ProfileHighlightTile
              icon={<GemWatermark />}
              title="Gaberlkönig"
              value={
                trainingBusy
                  ? '…'
                  : gaberlKing
                    ? gaberlKing.playerName
                    : 'Noch keine Daten'
              }
              sub={gaberlKing ? `${gaberlKing.endValue} Gaberl` : 'Challenge starten'}
              compactValue
            />
          </div>

          <AppButton
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => navigate('/app/team?tab=training')}
          >
            Zur Trainingszentrale
          </AppButton>
        </div>
      ) : null}

      <div className="mt-6">
        <ProfileContactCard phone={member.phone} email={member.email} />
      </div>

      {canManage ? (
        <div className="mt-5 pb-1">
          <AppButton type="button" variant="primary" size="lg" fullWidth onClick={onEdit}>
            Bearbeiten
          </AppButton>
        </div>
      ) : null}
    </>
  );
};
