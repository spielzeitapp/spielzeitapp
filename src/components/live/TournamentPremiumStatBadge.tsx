import React from 'react';

type Props = {
  label: string;
  value: string | number;
  accent?: 'gold' | 'red' | 'neutral';
};

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  gold:
    'border-white/[0.06] bg-gradient-to-br from-amber-950/40 to-[rgba(8,6,6,0.88)] text-amber-100/90 shadow-[0_0_12px_rgba(0,0,0,0.45)]',
  red: 'border-white/[0.06] bg-[rgba(8,4,6,0.88)] text-white/88 shadow-[0_0_12px_rgba(0,0,0,0.45)]',
  neutral: 'border-white/[0.06] bg-[rgba(6,4,8,0.92)] text-white/82 shadow-[0_0_12px_rgba(0,0,0,0.45)]',
};

export function TournamentPremiumStatBadge({ label, value, accent = 'neutral' }: Props) {
  const display = typeof value === 'number' ? String(value) : value;
  return (
    <div
      className={`min-w-0 flex-1 rounded-2xl border px-2 py-2.5 text-center ${ACCENT[accent]}`}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/42">{label}</p>
      <p className="mt-1 line-clamp-2 text-[15px] font-bold leading-tight tabular-nums text-inherit sm:text-[16px]">
        {display}
      </p>
    </div>
  );
}
