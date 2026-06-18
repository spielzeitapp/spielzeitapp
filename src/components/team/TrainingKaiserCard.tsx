import React from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import { PlayerSpecialStatusBadges } from '../player/PlayerSpecialStatusBadges';
import {
  activityRateColorClass,
  getValuableTrainingCount,
  hasTrainingActivityBasis,
  hasTrainingTeamBasis,
  podiumMedal,
  teamRateTrafficLightClass,
  teamRateTrafficLightDotClass,
  type TrainingRankingRow,
} from '../../lib/trainingRanking';
import { GlassCard, PremiumButton, PremiumCard, PremiumEmptyState, SectionTitle } from '../../ui';
import { cn } from '../../ui/lib/cn';

import type { TrainingRankingResult } from '../../lib/trainingRanking';

type Props = {
  players: PlayerItem[];
  teamSeasonId: string;
  onPlayerClick?: (player: PlayerItem) => void;
  variant?: 'full' | 'overview';
  embedded?: boolean;
  onViewAll?: () => void;
  ranking: TrainingRankingResult;
  loading: boolean;
  error: string | null;
};

const PODIUM_CARD_CLASS =
  'overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.22)] bg-gradient-to-br from-[rgba(18,18,20,0.98)] to-[rgba(60,10,18,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_rgba(220,38,38,0.08)]';

const PODIUM_ROW_CLASS =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-[rgba(220,38,38,0.14)] bg-[rgba(8,8,10,0.72)] px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition';

function jerseyLabel(player: PlayerItem): string | null {
  const n = player.jersey_number;
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return `#${Math.trunc(n)}`;
  return null;
}

function formatTrainingBasisLine(row: TrainingRankingRow, sessionsCount: number): string {
  const valuable = getValuableTrainingCount(row.stats);
  const unit = sessionsCount === 1 ? 'Training' : 'Trainings';
  return `Trainingsbasis: ${valuable} von ${sessionsCount} ${unit}`;
}

function formatTeamLine(row: TrainingRankingRow): string {
  const { stats } = row;
  if (!hasTrainingTeamBasis(stats)) return 'Teamtraining: Keine Trainingsbasis';
  const basis = stats.present + stats.absent;
  return `Trainingsquote: ${stats.teamRatePct} % · ${stats.present} von ${basis}`;
}

function formatActivityDetailLine(row: TrainingRankingRow): string {
  const { stats } = row;
  if (!hasTrainingActivityBasis(stats)) return 'Aktivität gesamt: Keine Trainingsbasis';
  const basis = getValuableTrainingCount(stats);
  const numerator = stats.present + stats.external;
  return `Aktivität gesamt: ${stats.activityRatePct} % · ${numerator} von ${basis}`;
}

function formatCompletedTrainings(row: TrainingRankingRow): string {
  const completed = row.stats.present + row.stats.external;
  const basis = getValuableTrainingCount(row.stats);
  const unit = basis === 1 ? 'Training' : 'Trainings';
  return `${completed} von ${basis} ${unit} absolviert`;
}

function TeamRateTrafficLightDot({ pct }: { pct: number }) {
  return (
    <span
      className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', teamRateTrafficLightDotClass(pct))}
      aria-hidden
    />
  );
}

function InjuredLine({ count }: { count: number }) {
  if (count <= 0) return null;
  return <p className="text-[11px] text-white/45">Verletzt: {count}</p>;
}

function SickLine({ count }: { count: number }) {
  if (count <= 0) return null;
  return <p className="text-[11px] text-white/45">Krank: {count}</p>;
}

