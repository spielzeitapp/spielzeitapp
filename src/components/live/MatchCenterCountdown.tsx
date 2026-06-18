import React from 'react';
import type { MatchCenterCountdown as CountdownParts } from '../../lib/matchCenterUtils';
import { MC_BORDER, MC_GLOW_SM } from './matchCenterStyles';

type Variant = 'compact' | 'hero';

function CountdownUnit({
  value,
  label,
  variant,
}: {
  value: number;
  label: string;
  variant: Variant;
}) {
  if (variant === 'hero') {
    return (
      <div
        className={`flex min-w-0 flex-1 flex-col items-center rounded-2xl border ${MC_BORDER} bg-[rgba(6,4,8,0.82)] px-2 py-3 backdrop-blur-[3px] ${MC_GLOW_SM} shadow-[inset_0_1px_0_rgba(255,71,71,0.1)]`}
      >
        <span className="text-[36px] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,71,71,0.22)] sm:text-[42px]">
          {value}
        </span>
        <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[rgba(255,120,120,0.82)]">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center rounded-xl border ${MC_BORDER} bg-[rgba(8,6,10,0.72)] px-1.5 py-2 ${MC_GLOW_SM}`}
    >
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
}: {
  parts: CountdownParts;
  variant?: Variant;
}) {
  const labels =
    variant === 'hero'
      ? { days: 'Tage', hours: 'Stunden', minutes: 'Minuten' }
      : { days: 'Tage', hours: 'Std.', minutes: 'Min.' };

  return (
    <div
      className={variant === 'hero' ? 'grid grid-cols-3 gap-2 sm:gap-2.5' : 'grid grid-cols-3 gap-1.5 sm:gap-2'}
      aria-label="Countdown"
    >
      <CountdownUnit value={parts.days} label={labels.days} variant={variant} />
      <CountdownUnit value={parts.hours} label={labels.hours} variant={variant} />
      <CountdownUnit value={parts.minutes} label={labels.minutes} variant={variant} />
    </div>
  );
}
