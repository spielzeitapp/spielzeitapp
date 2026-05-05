import React from 'react';

type Props = {
  yes: number;
  no: number;
  open: number;
  isTraining?: boolean;
  /** Schmale rechte Spalte in der Terminliste (ca. 48px). */
  listColumn?: boolean;
  className?: string;
};

const pillSm =
  'inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full border px-1 text-[9px] font-semibold leading-none tabular-nums';

/** Kompakte Teilnehmerzahlen für Trainer/Staff (nur Darstellung). */
export function TrainerStatsMini({
  yes,
  no,
  open,
  isTraining = false,
  listColumn = false,
  className = '',
}: Props) {
  if (listColumn) {
    return (
      <div
        className={`flex w-full max-w-[82px] flex-col items-end justify-center gap-1 ${className}`}
        aria-label="Zu- und Absagen"
      >
        <span
          className={`${pillSm} border-emerald-500/25 bg-emerald-950/45 text-emerald-100`}
          title={isTraining ? 'Dabei' : 'Zugesagt'}
        >
          ✓ {yes}
        </span>
        <span
          className={`${pillSm} border-red-500/25 bg-red-950/50 text-red-100`}
          title="Abgesagt"
        >
          ✕ {no}
        </span>
        <span
          className={`${pillSm} border-white/[0.1] bg-white/[0.08] text-white/65`}
          title="Offen"
        >
          ? {open}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-row flex-wrap items-center justify-end gap-1.5 ${className}`}
      aria-label="Zu- und Absagen"
    >
      <span
        className="flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-950/40 px-1.5 text-[11px] font-bold tabular-nums text-emerald-100"
        title="Zugesagt"
      >
        {yes}
      </span>
      <span
        className="flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-red-500/40 bg-red-950/45 px-1.5 text-[11px] font-bold tabular-nums text-red-100"
        title="Abgesagt"
      >
        {no}
      </span>
      <span
        className="flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-white/18 bg-white/[0.1] px-1.5 text-[11px] font-bold tabular-nums text-white/65"
        title="Offen"
      >
        {open}
      </span>
    </div>
  );
}