function PlayerNameWithTrafficLight({
  row,
  showMedal = false,
}: {
  row: TrainingRankingRow;
  showMedal?: boolean;
}) {
  const hasTeamBasis = hasTrainingTeamBasis(row.stats);
  const trafficPct = hasTeamBasis ? row.stats.teamRatePct : 0;

  return (
    <span className="flex min-w-0 flex-1 items-start gap-2">
      {showMedal ? (
        <span className="shrink-0 text-[22px] leading-none" aria-hidden>
          {podiumMedal(row.rank)}
        </span>
      ) : (
        <span className="shrink-0 pt-1.5" aria-hidden>
          {hasTeamBasis ? <TeamRateTrafficLightDot pct={trafficPct} /> : null}
        </span>
      )}
      <span className="min-w-0">
        <span className="block break-words text-[15px] font-semibold leading-snug text-white">
          {row.player.display_name}
        </span>
        <PlayerSpecialStatusBadges
          isLaz={row.player.is_laz_player}
          isInjured={row.player.is_injured}
          size="xs"
          className="mt-1"
        />
      </span>
    </span>
  );
}

function KaiserFeaturedCard({
  row,
  onPlayerClick,
}: {
  row: TrainingRankingRow;
  onPlayerClick?: (player: PlayerItem) => void;
}) {
  const hasBasis = hasTrainingActivityBasis(row.stats);
  const pctClass = hasBasis ? activityRateColorClass(row.stats.activityRatePct) : 'text-white/50';

  return (
    <button
      type="button"
      onClick={() => onPlayerClick?.(row.player)}
      disabled={!onPlayerClick}
      className={cn(
        `${PODIUM_CARD_CLASS} relative w-full px-3.5 py-3.5 text-left`,
        onPlayerClick ? 'cursor-pointer hover:border-[rgba(220,38,38,0.35)] active:scale-[0.99]' : 'cursor-default',
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(220,38,38,0.14)_0%,transparent_55%)]"
        aria-hidden
      />
      <div className="relative">
        <p className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-200/90">
          <span className="mr-1" aria-hidden>
            🥇
          </span>
          Trainingskaiser
        </p>
        <p className="mt-2 break-words text-[18px] font-bold leading-tight text-white">{row.player.display_name}</p>
        <PlayerSpecialStatusBadges
          isLaz={row.player.is_laz_player}
          isInjured={row.player.is_injured}
          size="xs"
          className="mt-1.5"
        />
        <p className={cn('mt-2 whitespace-nowrap text-[22px] font-bold tabular-nums leading-none', pctClass)}>
          {hasBasis ? `${row.stats.activityRatePct} %` : '—'}
          {hasBasis ? <span className="ml-1.5 text-[12px] font-semibold text-white/55">Aktivität</span> : null}
        </p>
        {hasBasis ? (
          <p className="mt-1.5 whitespace-nowrap text-[12px] text-white/50">{formatCompletedTrainings(row)}</p>
        ) : null}
      </div>
    </button>
  );
}

function PodiumRow({
  row,
  onPlayerClick,
}: {
  row: TrainingRankingRow;
  onPlayerClick?: (player: PlayerItem) => void;
}) {
  const hasActivityBasis = hasTrainingActivityBasis(row.stats);
  const hasTeamBasis = hasTrainingTeamBasis(row.stats);
  const activityClass = hasActivityBasis ? activityRateColorClass(row.stats.activityRatePct) : 'text-white/50';
  const teamClass = hasTeamBasis ? teamRateTrafficLightClass(row.stats.teamRatePct) : 'text-white/50';

  return (
    <button
      type="button"
      onClick={() => onPlayerClick?.(row.player)}
      disabled={!onPlayerClick}
      className={cn(
        PODIUM_ROW_CLASS,
        onPlayerClick ? 'cursor-pointer hover:border-[rgba(220,38,38,0.32)] hover:bg-[rgba(12,8,10,0.88)] active:scale-[0.99]' : 'cursor-default',
      )}
    >
      <PlayerNameWithTrafficLight row={row} showMedal />
      <span className="shrink-0 text-right">
        <span className={cn('block text-[17px] font-bold tabular-nums', activityClass)}>
          {hasActivityBasis ? `${row.stats.activityRatePct} %` : '—'}
        </span>
        {hasTeamBasis ? (
          <span className={cn('mt-0.5 block whitespace-nowrap text-[10px] font-medium tabular-nums', teamClass)}>
            Trainingsquote {row.stats.teamRatePct} %
          </span>
        ) : null}
      </span>
    </button>
  );
}

