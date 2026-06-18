import React from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import {
  activityRateColorClass,
  getValuableTrainingCount,
  hasTrainingActivityBasis,
  hasTrainingTeamBasis,
  podiumMedal,
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
  return `Teamtraining: ${stats.teamRatePct} % · ${stats.present} von ${basis}`;
}

function formatActivityDetailLine(row: TrainingRankingRow): string {
  const { stats } = row;
  if (!hasTrainingActivityBasis(stats)) return 'Aktivität gesamt: Keine Trainingsbasis';
  const basis = getValuableTrainingCount(stats);
  const numerator = stats.present + stats.external;
  return `Aktivität gesamt: ${stats.activityRatePct} % · ${numerator} von ${basis}`;
}

function InjuredLine({ count }: { count: number }) {
  if (count <= 0) return null;
  return <p className="text-[11px] text-white/45">Verletzt: {count}</p>;
}

function SickLine({ count }: { count: number }) {
  if (count <= 0) return null;
  return <p className="text-[11px] text-white/45">Krank: {count}</p>;
}

function PodiumRow({
  row,
  onPlayerClick,
}: {
  row: TrainingRankingRow;
  onPlayerClick?: (player: PlayerItem) => void;
}) {
  const medal = podiumMedal(row.rank);
  const hasBasis = hasTrainingActivityBasis(row.stats);
  const pctClass = hasBasis ? activityRateColorClass(row.stats.activityRatePct) : 'text-white/50';

  return (
    <button
      type="button"
      onClick={() => onPlayerClick?.(row.player)}
      disabled={!onPlayerClick}
      className={cn(
        'flex w-full items-start justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-left transition',
        onPlayerClick ? 'cursor-pointer hover:border-red-500/25 hover:bg-white/[0.04] active:scale-[0.99]' : 'cursor-default',
      )}
    >
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <span className="shrink-0 text-[22px] leading-none" aria-hidden>
          {medal}
        </span>
        <span className="min-w-0 break-words text-[15px] font-semibold leading-snug text-white">
          {row.player.display_name}
        </span>
      </span>
      <span className={cn('shrink-0 pt-0.5 text-[18px] font-bold tabular-nums', pctClass)}>
        {hasBasis ? `${row.stats.activityRatePct} %` : '—'}
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
  const pctClass = hasActivityBasis ? activityRateColorClass(row.stats.activityRatePct) : 'text-white/50';

  return (
    <button
      type="button"
      onClick={() => onPlayerClick?.(row.player)}
      disabled={!onPlayerClick}
      className={cn(
        'w-full rounded-xl border px-3 py-3 text-left transition',
        lowBasis ? 'border-amber-500/20 bg-amber-950/15' : 'border-white/10 bg-black/25',
        onPlayerClick ? 'cursor-pointer hover:border-red-500/25 hover:bg-white/[0.04] active:scale-[0.99]' : 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-[14px] font-semibold leading-snug text-white">
            {showRank ? <span className="mr-2 tabular-nums text-white/45">{row.rank}.</span> : null}
            {row.player.display_name}
          </p>
          <p className="mt-0.5 text-[12px] text-white/55">
            {jersey ? `${jersey} · ` : ''}
            <span className={cn('font-semibold', pctClass)}>
              {hasActivityBasis ? `Aktivität ${row.stats.activityRatePct} %` : 'Keine Trainingsbasis'}
            </span>
          </p>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-white/60">{formatTrainingBasisLine(row, sessionsCount)}</p>
      {lowBasis ? (
        <p className="mt-1 text-[11px] font-medium text-amber-300/85">zu geringe Trainingsbasis</p>
      ) : (
        <>
          <p className="mt-2 text-[12px] text-white/60">
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
  const restQualified = qualified.slice(3);
  const hasPlayers = qualified.length > 0 || unqualified.length > 0;
  const isOverview = variant === 'overview';

  const body = (
    <>
      {!isOverview ? (
        <SectionTitle
          as="h2"
          subtitle="Mannschaftsbeteiligung = Dabei/(Dabei+Abwesend) je Training. Krank, Verletzt und LAZ sind neutral. Trainingskaiser nutzt individuelle Spielerquoten."
          subtitleClassName="mt-1.5 text-[12px] leading-relaxed text-white/55"
          className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case"
        >
          <span className="mr-1.5" aria-hidden>
            🏆
          </span>
          Trainingskaiser
        </SectionTitle>
      ) : (
        <SectionTitle as="h3" className="[&>h3]:text-base [&>h3]:font-semibold [&>h3]:normal-case">
          Top 3 Trainingskaiser
        </SectionTitle>
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
                  {topThree.map((row) => (
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
                    Ø Spielerquote{' '}
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
                    Offizielles Ranking
                  </p>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-left text-[13px]">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-white/45">
                          <th className="px-2 py-1 font-medium">Rang</th>
                          <th className="px-2 py-1 font-medium">Spieler</th>
                          <th className="px-2 py-1 font-medium">Aktivität</th>
                          <th className="px-2 py-1 font-medium">Basis</th>
                          <th className="px-2 py-1 font-medium">Dabei</th>
                          <th className="px-2 py-1 font-medium">LAZ</th>
                          <th className="px-2 py-1 font-medium">Abwesend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qualified.map((row) => {
                          const hasBasis = hasTrainingActivityBasis(row.stats);
                          const pctClass = hasBasis
                            ? activityRateColorClass(row.stats.activityRatePct)
                            : 'text-white/50';
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
                                    'break-words text-left font-semibold text-white',
                                    onPlayerClick ? 'hover:text-red-200' : '',
                                  )}
                                >
                                  {row.player.display_name}
                                </button>
                              </td>
                              <td className={cn('bg-black/25 px-2 py-2 font-semibold tabular-nums', pctClass)}>
                                {hasBasis ? `${row.stats.activityRatePct} %` : '—'}
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
                Trainings (Dabei + LAZ + Abwesend). Verletzt, offen und nicht erfasst zählen nicht in die Quoten.
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
