import React from 'react';

export type PremiumStatusBadgeTone =
  | 'present'
  | 'absent'
  | 'injured'
  | 'external'
  | 'open'
  | 'neutral'
  | 'selected'
  | 'warning';

const TONE_CLASS: Record<PremiumStatusBadgeTone, string> = {
  present: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200/95',
  absent: 'border-red-500/28 bg-red-500/10 text-red-200/90',
  injured: 'border-amber-500/32 bg-amber-500/12 text-amber-100/95',
  external: 'border-violet-500/32 bg-violet-500/12 text-violet-100/95',
  open: 'border-white/14 bg-white/[0.05] text-white/55',
  neutral: 'border-white/12 bg-white/[0.04] text-white/50',
  selected: 'border-red-400/28 bg-red-500/10 text-red-100/90',
  warning: 'border-amber-500/28 bg-amber-500/10 text-amber-100/90',
};

type Props = {
  label: string;
  tone?: PremiumStatusBadgeTone;
  className?: string;
};

export const PremiumStatusBadge: React.FC<Props> = ({ label, tone = 'neutral', className = '' }) => (
  <span
    className={[
      'inline-flex max-w-[7.5rem] shrink-0 items-center justify-center rounded-full border px-2 py-0.5',
      'text-[9px] font-bold uppercase tracking-[0.08em] leading-none',
      TONE_CLASS[tone],
      className,
    ].join(' ')}
  >
    {label}
  </span>
);
