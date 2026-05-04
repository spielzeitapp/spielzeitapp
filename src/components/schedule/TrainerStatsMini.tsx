import React from 'react';

type Props = {
  yes: number;
  no: number;
  open: number;
  isTraining?: boolean;
  /** Schmale rechte Spalte in der Terminliste (ca. 58px). */
  listColumn?: boolean;
  className?: string;
};

const pillSm =
  'inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full border px-0.5 text-[8px] font-bold tabular-nums sm:text-[9px]';

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
        className={`flex w-full max-w-[58px] flex-col items-center justify-center gap-0.5 ${className}`}
        aria-label="Trainings-Teilnahme"
      >
        <span
          className={`${pillSm} max-w-[58px] justify-center truncate border-red-500/40 bg-red-950/45 text-red-100`}
          title={`${no} abgesagt`}
        >
          {no} abg.
        </span>
        <span
          className={`${pillSm} max-w-[58px] justify-center truncate border-emerald-500/40 bg-emerald-950/40 text-emerald-100`}
          title={`${yes} dabei`}
        >
          {yes} da
        </span>
      </div>
    );
  }

  if (listColumn) {
    return (
      <div
        className={`flex w-full max-w-[58px] flex-col items-center justify-center gap-0.5 ${className}`}
        aria-label="Zu- und Absagen"
      >
        <div className="flex gap-0.5">
          <span
            className={`${pillSm} border-emerald-500/40 bg-emerald-950/40 text-emerald-100`}
            title="Zugesagt"
          >
            {yes}
          </span>
          <span
            className={`${pillSm} border-red-500/40 bg-red-950/45 text-red-100`}
            title="Abgesagt"
          >
            {no}
          </span>
        </div>
        <span
          className={`${pillSm} border-white/18 bg-white/[0.1] text-white/65`}
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
