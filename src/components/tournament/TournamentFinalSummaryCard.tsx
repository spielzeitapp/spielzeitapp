import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { dsStatusChipClass } from '../../lib/premiumDesignSystem';
import type { TournamentCompletionState } from '../../lib/tournamentCompletion';
import {
  canCompleteTournament,
  formatTournamentPlacementRankLine,
  shouldShowTournamentFinalSummaryCard,
  tournamentPlacementSourceHint,
  type TournamentFinalSummary,
} from '../../lib/tournamentFinalSummary';
import type { TournamentGoalScorer } from '../../lib/tournamentGoalScorers';
import { buildTournamentReportText } from '../../lib/tournamentReportText';
import type { TournamentTeamBalance } from '../../lib/tournamentPlan';
import { AppButton } from '../ui/AppButton';
import { TournamentManualGoalScorersModal } from './TournamentManualGoalScorersModal';
import { TournamentReportModal } from './TournamentReportModal';
import type { PlayerItem } from '../../hooks/usePlayers';

type Props = {
  tournamentEventId: string;
  tournamentTitle: string;
  balance: TournamentTeamBalance;
  summary: TournamentFinalSummary | null;
  completion: TournamentCompletionState;
  goalScorers?: TournamentGoalScorer[];
  goalScorersLoading?: boolean;
  hasMatchEventGoals?: boolean;
  canManage?: boolean;
  userId?: string | null;
  players?: PlayerItem[];
  playersLoading?: boolean;
  loading?: boolean;
  onManualScorersSaved?: () => void;
  onCompleteTournament?: () => void;
  completingTournament?: boolean;
};

export const TournamentFinalSummaryCard: React.FC<Props> = ({
  tournamentEventId,
  tournamentTitle,
  balance,
  summary,
  completion,
  goalScorers = [],
  goalScorersLoading = false,
  hasMatchEventGoals = false,
  canManage = false,
  userId = null,
  players = [],
  playersLoading = false,
  loading = false,
  onManualScorersSaved,
  onCompleteTournament,
  completingTournament = false,
}) => {
  const [reportOpen, setReportOpen] = useState(false);
  const [manualScorersOpen, setManualScorersOpen] = useState(false);

  const reportText = useMemo(() => {
    if (!summary) return '';
    return buildTournamentReportText({
      tournamentTitle,
      summary,
      balance,
      finalMatch: summary.finalMatch,
      goalScorers,
    });
  }, [tournamentTitle, summary, balance, goalScorers]);

  if (loading) return null;
  if (!shouldShowTournamentFinalSummaryCard(balance, summary) || !summary) return null;

  const placementLine = formatTournamentPlacementRankLine(summary);
  const sourceHint = tournamentPlacementSourceHint(summary.placementSource);
  const isArchived = Boolean(completion.completedAt);
  const showCompleteButton =
    canManage && !isArchived && canCompleteTournament(balance);
  const showManualScorersButton = canManage && !hasMatchEventGoals;

  if (!placementLine) return null;

  return (
    <>
      <Card className="relative border border-amber-500/25 bg-amber-950/15">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="!mb-0 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-300/90" strokeWidth={2} aria-hidden />
            Turnierabschluss
          </CardTitle>
          {isArchived ? (
            <span className={dsStatusChipClass('present')}>Abgeschlossen</span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-col gap-3 text-[14px] text-white/85">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-white/50">Platzierung</p>
            <p className="mt-1 text-[20px] font-bold leading-snug text-white">{placementLine}</p>
          </div>

          {summary.finalMatch ? (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-white/50">
                {summary.finalMatch.title}
              </p>
              <p className="mt-1 text-[16px] font-semibold tabular-nums text-white">
                {summary.finalMatch.scoreline}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-[16px] font-semibold text-white">
              {balance.played} {balance.played === 1 ? 'Spiel' : 'Spiele'}
            </p>
            <p className="text-white/75">
              {balance.wins} {balance.wins === 1 ? 'Sieg' : 'Siege'} · {balance.draws} Remis ·{' '}
              {balance.losses} {balance.losses === 1 ? 'Niederlage' : 'Niederlagen'}
            </p>
            <p className="font-medium tabular-nums text-white">
              Tore {balance.goalsFor}:{balance.goalsAgainst}
            </p>
            <p className="font-semibold tabular-nums text-amber-200/95">Punkte {balance.points}</p>
          </div>

          {sourceHint ? <p className="text-[12px] text-white/50">{sourceHint}</p> : null}

          {isArchived ? (
            <p className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-[12px] leading-snug text-white/60">
              Turnier ist abgeschlossen. Aktualisieren kann neue Daten ergänzen, überschreibt aber keine
              Live-Daten.
            </p>
          ) : null}

          <div className="border-t border-white/10 pt-3">
            <p className="text-[14px] font-semibold text-white/90">Torschützen</p>
            {goalScorersLoading ? (
              <p className="mt-2 text-[13px] text-white/55">Torschützen werden geladen…</p>
            ) : goalScorers.length === 0 ? (
              <p className="mt-2 text-[13px] text-white/55">Torschützen noch nicht erfasst.</p>
            ) : (
              <ol className="mt-2 flex list-none flex-col gap-1 p-0">
                {goalScorers.map((scorer, index) => (
                  <li key={scorer.playerId} className="text-[14px] text-white/80">
                    {index + 1}. {scorer.playerName} – {scorer.goals}{' '}
                    {scorer.goals === 1 ? 'Tor' : 'Tore'}
                  </li>
                ))}
              </ol>
            )}
            {showManualScorersButton ? (
              <AppButton
                variant="secondary"
                onClick={() => setManualScorersOpen(true)}
                className="mt-3 w-full sm:w-auto"
              >
                Torschützen ergänzen
              </AppButton>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:flex-wrap">
            <AppButton variant="secondary" onClick={() => setReportOpen(true)} className="w-full sm:w-auto">
              Turnierbericht erstellen
            </AppButton>
            {showCompleteButton ? (
              <AppButton
                variant="primary"
                onClick={onCompleteTournament}
                disabled={completingTournament}
                className="w-full sm:w-auto"
              >
                {completingTournament ? 'Wird abgeschlossen…' : 'Turnier abschließen'}
              </AppButton>
            ) : null}
          </div>
        </div>
      </Card>

      <TournamentReportModal
        isOpen={reportOpen}
        reportText={reportText}
        onClose={() => setReportOpen(false)}
      />

      <TournamentManualGoalScorersModal
        isOpen={manualScorersOpen}
        eventId={tournamentEventId}
        userId={userId}
        players={players}
        playersLoading={playersLoading}
        onClose={() => setManualScorersOpen(false)}
        onSaved={() => onManualScorersSaved?.()}
      />
    </>
  );
};
