import React from "react";

type Props = {
  wins: number;
  draws: number;
  losses: number;
};

export const TrainerBalanceCard: React.FC<Props> = ({ wins, draws, losses }) => {
  const total = wins + draws + losses;
  const wPct = total > 0 ? (wins / total) * 100 : 0;
  const dPct = total > 0 ? (draws / total) * 100 : 0;
  const lPct = total > 0 ? (losses / total) * 100 : 0;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_rgba(220,38,38,0.1),0_10px_36px_rgba(0,0,0,0.4)]">
      <h3 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.18em] text-red-300/85">Trainerbilanz</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[22px] font-bold tabular-nums leading-none text-emerald-400">{wins}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/55">Siege</div>
        </div>
        <div>
          <div className="text-[22px] font-bold tabular-nums leading-none text-amber-300">{draws}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/55">Unentschieden</div>
        </div>
        <div>
          <div className="text-[22px] font-bold tabular-nums leading-none text-red-400">{losses}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/55">Niederlagen</div>
        </div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
        {wPct > 0 ? <div className="bg-emerald-500/90" style={{ width: `${wPct}%` }} /> : null}
        {dPct > 0 ? <div className="bg-amber-400/90" style={{ width: `${dPct}%` }} /> : null}
        {lPct > 0 ? <div className="bg-red-500/90" style={{ width: `${lPct}%` }} /> : null}
      </div>
      <p className="mt-2 text-center text-[12px] font-medium text-white/55">
        {total > 0 ? `${total} Spiele insgesamt` : "Noch keine abgeschlossenen Spiele"}
      </p>
    </div>
  );
};
