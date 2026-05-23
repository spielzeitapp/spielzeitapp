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
  'inline-flex h-[22px] min-w-[28px] shrink-0 items-center justify-center rounded-full border px-1.5 text-[9px] font-bold leading-none tabular-nums';

/** Kompakte Teilnehmerzahlen für Trainer/Staff (nur Darstellung). */
export function TrainerStatsMini({
  yes,
  no,
  open,
  isTraining = false,
  listColumn = false,
  className = '',
}: Props) {
  const yesTitle = isTraining ? 'Dabei' : 'Zugesagt';

  if (listColumn) {
    return (
      <div
        className={`flex w-full max-w-[88px] flex-col items-end justify-center gap-1 ${className}`}
        aria-label="Zu- und Absagen"
      >
        <span
          className={`${pillSm} border-emerald-500/35 bg-[rgba(14,58,40,0.55)] text-[#9DFFC5] shadow-[0_0_12px_rgba(40,255,120,0.12)]`}
          title={yesTitle}
        >
          ✓ {yes}
        </span>
        <span
          className={`${pillSm} border-[rgba(122,29,42,0.4)] bg-[rgba(58,18,24,0.55)] text-[#E8A0A8] shadow-[0_0_12px_rgba(122,29,42,0.14)]`}
          title="Abgesagt"
        >
          ✕ {no}
        </span>
        <span
          className={`${pillSm} border-white/[0.1] bg-[rgba(18,18,20,0.92)] text-[#B8B0B4] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
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
        className="flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-emerald-500/35 bg-[rgba(14,58,40,0.5)] px-2 text-[11px] font-bold tabular-nums text-[#9DFFC5] shadow-[0_0_12px_rgba(40,255,120,0.1)]"
        title={yesTitle}
      >
        {yes}
      </span>
      <span
        className="flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-[rgba(122,29,42,0.38)] bg-[rgba(58,18,24,0.5)] px-2 text-[11px] font-bold tabular-nums text-[#E8A0A8] shadow-[0_0_12px_rgba(122,29,42,0.12)]"
        title="Abgesagt"
      >
        {no}
      </span>
      <span
        className="flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-white/[0.1] bg-[rgba(18,18,20,0.92)] px-2 text-[11px] font-bold tabular-nums text-[#B8B0B4]"
        title="Offen"
      >
        {open}
      </span>
    </div>
  );
}