function RankingCard({
  row,
  sessionsCount,
  onPlayerClick,
  showRank = true,
  lowBasis = false,
}: {
  row: TrainingRankingRow;
  sessionsCount: number;
  onPlayerClick?: (player: PlayerItem) => void;
  showRank?: boolean;
  lowBasis?: boolean;
}) {
  const jersey = jerseyLabel(row.player);
  const hasActivityBasis = hasTrainingActivityBasis(row.stats);
  const hasTeamBasis = hasTrainingTeamBasis(row.stats);
  const activityClass = hasActivityBasis ? activityRateColorClass(row.stats.activityRatePct) : 'text-white/50';
  const teamClass = hasTeamBasis ? teamRateTrafficLightClass(row.stats.teamRatePct) : 'text-white/50';

  return (
    <button
      type="button"
      onClick={() => onPlayerClick?.(row.player)}
      disabled={!onPlayerClick}
      className={cn(
        'w-full rounded-xl border px-3 py-3 text-left transition',
        lowBasis ? 'border-amber-500/20 bg-amber-950/15' : 'border-[rgba(220,38,38,0.14)] bg-[rgba(8,8,10,0.72)]',
        onPlayerClick ? 'cursor-pointer hover:border-[rgba(220,38,38,0.32)] hover:bg-[rgba(12,8,10,0.88)] active:scale-[0.99]' : 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-start gap-2 text-[14px] font-semibold leading-snug text-white">
            <span className="mr-1.5 shrink-0 pt-1" aria-hidden>
              {hasTeamBasis ? <TeamRateTrafficLightDot pct={row.stats.teamRatePct} /> : null}
            </span>
            <span className="min-w-0">
              {showRank ? <span className="mr-1.5 tabular-nums text-white/45">{row.rank}.</span> : null}
              <span className="break-words">{row.player.display_name}</span>
              <PlayerSpecialStatusBadges
                isLaz={row.player.is_laz_player}
                isInjured={row.player.is_injured}
                size="xs"
                className="mt-1"
              />
            </span>
          </p>
          <p className="mt-1 whitespace-nowrap text-[12px] text-white/55">
            {jersey ? `${jersey} · ` : ''}
            <span className={cn('font-semibold', activityClass)}>
              {hasActivityBasis ? `Aktivität ${row.stats.activityRatePct} %` : 'Keine Trainingsbasis'}
            </span>
            {hasTeamBasis ? (
              <span className={cn('ml-2 font-semibold', teamClass)}>Trainingsquote {row.stats.teamRatePct} %</span>
            ) : null}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-white/60">{formatTrainingBasisLine(row, sessionsCount)}</p>
      {lowBasis ? (
        <p className="mt-1 text-[11px] font-medium text-amber-300/85">zu geringe Trainingsbasis</p>
      ) : (
        <>
          <p className="mt-2 whitespace-nowrap text-[12px] text-white/60">
            Dabei {row.stats.present} · LAZ {row.stats.external} · Abwesend {row.stats.absent}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/50">{formatTeamLine(row)}</p>
          <p className="text-[11px] leading-relaxed text-white/50">{formatActivityDetailLine(row)}</p>
        </>
      )}
      <SickLine count={row.stats.sick} />
      <InjuredLine count={row.stats.injured} />
    </button>
  );
}

export const TrainingKaiserCard: React.FC<Props> = ({
  players: _players,
  teamSeasonId: _teamSeasonId,
  onPlayerClick,
  variant = 'full',
  embedded = false,
  onViewAll,
  ranking,
  loading,
  error,
}) => {
  const {
    qualified,
    unqualified,
    sessionsCount,
    minimumBasis,
    teamAverageActivityPct,
  } = ranking;

  const topThree = qualified.slice(0, 3);
  const kaiserLeader = topThree[0] ?? null;
  const runnerUps = topThree.slice(1);
  const restQualified = qualified.slice(3);
  const hasPlayers = qualified.length > 0 || unqualified.length > 0;
  const isOverview = variant === 'overview';

  const body = (
    <>
      {!isOverview ? (
        <SectionTitle
          as="h2"
          subtitle="Ø Beteiligung = Dabei / (Dabei + Abwesend). Trainingskaiser bewertet Aktivität: Dabei + LAZ."
          subtitleClassName="mt-1.5 text-[12px] leading-relaxed text-white/55"
          className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case"
        >
          <span className="mr-1.5" aria-hidden>
            🏆
          </span>
          Trainingskaiser
        </SectionTitle>
      ) : (
        <>
          <SectionTitle as="h3" className="[&>h3]:text-base [&>h3]:font-semibold [&>h3]:normal-case">
            Trainingskaiser
          </SectionTitle>
          <p className="mt-1 text-[11px] leading-relaxed text-white/50">
            Trainingskaiser bewertet Aktivität: Dabei + LAZ.
          </p>
        </>
      )}

      {loading ? (
        <p className="mt-4 text-[13px] text-white/65">Lade Trainingsranking…</p>
      ) : error ? (
        <p className="mt-4 text-[13px] text-red-300/90">{error}</p>
      ) : sessionsCount === 0 ? (
        <PremiumEmptyState
          variant="subtle"
          title="Noch keine vergangenen Trainings erfasst."
          className="mt-3 py-6"
        />
      ) : !hasPlayers ? (
        <PremiumEmptyState variant="subtle" title="Keine aktiven Spieler im Kader." className="mt-3 py-6" />
      ) : (
        <div className={isOverview ? 'mt-3 space-y-3' : 'mt-4 space-y-4'}>
          {qualified.length === 0 ? (
            <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-2.5">
              <p className="text-[12px] text-white/60">
                Noch kein Spieler mit mindestens {minimumBasis} wertbaren Trainings (30 % von {sessionsCount}).
              </p>
            </GlassCard>
          ) : (
            <>
              {topThree.length > 0 ? (
                <div className="space-y-2">
                  {isOverview && kaiserLeader ? (
                    <KaiserFeaturedCard row={kaiserLeader} onPlayerClick={onPlayerClick} />
                  ) : null}
                  {(isOverview ? runnerUps : topThree).map((row) => (
                    <PodiumRow key={row.player.id} row={row} onPlayerClick={onPlayerClick} />
                  ))}
                </div>
              ) : null}

              {isOverview ? (
                <>
                  <p className="text-[11px] leading-relaxed text-white/50">
                    Mindestbasis: {minimumBasis} wertbare Trainings (30 % von {sessionsCount}).
                  </p>
                  {onViewAll ? (
                    <PremiumButton type="button" variant="interactive" fullWidth onClick={onViewAll}>
                      Alle anzeigen
                    </PremiumButton>
                  ) : null}
                </>
              ) : null}

              {!isOverview && teamAverageActivityPct != null ? (
                <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-white/85">
                    <span className="mr-1.5" aria-hidden>
                      📊
                    </span>
                    Ø Trainingsquote{' '}
                    <span className={cn('tabular-nums', activityRateColorClass(teamAverageActivityPct))}>
                      {teamAverageActivityPct} %
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/50">
                    Auf Basis von {qualified.length} gewerteten Spielern
                  </p>
                </GlassCard>
              ) : null}

              {!isOverview && (restQualified.length > 0 || qualified.length > 0) ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Trainingsranking
                  </p>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-left text-[13px]">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-white/45">
                          <th className="px-2 py-1 font-medium">Rang</th>
                          <th className="px-2 py-1 font-medium">Spieler</th>
                          <th className="px-2 py-1 font-medium">Aktivität</th>
                          <th className="px-2 py-1 font-medium">Trainingsquote</th>
                          <th className="px-2 py-1 font-medium">Basis</th>
                          <th className="px-2 py-1 font-medium">Dabei</th>
                          <th className="px-2 py-1 font-medium">LAZ</th>
                          <th className="px-2 py-1 font-medium">Abwesend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qualified.map((row) => {
                          const hasActivity = hasTrainingActivityBasis(row.stats);
                          const hasTeam = hasTrainingTeamBasis(row.stats);
                          const activityClass = hasActivity
                            ? activityRateColorClass(row.stats.activityRatePct)
                            : 'text-white/50';
                          const teamClass = hasTeam ? teamRateTrafficLightClass(row.stats.teamRatePct) : 'text-white/50';
                          const valuable = getValuableTrainingCount(row.stats);
                          return (
                            <tr key={row.player.id}>
                              <td className="rounded-l-lg bg-black/25 px-2 py-2 tabular-nums text-white/55">
                                {podiumMedal(row.rank) ? (
                                  <span aria-hidden>{podiumMedal(row.rank)}</span>
                                ) : (
                                  row.rank
                                )}
                              </td>
                              <td className="bg-black/25 px-2 py-2">
                                <button
                                  type="button"
                                  onClick={() => onPlayerClick?.(row.player)}
                                  disabled={!onPlayerClick}
                                  className={cn(
                                    'text-left font-semibold text-white',
                                    onPlayerClick ? 'hover:text-red-200' : '',
                                  )}
                                >
                                  <span className="mr-1.5 inline-flex align-middle" aria-hidden>
                                    {hasTeam ? <TeamRateTrafficLightDot pct={row.stats.teamRatePct} /> : null}
                                  </span>
                                  <span className="break-words">{row.player.display_name}</span>
                                  <PlayerSpecialStatusBadges
                                    isLaz={row.player.is_laz_player}
                                    isInjured={row.player.is_injured}
                                    size="xs"
                                    className="mt-1"
                                  />
                                </button>
                              </td>
                              <td className={cn('bg-black/25 px-2 py-2 font-semibold tabular-nums', activityClass)}>
                                {hasActivity ? `${row.stats.activityRatePct} %` : '—'}
                              </td>
                              <td className={cn('bg-black/25 px-2 py-2 font-semibold tabular-nums', teamClass)}>
                                {hasTeam ? `${row.stats.teamRatePct} %` : '—'}
                              </td>
                              <td className="bg-black/25 px-2 py-2 tabular-nums text-white/70">
                                {valuable}/{sessionsCount}
                              </td>
                              <td className="bg-black/25 px-2 py-2 tabular-nums text-white/80">{row.stats.present}</td>
                              <td className="bg-black/25 px-2 py-2 tabular-nums text-white/80">{row.stats.external}</td>
                              <td className="rounded-r-lg bg-black/25 px-2 py-2 tabular-nums text-white/80">
                                {row.stats.absent}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-2 sm:hidden">
                    {qualified.map((row) => (
                      <RankingCard
                        key={row.player.id}
                        row={row}
                        sessionsCount={sessionsCount}
                        onPlayerClick={onPlayerClick}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}

          {unqualified.length > 0 && !isOverview ? (
            <div className="space-y-2 border-t border-white/[0.06] pt-4">
              <p className="text-[12px] font-semibold text-amber-300/90">
                <span className="mr-1" aria-hidden>
                  ⚠️
                </span>
                Geringe Trainingsbasis
              </p>
              <p className="text-[11px] text-white/50">
                Mindestens {minimumBasis} wertbare Trainings erforderlich (30 % von {sessionsCount}).
              </p>
              <div className="space-y-2">
                {unqualified.map((row) => (
                  <RankingCard
                    key={row.player.id}
                    row={row}
                    sessionsCount={sessionsCount}
                    onPlayerClick={onPlayerClick}
                    showRank={false}
                    lowBasis
                  />
                ))}
              </div>
            </div>
          ) : null}

          {!isOverview ? (
            <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-2.5">
              <p className="text-[11px] leading-relaxed text-white/50">
                {sessionsCount} vergangene Trainingseinheiten · Mindestbasis fürs Ranking: {minimumBasis} wertbare
                Trainings (Dabei + LAZ + Abwesend). Krank und Verletzt zählen nicht in die Trainingsquoten.
              </p>
            </GlassCard>
          ) : null}
        </div>
      )}
    </>
  );

  if (embedded && isOverview) {
    return <div className="min-w-0">{body}</div>;
  }

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className={isOverview ? 'sm:p-4' : 'mb-4 sm:p-5'}>
      {body}
    </PremiumCard>
  );
};
