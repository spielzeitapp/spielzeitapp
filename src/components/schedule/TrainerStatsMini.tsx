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
  'inline-flex h-6 min-w-[26px] shrink-0 items-center justify-center rounded-full border px-1.5 text-[10px] font-bold leading-none tabular-nums shadow-sm';

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
        className={`flex w-full max-w-[96px] flex-col items-end justify-center gap-1.5 ${className}`}
        aria-label="Zu- und Absagen"
      >
        <span
          className={`${pillSm} border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]`}
          title={isTraining ? 'Dabei' : 'Zugesagt'}
        >
          ✓ {yes}
        </span>
        <span
          className={`${pillSm} border-red-400/45 bg-red-600/85 text-white shadow-[0_0_12px_rgba(239,68,68,0.28)]`}
          title="Abgesagt"
        >
          ✕ {no}
        </span>
        <span
          className={`${pillSm} border-white/18 bg-zinc-700/75 text-white/90`}
          title="Offen"
        >
          ? {open}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-row flex-wrap items-center justify-end gap-2 ${className}`}
      aria-label="Zu- und Absagen"
    >
      <span
        className="flex h-9 min-w-[2.2rem] items-center justify-center rounded-full border border-emerald-400/45 bg-emerald-600/85 px-2 text-[12px] font-bold tabular-nums text-white shadow-[0_0_14px_rgba(16,185,129,0.3)]"
        title="Zugesagt"
      >
        {yes}
      </span>
      <span
        className="flex h-9 min-w-[2.2rem] items-center justify-center rounded-full border border-red-400/45 bg-red-600/85 px-2 text-[12px] font-bold tabular-nums text-white shadow-[0_0_14px_rgba(239,68,68,0.28)]"
        title="Abgesagt"
      >
        {no}
      </span>
      <span
        className="flex h-9 min-w-[2.2rem] items-center justify-center rounded-full border border-white/18 bg-zinc-700/75 px-2 text-[12px] font-bold tabular-nums text-white/90"
        title="Offen"
      >
        {open}
      </span>
    </div>
  );
}
