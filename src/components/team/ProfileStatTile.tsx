import React from "react";

/** Gleiche Kachel wie Spielerprofil — einheitliche Icon-Sprache via ReactNode. */
export function ProfileStatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="relative min-h-[4.75rem] overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-b from-white/[0.07] to-black/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_24px_rgba(255,40,40,0.08),0_10px_40px_rgba(0,0,0,0.4)] transition-[box-shadow,transform] active:scale-[0.99]">
      <div className="pointer-events-none absolute -right-0.5 -top-0.5" aria-hidden>
        {icon}
      </div>
      <div className="relative text-left">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-white/60">{label}</div>
        <div className="mt-1 text-[22px] font-bold tabular-nums leading-none tracking-tight text-white">{value}</div>
      </div>
    </div>
  );
}
