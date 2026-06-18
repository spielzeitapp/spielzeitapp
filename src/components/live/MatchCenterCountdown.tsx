import React from 'react';
import type { MatchCenterCountdown as CountdownParts } from '../../lib/matchCenterUtils';

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
      <div className="flex min-w-0 flex-1 flex-col items-center rounded-2xl border border-red-500/35 bg-gradient-to-b from-[rgba(12,8,10,0.88)] to-[rgba(4,4,6,0.92)] px-2 py-3 shadow-[0_0_32px_rgba(220,38,38,0.16),inset_0_1px_0_rgba(255,255,255,0.07)]">
        <span className="text-[36px] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.12)] sm:text-[42px]">
          {value}
        </span>
        <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-300/75">
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center rounded-xl border border-[rgba(220,38,38,0.22)] bg-black/35 px-1.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
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
