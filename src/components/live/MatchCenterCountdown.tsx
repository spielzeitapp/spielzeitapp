import React from 'react';
import type { MatchCenterCountdown as CountdownParts } from '../../lib/matchCenterUtils';

function CountdownUnit({ value, label }: { value: number; label: string }) {
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

export function MatchCenterCountdown({ parts }: { parts: CountdownParts }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2" aria-label="Countdown">
      <CountdownUnit value={parts.days} label="Tage" />
      <CountdownUnit value={parts.hours} label="Std." />
      <CountdownUnit value={parts.minutes} label="Min." />
    </div>
  );
}
