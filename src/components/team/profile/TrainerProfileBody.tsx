import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TeamStaffMember } from '../../../hooks/useTeamStaff';
import type { TeamSeasonCoachStats } from '../../../hooks/useTeamSeasonCoachStats';
import type { CoachSeasonAchievements, SeasonMatchCardData, SeasonMatchSummary } from '../../../lib/seasonMatchStats';
import type { PlayerItem } from '../../../hooks/usePlayers';
import { useTeamTrainingSummary } from '../../../hooks/useTeamTrainingSummary';
import { ProfileStatTile } from '../ProfileStatTile';
import { TrainerBalanceCard } from './TrainerBalanceCard';
import { ProfileContactCard } from './ProfileFooterCards';
import { COACH_STAT_TILES } from './profileStatIcons';
import { SeasonMatchSummaryCard } from '../SeasonMatchSummaryCard';
import { SeasonMatchCard } from '../SeasonMatchCard';
import { AppButton } from '../../ui/AppButton';
import { GlassCard } from '../../../ui';

type TrainerProfileTab = 'overview' | 'matches' | 'achievements' | 'training';

const TABS: { id: TrainerProfileTab; label: string }[] = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'matches', label: 'Spiele' },
  { id: 'achievements', label: 'Erfolge' },
  { id: 'training', label: 'Training' },
];

function TrainingSummaryCard({
  label,
  value,
  valueLine2,
  sub,
  compactValue = false,
}: {
  label: string;
  value: string;
  valueLine2?: string;
  sub?: string;
  compactValue?: boolean;
}) {
  return (
    <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-3">
      <p className="text-[11px] font-medium text-white/55">{label}</p>
      <p
        className={[
          'mt-1 break-words font-bold leading-snug text-white',
          compactValue ? 'text-[14px]' : 'text-[18px] tabular-nums',
        ].join(' ')}
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

  const goalRatio =
    seasonSummary.goalsFor > 0 || seasonSummary.goalsAgainst > 0
      ? `${seasonSummary.goalsFor} : ${seasonSummary.goalsAgainst}`
      : '—';

  const trainingBusy = rankingLoading || jugglingLoading;

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
          <div className="grid grid-cols-2 gap-2">
            <TrainingSummaryCard
              label="Siegquote"
              value={
                achievements.winRatePct != null
                  ? `${achievements.winRatePct} %`
                  : seasonSummary.played > 0
                    ? '0 %'
                    : '—'
              }
            />
            <TrainingSummaryCard label="Punkte / Spiel" value={seasonSummary.pointsPerGame} />
            <TrainingSummaryCard label="Torverhältnis" value={goalRatio} />
          </div>

          {matchDetails.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <TrainingSummaryCard
                label="Meiste Tore (Spiel)"
                value={achievements.maxGoalsInGame != null ? String(achievements.maxGoalsInGame) : '—'}
              />
              <TrainingSummaryCard
                label="Längste Siegesserie"
                value={
                  achievements.longestWinStreak != null ? String(achievements.longestWinStreak) : '—'
                }
              />
            </div>
          ) : (
            <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-3">
              <p className="text-center text-[13px] leading-relaxed text-white/65">
                Weitere Erfolge folgen mit mehr Saisonspielen.
              </p>
            </GlassCard>
          )}
        </div>
      ) : null}

      {activeTab === 'training' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <TrainingSummaryCard
              label="Gewertete Trainings"
              value={trainingBusy ? '…' : String(ratedTrainingsCount > 0 ? ratedTrainingsCount : stats.trainings)}
            />
            <TrainingSummaryCard
              label="Ø Mannschaftsbeteiligung"
              value={trainingBusy ? '…' : participationLabel}
            />
            <TrainingSummaryCard
              label="Trainingskaiser"
              value={trainingBusy ? '…' : kaiserName?.primary ?? 'Noch keine Wertung'}
              valueLine2={kaiserName?.secondary}
              sub={kaiserSub}
              compactValue
            />
            <TrainingSummaryCard
              label="Gaberlkönig"
              value={
                trainingBusy
                  ? '…'
                  : gaberlKing
                    ? gaberlKing.playerName
                    : 'Noch keine Daten'
              }
              sub={gaberlKing ? `${gaberlKing.endValue} Gaberl` : undefined}
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
