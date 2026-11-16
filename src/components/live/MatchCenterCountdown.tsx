import React from 'react';
import type { MatchCenterCountdown as CountdownParts } from '../../lib/matchCenterUtils';
import { MC_SURFACE } from './matchCenterStyles';

type Variant = 'compact' | 'hero' | 'heroCompact';

function CountdownUnit({
  value,
  label,
  variant,
}: {
  value: number;
  label: React.ReactNode;
  variant: Variant;
}) {
  if (variant === 'heroCompact') {
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center border-r border-white/20 px-1 py-2 last:border-r-0">
        <span className="text-[42px] font-extrabold tabular-nums leading-none tracking-tight text-white sm:text-[48px]">
          {value}
        </span>
        <span className="mt-2 text-[14px] font-semibold leading-snug text-white/90 sm:text-[15px]">
          {label}
        </span>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div
        className={`flex min-w-0 flex-1 flex-col items-center rounded-2xl border border-white/[0.06] bg-[rgba(6,4,8,0.82)] px-2 py-3 backdrop-blur-[3px] shadow-[0_0_16px_rgba(0,0,0,0.45)]`}
      >
        <span className="text-[36px] font-extrabold tabular-nums leading-none tracking-tight text-white sm:text-[42px]">
          {value}
        </span>
        <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[rgba(255,120,120,0.75)]">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center rounded-xl ${MC_SURFACE} px-1.5 py-2`}>
      <span className="text-[22px] font-bold tabular-nums leading-none text-white sm:text-[24px]">
        {value}
      </span>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </span>
    </div>
  );
}

export function MatchCenterCountdown({
  parts,
  variant = 'compact',
  showHeader = false,
  headerLabel = 'Countdown bis Beginn',
}: {
  parts: CountdownParts;
  variant?: Variant;
  showHeader?: boolean;
  headerLabel?: string;
}) {
  const labels =
    variant === 'heroCompact'
      ? { days: 'Tage', hours: 'Stunden', minutes: 'Minuten' }
      : variant === 'hero'
        ? { days: 'Tage', hours: 'Stunden', minutes: 'Minuten' }
        : { days: 'Tage', hours: 'Std.', minutes: 'Min.' };

  const gridClass =
    variant === 'heroCompact'
      ? 'grid grid-cols-3 gap-1'
      : variant === 'hero'
        ? 'grid grid-cols-3 gap-2 sm:gap-2.5'
        : 'grid grid-cols-3 gap-1.5 sm:gap-2';

  return (
    <div aria-label="Countdown" className={variant === 'heroCompact' ? 'my-3 rounded-2xl border border-red-400/30 bg-gradient-to-b from-red-950/40 to-black/70 px-3 py-4' : undefined}>
      {showHeader && variant === 'heroCompact' ? (
        <p className="mb-4 text-center text-[17px] font-bold leading-snug text-white sm:text-[18px]">
          {headerLabel}
        </p>
      ) : null}
      <div className={gridClass}>
        <CountdownUnit value={parts.days} label={labels.days} variant={variant} />
        <CountdownUnit value={parts.hours} label={labels.hours} variant={variant} />
        <CountdownUnit value={parts.minutes} label={labels.minutes} variant={variant} />
      </div>
    </div>
  );
}
