import React from "react";

/** Premium-Stat-Kachel — Spieler- und Trainerprofil. */
export function ProfileStatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="relative min-h-[4.75rem] overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_rgba(220,38,38,0.12),0_10px_32px_rgba(0,0,0,0.45)] transition-[box-shadow,transform] active:scale-[0.99]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(220,38,38,0.14)_0%,transparent_55%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-1 -top-1" aria-hidden>
        {icon}
      </div>
      <div className="relative text-left">
        <div className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-white/55">{label}</div>
        <div className="mt-1 text-[22px] font-bold tabular-nums leading-none tracking-tight text-white">{value}</div>
        {sub ? <p className="mt-1 text-[10px] leading-snug text-white/38">{sub}</p> : null}
      </div>
    </div>
  );
}
