import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { dsStatusChipClass } from '../../lib/premiumDesignSystem';
import { formatTournamentGoalDifference, type TournamentTeamBalance } from '../../lib/tournamentPlan';

type Props = {
  balance: TournamentTeamBalance;
  loading?: boolean;
};

export const TournamentBalanceCard: React.FC<Props> = ({ balance, loading = false }) => {
  const hasResults = balance.played > 0;

  return (
    <Card className="relative border border-emerald-500/20 bg-emerald-950/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CardTitle className="!mb-0 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-300/90" strokeWidth={2} aria-hidden />
          Unsere Turnierbilanz
        </CardTitle>
        {!loading ? (
          <span className={dsStatusChipClass(balance.isCompleted ? 'present' : 'open')}>
            {balance.isCompleted ? 'Abgeschlossen' : 'Läuft'}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 text-[14px] text-white/65">Lade Bilanz…</p>
      ) : !hasResults ? (
        <p className="mt-3 text-[14px] text-white/65">Noch keine Ergebnisse vorhanden.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 text-[14px] text-white/85">
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
          <p className="tabular-nums text-white/80">
            Tordifferenz {formatTournamentGoalDifference(balance.goalDifference)}
          </p>
          <p className="font-semibold tabular-nums text-emerald-200/95">Punkte {balance.points}</p>
        </div>
      )}
    </Card>
  );
};
