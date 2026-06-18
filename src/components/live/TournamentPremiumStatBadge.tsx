import React from 'react';

type Props = {
  label: string;
  value: string | number;
  accent?: 'gold' | 'red' | 'neutral';
};

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  gold:
    'border-amber-400/35 bg-gradient-to-br from-amber-950/55 to-[rgba(12,10,8,0.72)] text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.12)]',
  red: 'border-red-500/35 bg-gradient-to-br from-red-950/55 to-[rgba(12,8,10,0.72)] text-red-100 shadow-[0_0_18px_rgba(220,38,38,0.14)]',
  neutral:
    'border-white/12 bg-gradient-to-br from-[rgba(18,18,20,0.92)] to-[rgba(8,8,10,0.88)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
};

export function TournamentPremiumStatBadge({ label, value, accent = 'neutral' }: Props) {
  const display = typeof value === 'number' ? String(value) : value;
  return (
    <div
      className={`min-w-0 flex-1 rounded-2xl border px-2 py-2.5 text-center ${ACCENT[accent]}`}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</p>
      <p className="mt-1 line-clamp-2 text-[15px] font-bold leading-tight tabular-nums text-inherit sm:text-[16px]">
        {display}
      </p>
    </div>
  );
}
