import React from 'react';

type Props = {
  yes: number;
  no: number;
  open: number;
  isTraining?: boolean;
  /** Schmale rechte Spalte in der Terminliste: Zahlen untereinander, ohne Überlappung. */
  listColumn?: boolean;
  className?: string;
};

/** Kompakte Teilnehmerzahlen für Trainer/Staff (nur Darstellung). */
export function TrainerStatsMini({
  yes,
  no,
  open,
  isTraining = false,
  listColumn = false,
  className = '',
}: Props) {
  if (isTraining) {
    return (
      <div
        className={`flex w-full flex-col items-end justify-center gap-1 ${className}`}
        aria-label="Trainings-Teilnahme"
      >
        <span
          className="inline-flex max-w-full items-center justify-center rounded-full border border-red-500/40 bg-red-950/45 px-2 py-1 text-[9px] font-bold tabular-nums leading-tight text-red-100 sm:text-[10px]"
          title="Abgesagt"
        >
          {no} abgesagt
        </span>
        <span
          className="inline-flex max-w-full items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-[9px] font-bold tabular-nums leading-tight text-emerald-100 sm:text-[10px]"
          title="Dabei"
        >
          {yes} dabei
        </span>
      </div>
    );
  }

  if (listColumn) {
    return (
      <div
        className={`flex w-full flex-col items-end justify-center gap-1 ${className}`}
        aria-label="Zu- und Absagen"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-950/40 text-[10px] font-bold tabular-nums text-emerald-100"
          title="Zugesagt"
        >
          {yes}
        </span>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/40 bg-red-950/45 text-[10px] font-bold tabular-nums text-red-100"
          title="Abgesagt"
        >
          {no}
        </span>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/18 bg-white/[0.1] text-[10px] font-bold tabular-nums text-white/65"
          title="Offen"
        >
          {open}
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
