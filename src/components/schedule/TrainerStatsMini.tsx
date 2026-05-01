import React from 'react';

type Props = {
  yes: number;
  no: number;
  open: number;
  isTraining?: boolean;
  className?: string;
};

/** Kompakte Teilnehmerzahlen für Trainer/Staff (nur Darstellung). */
export function TrainerStatsMini({ yes, no, open, isTraining = false, className = '' }: Props) {
  if (isTraining) {
    return (
      <div
        className={`flex flex-wrap items-center justify-end gap-1 ${className}`}
        aria-label="Trainings-Teilnahme"
      >
        <span
          className="tabular-nums rounded-full border border-red-500/35 bg-red-950/40 px-1.5 py-0.5 text-[10px] font-bold text-red-200"
          title="Abwesend"
        >
          {no} abg.
        </span>
        <span
          className="tabular-nums rounded-full border border-emerald-500/35 bg-emerald-950/35 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100"
          title="Dabei"
        >
          {yes} da
        </span>
      </div>
    );
  }
  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-1 ${className}`}
      aria-label="Zu- und Absagen"
    >
      <span
        className="tabular-nums rounded-full border border-emerald-500/35 bg-emerald-950/35 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100"
        title="Zugesagt"
      >
        {yes}
      </span>
      <span
        className="tabular-nums rounded-full border border-red-500/35 bg-red-950/40 px-1.5 py-0.5 text-[10px] font-bold text-red-200"
        title="Abgesagt"
      >
        {no}
      </span>
      <span
        className="tabular-nums rounded-full border border-white/15 bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/55"
        title="Offen"
      >
        {open}
      </span>
    </div>
  );
}
