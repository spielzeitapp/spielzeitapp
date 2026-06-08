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

type Props = {
  balance: TournamentTeamBalance;
  summary: TournamentFinalSummary | null;
  loading?: boolean;
};

export const TournamentFinalSummaryCard: React.FC<Props> = ({
  balance,
  summary,
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
      </div>
    </Card>
  );
};
