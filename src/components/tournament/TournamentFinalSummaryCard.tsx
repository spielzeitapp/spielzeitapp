import React from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardTitle } from '../../app/components/ui/Card';
import type { TournamentTeamBalance } from '../../lib/tournamentPlan';
import {
  formatTournamentFinalPlacementHeadline,
  shouldShowTournamentFinalSummaryCard,
  tournamentPlacementSourceHint,
  type TournamentFinalSummary,
} from '../../lib/tournamentFinalSummary';
import type { TournamentGoalScorer } from '../../lib/tournamentGoalScorers';

type Props = {
  balance: TournamentTeamBalance;
  summary: TournamentFinalSummary | null;
  goalScorers?: TournamentGoalScorer[];
  goalScorersLoading?: boolean;
  loading?: boolean;
};

export const TournamentFinalSummaryCard: React.FC<Props> = ({
  balance,
  summary,
  goalScorers = [],
  goalScorersLoading = false,
  loading = false,
}) => {
  if (loading) return null;
  if (!shouldShowTournamentFinalSummaryCard(balance, summary) || !summary) return null;

  const headline = formatTournamentFinalPlacementHeadline(summary);
  const sourceHint = tournamentPlacementSourceHint(summary.placementSource);

  if (!headline) return null;

  return (
    <Card className="relative border border-amber-500/25 bg-amber-950/15">
      <CardTitle className="!mb-0 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-300/90" strokeWidth={2} aria-hidden />
        Turnierabschluss
      </CardTitle>

      <div className="mt-3 flex flex-col gap-2 text-[14px] text-white/85">
        <p className="text-[20px] font-bold leading-snug text-white">{headline}</p>
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
        {sourceHint ? <p className="mt-1 text-[12px] text-white/50">{sourceHint}</p> : null}

        <div className="mt-4 border-t border-white/10 pt-3">
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
        </div>
      </div>
    </Card>
  );
};
