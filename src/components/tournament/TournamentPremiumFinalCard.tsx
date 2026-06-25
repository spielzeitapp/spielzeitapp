import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import {
  formatTournamentKickoffTime,
  formatTournamentGoalDifference,
  tournamentMatchDisplayStatus,
  type TournamentMatchSlotView,
  type TournamentTeamBalance,
} from '../../lib/tournamentPlan';
import { dsScheduleGlassButtonClass, dsStatusChipClass } from '../../lib/premiumDesignSystem';
import type { TournamentCompletionState } from '../../lib/tournamentCompletion';
import { formatCompletionPlacementLine } from '../../lib/tournamentCompletionDisplay';
import type { TournamentGoalScorer } from '../../lib/tournamentGoalScorers';
import { buildTournamentCompletionReportText } from '../../lib/tournamentCompletionFeed';
import type { TournamentFinalSummary } from '../../lib/tournamentFinalSummary';
import { TournamentReportModal } from './TournamentReportModal';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';

type Props = {
  tournamentTitle: string;
  balance: TournamentTeamBalance;
  completion: TournamentCompletionState;
  summary: TournamentFinalSummary | null;
  goalScorers?: TournamentGoalScorer[];
  goalScorersLoading?: boolean;
  slots: TournamentMatchSlotView[];
  loading?: boolean;
  canManage?: boolean;
  onCompleteTournament?: () => void;
  onCreateReport?: () => void;
  completingTournament?: boolean;
};

function finishedResults(slots: TournamentMatchSlotView[]) {
  return slots
    .filter((slot) => (slot.match_status ?? '').toLowerCase() === 'finished')
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
}

export function TournamentPremiumFinalCard({
  tournamentTitle,
  balance,
  completion,
  summary,
  goalScorers = [],
  goalScorersLoading = false,
  slots,
  loading = false,
  canManage = false,
  onCompleteTournament,
  onCreateReport,
  completingTournament = false,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const isArchived = Boolean(completion.completedAt);
  const placementLine = isArchived
    ? formatCompletionPlacementLine(completion)
    : summary?.finalPlacementLabel
      ? formatCompletionPlacementLine({
          completedAt: null,
          completedBy: null,
          finalPlacement: summary.finalPlacementRank,
          finalTeamsCount: summary.finalPlacementTotal,
          finalLabel: summary.finalPlacementLabel,
        })
      : 'Turnier beendet';

  const results = useMemo(() => finishedResults(slots), [slots]);
  const topScorer = goalScorers[0] ?? null;

  const reportText = useMemo(
    () =>
      buildTournamentCompletionReportText({
        tournamentTitle,
        summary,
        balance,
        placementLine,
        goalScorers,
      }),
    [tournamentTitle, summary, balance, placementLine, goalScorers],
  );

  if (loading) return null;
  if (balance.played === 0 && !isArchived) return null;

  const teamsCountLabel =
    completion.finalTeamsCount ??
    summary?.finalPlacementTotal ??
    null;

  return (
    <>
      <section
        className={`${TC_CARD} overflow-hidden border-[rgba(251,191,36,0.28)] shadow-[0_0_32px_rgba(251,191,36,0.08)]`}
      >
        <div className="border-b border-amber-500/15 bg-[linear-gradient(135deg,rgba(88,62,12,0.35)_0%,rgba(12,10,8,0.92)_55%)] px-3 py-3 sm:px-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className={`${TC_SECTION_LABEL} inline-flex items-center gap-1.5 !text-amber-200/90`}>
              <Trophy className="h-3.5 w-3.5 text-amber-300" strokeWidth={2.25} aria-hidden />
              {isArchived ? 'Turnier abgeschlossen' : 'Turnier-Abschluss'}
            </p>
            {isArchived ? (
              <span className={dsStatusChipClass('present')}>Archiviert</span>
            ) : canManage ? (
              <span className={dsStatusChipClass('open')}>Bereit zum Abschluss</span>
            ) : null}
          </div>
          <p className="mt-2 text-[22px] font-bold leading-snug text-white sm:text-[24px]">{placementLine}</p>
          {teamsCountLabel != null && teamsCountLabel > 0 ? (
            <p className="mt-1 text-[12px] text-white/55">{teamsCountLabel} Teams im Turnier</p>
          ) : null}
        </div>

        <div className={`${TC_CARD_INNER} flex flex-col gap-3`}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
            <Stat label="Spiele" value={String(balance.played)} />
            <Stat label="Siege" value={String(balance.wins)} />
            <Stat
              label="Tore"
              value={`${balance.goalsFor}:${balance.goalsAgainst}`}
            />
            <Stat label="Punkte" value={String(balance.points)} emphasis />
          </div>
          <p className="text-[12px] text-white/55">
            {balance.draws} Remis · {balance.losses}{' '}
            {balance.losses === 1 ? 'Niederlage' : 'Niederlagen'} · Diff{' '}
            {formatTournamentGoalDifference(balance.goalDifference)}
          </p>

          {goalScorersLoading ? (
            <p className="text-[13px] text-white/55">Torschützen werden geladen…</p>
          ) : topScorer ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Top-Torschütze</p>
              <p className="mt-1 text-[15px] font-semibold text-white">
                {topScorer.playerName}{' '}
                <span className="text-white/60">
                  · {topScorer.goals} {topScorer.goals === 1 ? 'Tor' : 'Tore'}
                </span>
              </p>
            </div>
          ) : null}

          {results.length > 0 ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Alle Ergebnisse</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {results.map((slot) => {
                  const status = tournamentMatchDisplayStatus(slot);
                  if (status.kind !== 'result') return null;
                  return (
                    <li
                      key={slot.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5 text-[12px]"
                    >
                      <span className="min-w-0 truncate text-white/82">{slot.opponent_name}</span>
                      <span className="shrink-0 tabular-nums text-white/55">
                        {formatTournamentKickoffTime(slot.kickoff_at)} · {status.ourGoals}:{status.oppGoals}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {canManage && !isArchived ? (
            <div className="flex flex-col gap-1.5 border-t border-white/[0.06] pt-2.5">
              <button
                type="button"
                className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-4 text-[13px] font-semibold touch-manipulation ${dsScheduleGlassButtonClass()}`}
                onClick={() => (onCreateReport ? onCreateReport() : setReportOpen(true))}
              >
                Turnierbericht erstellen
              </button>
              {onCompleteTournament ? (
                <button
                  type="button"
                  disabled={completingTournament}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-amber-500/35 bg-amber-950/35 px-4 text-[13px] font-semibold text-amber-100 touch-manipulation disabled:opacity-60"
                  onClick={onCompleteTournament}
                >
                  {completingTournament ? 'Wird abgeschlossen…' : 'Turnier abschließen'}
                </button>
              ) : null}
            </div>
          ) : isArchived ? (
            <div className="border-t border-white/[0.06] pt-2.5">
              <button
                type="button"
                className={`inline-flex min-h-[40px] w-full items-center justify-center rounded-full px-4 text-[12px] font-semibold touch-manipulation ${dsScheduleGlassButtonClass()}`}
                onClick={() => setReportOpen(true)}
              >
                Turnierbericht anzeigen
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <TournamentReportModal
        isOpen={reportOpen}
        reportText={reportText}
        onClose={() => setReportOpen(false)}
      />
    </>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
      <p
        className={`mt-0.5 text-[18px] font-bold tabular-nums leading-none ${
          emphasis ? 'text-amber-200/95' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
