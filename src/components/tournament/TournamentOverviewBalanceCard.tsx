import React from 'react';
import { BarChart3 } from 'lucide-react';
import {
  formatTournamentGoalDifference,
  type TournamentTeamBalance,
} from '../../lib/tournamentPlan';
import { dsStatusChipClass } from '../../lib/premiumDesignSystem';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';

type Props = {
  balance: TournamentTeamBalance;
  loading?: boolean;
};

export function TournamentOverviewBalanceCard({ balance, loading = false }: Props) {
  const hasResults = balance.played > 0;

  return (
    <section className={TC_CARD}>
      <div className={TC_CARD_INNER}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className={`${TC_SECTION_LABEL} flex items-center gap-1.5`}>
            <BarChart3 className="h-3.5 w-3.5 text-red-400/85" strokeWidth={2} aria-hidden />
            Turnierbilanz
          </p>
          {!loading ? (
            <span className={dsStatusChipClass(balance.isCompleted ? 'present' : 'open')}>
              {balance.isCompleted ? 'Abgeschlossen' : 'Läuft'}
            </span>
          ) : null}
        </div>

        {loading ? (
          <p className="mt-2 text-[14px] text-white/55">Lade Bilanz…</p>
        ) : !hasResults ? (
          <p className="mt-2 text-[14px] text-white/55">Noch keine Ergebnisse vorhanden.</p>
        ) : (
          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px] text-white/82 sm:grid-cols-4">
            <Stat label="Spiele" value={String(balance.played)} />
            <Stat label="Siege" value={String(balance.wins)} />
            <Stat label="Tore" value={`${balance.goalsFor}:${balance.goalsAgainst}`} />
            <Stat
              label="Punkte"
              value={String(balance.points)}
              emphasis
            />
            <p className="col-span-2 text-[12px] text-white/55 sm:col-span-4">
              {balance.draws} Remis · {balance.losses}{' '}
              {balance.losses === 1 ? 'Niederlage' : 'Niederlagen'} · Diff{' '}
              {formatTournamentGoalDifference(balance.goalDifference)}
            </p>
          </div>
        )}
      </div>
    </section>
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
        className={`mt-0.5 text-[17px] font-bold tabular-nums leading-none ${
          emphasis ? 'text-red-200/95' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
