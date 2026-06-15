import React from 'react';
import type { SeasonMatchSummary } from '../../lib/seasonMatchStats';

type Props = {
  summary: SeasonMatchSummary;
  loading?: boolean;
};

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-center">
      <div className="text-[18px] font-bold tabular-nums leading-none text-white">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">{label}</div>
    </div>
  );
}

export const SeasonMatchSummaryCard: React.FC<Props> = ({ summary, loading = false }) => {
  const total = summary.wins + summary.draws + summary.losses;
  const wPct = total > 0 ? (summary.wins / total) * 100 : 0;
  const dPct = total > 0 ? (summary.draws / total) * 100 : 0;
  const lPct = total > 0 ? (summary.losses / total) * 100 : 0;

  const goalsLabel =
    summary.goalsFor > 0 || summary.goalsAgainst > 0
      ? `${summary.goalsFor}:${summary.goalsAgainst}`
      : '—';

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3 py-3.5">
        <div className="h-24 animate-pulse rounded-xl bg-white/[0.06]" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_rgba(220,38,38,0.1),0_10px_36px_rgba(0,0,0,0.4)]">
      <h3 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">
        Saisonbilanz
      </h3>

      {total === 0 ? (
        <p className="py-2 text-center text-[13px] text-white/60">Noch keine Spiele</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCell label="Spiele" value={String(summary.played)} />
            <StatCell label="Siege" value={String(summary.wins)} />
            <StatCell label="Remis" value={String(summary.draws)} />
            <StatCell label="Niederlagen" value={String(summary.losses)} />
            <StatCell label="Tore" value={goalsLabel} />
            <StatCell label="Gegentore" value={String(summary.goalsAgainst)} />
            <StatCell label="Punkte" value={String(summary.points)} />
            <StatCell label="Punkte/Spiel" value={summary.pointsPerGame} />
          </div>

          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
            {wPct > 0 ? <div className="bg-emerald-500/90" style={{ width: `${wPct}%` }} /> : null}
            {dPct > 0 ? <div className="bg-amber-400/90" style={{ width: `${dPct}%` }} /> : null}
            {lPct > 0 ? <div className="bg-red-500/90" style={{ width: `${lPct}%` }} /> : null}
          </div>
          <p className="mt-2 text-center text-[11px] font-medium text-white/50">
            <span className="text-emerald-400">Siege</span>
            <span className="mx-1.5 text-white/30">|</span>
            <span className="text-amber-300">Remis</span>
            <span className="mx-1.5 text-white/30">|</span>
            <span className="text-red-400">Niederlagen</span>
          </p>
        </>
      )}
    </div>
  );
};
