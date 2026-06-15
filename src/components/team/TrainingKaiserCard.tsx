import React from 'react';
import type { PlayerItem } from '../../hooks/usePlayers';
import { useTeamTrainingRanking } from '../../hooks/useTeamTrainingRanking';
import {
  activityRateColorClass,
  getTrainingActivityBasis,
  getTrainingTeamBasis,
  hasTrainingActivityBasis,
  hasTrainingTeamBasis,
  podiumMedal,
  type TrainingRankingRow,
} from '../../lib/trainingRanking';
import { GlassCard, PremiumCard, PremiumEmptyState, SectionTitle } from '../../ui';
import { cn } from '../../ui/lib/cn';

type Props = {
  players: PlayerItem[];
  teamSeasonId: string;
  onPlayerClick?: (player: PlayerItem) => void;
};

function jerseyLabel(player: PlayerItem): string | null {
  const n = player.jersey_number;
  if (typeof n === 'number' && Number.isFinite(n) && n > 0) return `#${Math.trunc(n)}`;
  return null;
}

function formatTeamLine(row: TrainingRankingRow): string {
  const { stats } = row;
  if (!hasTrainingTeamBasis(stats)) return 'Teamtraining: Keine Trainingsbasis';
  const basis = getTrainingTeamBasis(stats);
  return `Teamtraining: ${stats.teamRatePct} % · ${stats.present} von ${basis}`;
}

function formatActivityDetailLine(row: TrainingRankingRow): string {
  const { stats } = row;
  if (!hasTrainingActivityBasis(stats)) return 'Aktivität gesamt: Keine Trainingsbasis';
  const basis = getTrainingActivityBasis(stats);
  const numerator = stats.present + stats.external;
  return `Aktivität gesamt: ${stats.activityRatePct} % · ${numerator} von ${basis}`;
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
        'flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-left transition',
        onPlayerClick ? 'cursor-pointer hover:border-red-500/25 hover:bg-white/[0.04] active:scale-[0.99]' : 'cursor-default',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 text-[22px] leading-none" aria-hidden>
          {medal}
        </span>
        <span className="min-w-0 truncate text-[15px] font-semibold text-white">{row.player.display_name}</span>
      </span>
      <span className={cn('shrink-0 text-[18px] font-bold tabular-nums', pctClass)}>
        {hasBasis ? `${row.stats.activityRatePct} %` : '—'}
      </span>
    </button>
  );
}

function RankingCard({
  row,
  onPlayerClick,
}: {
  row: TrainingRankingRow;
  onPlayerClick?: (player: PlayerItem) => void;
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
        'w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-left transition',
        onPlayerClick ? 'cursor-pointer hover:border-red-500/25 hover:bg-white/[0.04] active:scale-[0.99]' : 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-white">
            <span className="mr-2 tabular-nums text-white/45">{row.rank}.</span>
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
      <p className="mt-2 text-[12px] text-white/60">
        Dabei {row.stats.present} · LAZ {row.stats.external} · Abwesend {row.stats.absent}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/50">{formatTeamLine(row)}</p>
      <p className="text-[11px] leading-relaxed text-white/50">{formatActivityDetailLine(row)}</p>
    </button>
  );
}

export const TrainingKaiserCard: React.FC<Props> = ({ players, teamSeasonId, onPlayerClick }) => {
  const { ranking, sessionsCount, loading, error } = useTeamTrainingRanking(players, teamSeasonId, true);

  const topThree = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className="mb-4 sm:p-5">
      <SectionTitle as="h2" className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case">
        <span className="mr-1.5" aria-hidden>
          🏆
        </span>
        Trainingskaiser
      </SectionTitle>

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
      ) : ranking.length === 0 ? (
        <PremiumEmptyState variant="subtle" title="Keine aktiven Spieler im Kader." className="mt-3 py-6" />
      ) : (
        <div className="mt-4 space-y-4">
          {topThree.length > 0 ? (
            <div className="space-y-2">
              {topThree.map((row) => (
                <PodiumRow key={row.player.id} row={row} onPlayerClick={onPlayerClick} />
              ))}
            </div>
          ) : null}

          {rest.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Alle Spieler</p>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[520px] border-separate border-spacing-y-1.5 text-left text-[13px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-white/45">
                      <th className="px-2 py-1 font-medium">Rang</th>
                      <th className="px-2 py-1 font-medium">Spieler</th>
                      <th className="px-2 py-1 font-medium">Aktivität</th>
                      <th className="px-2 py-1 font-medium">Dabei</th>
                      <th className="px-2 py-1 font-medium">LAZ</th>
                      <th className="px-2 py-1 font-medium">Abwesend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((row) => {
                      const hasBasis = hasTrainingActivityBasis(row.stats);
                      const pctClass = hasBasis ? activityRateColorClass(row.stats.activityRatePct) : 'text-white/50';
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
                                'font-semibold text-white',
                                onPlayerClick ? 'hover:text-red-200' : '',
                              )}
                            >
                              {row.player.display_name}
                            </button>
                          </td>
                          <td className={cn('bg-black/25 px-2 py-2 font-semibold tabular-nums', pctClass)}>
                            {hasBasis ? `${row.stats.activityRatePct} %` : '—'}
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
                {rest.map((row) => (
                  <RankingCard key={row.player.id} row={row} onPlayerClick={onPlayerClick} />
                ))}
              </div>
            </div>
          ) : ranking.length > 0 && topThree.length === ranking.length ? (
            <div className="space-y-2 sm:hidden">
              {ranking.map((row) => (
                <RankingCard key={row.player.id} row={row} onPlayerClick={onPlayerClick} />
              ))}
            </div>
          ) : null}

          <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-white/50">
              Basis: {sessionsCount} vergangene Trainingseinheiten. Verletzt, offen und nicht erfasst zählen nicht in
              die Quoten.
            </p>
          </GlassCard>
        </div>
      )}
    </PremiumCard>
  );
};
