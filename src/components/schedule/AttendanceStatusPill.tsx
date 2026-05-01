import React from 'react';

export type AttendanceStatusKind = 'yes' | 'no' | 'open';

type Props = {
  status: AttendanceStatusKind;
  /** Training: „Dabei“ / „Abwesend“ statt Zusage/Absage */
  isTraining?: boolean;
  className?: string;
};

export function AttendanceStatusPill({ status, isTraining = false, className = '' }: Props) {
  if (isTraining) {
    if (status === 'no') {
      return (
        <span
          className={`inline-flex max-w-[7rem] truncate rounded-full border border-red-500/45 bg-red-950/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-100 ${className}`}
        >
          Abwesend
        </span>
      );
    }
    return (
      <span
        className={`inline-flex max-w-[7rem] truncate rounded-full border border-emerald-500/45 bg-emerald-950/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100 ${className}`}
      >
        Dabei
      </span>
    );
  }
  if (status === 'yes') {
    return (
      <span
        className={`inline-flex max-w-[7rem] truncate rounded-full border border-emerald-500/45 bg-emerald-950/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100 ${className}`}
      >
        Zugesagt
      </span>
    );
  }
  if (status === 'no') {
    return (
      <span
        className={`inline-flex max-w-[7rem] truncate rounded-full border border-red-500/45 bg-red-950/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-100 ${className}`}
      >
        Abgesagt
      </span>
    );
  }
  return (
    <span
      className={`inline-flex max-w-[7rem] truncate rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/65 ${className}`}
    >
      Offen
    </span>
  );
}
