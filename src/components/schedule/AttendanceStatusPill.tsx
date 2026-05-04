import React from 'react';

export type AttendanceStatusKind = 'yes' | 'no' | 'open';

type Props = {
  status: AttendanceStatusKind;
  /** Training: „Dabei“ / „Abwesend“ statt Zusage/Absage */
  isTraining?: boolean;
  /** Schmale Terminlisten-Karte (kurze Labels). */
  compact?: boolean;
  className?: string;
};

export function AttendanceStatusPill({
  status,
  isTraining = false,
  compact = false,
  className = '',
}: Props) {
  const base = compact
    ? 'inline-flex max-w-[58px] justify-center rounded-full px-1 py-0.5 text-[8px] font-bold uppercase leading-tight tracking-wide'
    : 'inline-flex max-w-[10rem] rounded-full px-2 py-1 text-[10px] font-bold uppercase leading-snug tracking-wide';

  if (isTraining) {
    if (status === 'no') {
      return (
        <span
          className={`${base} border border-red-500/45 bg-red-950/55 text-red-100 ${className}`}
        >
          {compact ? 'WEG' : 'Abwesend'}
        </span>
      );
    }
    if (status === 'open') {
      return (
        <span
          className={`${base} border border-white/20 bg-white/10 text-white/70 ${className}`}
        >
          {compact ? 'OFF' : 'Offen'}
        </span>
      );
    }
    return (
      <span
        className={`${base} border border-emerald-500/45 bg-emerald-950/45 text-emerald-100 ${className}`}
      >
        {compact ? 'DA' : 'Dabei'}
      </span>
    );
  }
  if (status === 'yes') {
    return (
      <span
        className={`${base} border border-emerald-500/45 bg-emerald-950/45 text-emerald-100 ${className}`}
      >
        {compact ? 'ZUG' : 'Zugesagt'}
      </span>
    );
  }
  if (status === 'no') {
    return (
      <span
        className={`${base} border border-red-500/45 bg-red-950/55 text-red-100 ${className}`}
      >
        {compact ? 'ABS' : 'Abgesagt'}
      </span>
    );
  }
  return (
    <span
      className={`${base} border border-white/20 bg-white/10 text-white/70 ${className}`}
    >
      {compact ? 'OFF' : 'Offen'}
    </span>
  );
}
