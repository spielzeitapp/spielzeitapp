import React from "react";

/** Gleiche Kachel wie Spielerprofil (PremiumStatTile). */
export function ProfileStatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-b from-white/[0.07] to-black/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_40px_rgba(0,0,0,0.4)]">
      <Icon
        className="pointer-events-none absolute -right-0.5 -top-0.5 h-16 w-16 text-red-500/[0.12]"
        strokeWidth={1.25}
        aria-hidden
      />
      <div className="relative text-left">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-white/60">{label}</div>
        <div className="mt-1 text-[22px] font-bold tabular-nums leading-none tracking-tight text-white">
          {value}
        </div>
      </div>
    </div>
  );
}
