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
    <div className="relative min-h-[4.75rem] overflow-hidden rounded-2xl border sz-club-surface sz-club-surface--quiet px-3 py-2.5 transition-[box-shadow,transform] active:scale-[0.99]">
      <div
        className="pointer-events-none absolute inset-0 sz-club-card-glow"
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
