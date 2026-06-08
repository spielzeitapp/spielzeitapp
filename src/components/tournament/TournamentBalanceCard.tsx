import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardTitle } from '../../app/components/ui/Card';
import type { TournamentTeamBalance } from '../../lib/tournamentPlan';

type Props = {
  balance: TournamentTeamBalance;
  loading?: boolean;
};

function BalanceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-1.5 py-2.5 text-center sm:px-2">
      <p className="text-[9px] font-bold uppercase leading-tight tracking-[0.06em] text-white/45 sm:text-[10px]">
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-bold tabular-nums leading-none text-white">{value}</p>
    </div>
  );
}

export const TournamentBalanceCard: React.FC<Props> = ({ balance, loading = false }) => {
  if (!loading && balance.played === 0) return null;

  return (
    <Card className="relative border border-emerald-500/20 bg-emerald-950/10">
      <CardTitle className="!mb-0 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-emerald-300/90" strokeWidth={2} aria-hidden />
        Unsere Bilanz
      </CardTitle>

      {loading ? (
        <p className="mt-3 text-[14px] text-white/65">Lade Bilanz…</p>
      ) : (
        <div className="mt-3 grid min-w-0 grid-cols-4 gap-1.5 sm:gap-2">
          <BalanceStat label="Spiele" value={balance.played} />
          <BalanceStat label="Siege" value={balance.wins} />
          <BalanceStat label="Remis" value={balance.draws} />
          <BalanceStat label="Niederl." value={balance.losses} />
        </div>
      )}
    </Card>
  );
};
