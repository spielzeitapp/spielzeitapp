import React from 'react';

type Props = {
  yes: number;
  no: number;
  open: number;
  isTraining?: boolean;
  /** Schmale rechte Spalte in der Terminliste (ca. 48px). */
  listColumn?: boolean;
  /** Kompaktliste: kleinere Chips. */
  listCompact?: boolean;
  className?: string;
};

const pillSm =
  'inline-flex shrink-0 items-center justify-center rounded-full border font-bold leading-none tabular-nums';

/** Kompakte Teilnehmerzahlen für Trainer/Staff (nur Darstellung). */
export function TrainerStatsMini({
  yes,
  no,
  open,
  isTraining = false,
  listColumn = false,
  listCompact = false,
  className = '',
}: Props) {
  const yesTitle = isTraining ? 'Dabei' : 'Zugesagt';
  const pillSize = listCompact
    ? 'h-[17px] min-w-[22px] px-0.5 text-[7px]'
    : 'h-[22px] min-w-[28px] px-1.5 text-[9px]';

  if (listColumn) {
    return (
      <div
        className={`flex w-full max-w-[80px] flex-col items-end justify-center gap-0.5 ${className}`}
        aria-label="Zu- und Absagen"
      >
        <span
          className={`${pillSm} ${pillSize} border-emerald-500/30 bg-[rgba(14,58,40,0.45)] text-[#9DFFC5] shadow-[0_0_8px_rgba(40,255,120,0.08)]`}
          title={yesTitle}
        >
          ✓ {yes}
        </span>
        <span
          className={`${pillSm} ${pillSize} border-[rgba(122,29,42,0.32)] bg-[rgba(58,18,24,0.48)] text-[#D4A0A8] shadow-[0_0_8px_rgba(122,29,42,0.1)]`}
          title="Abgesagt"
        >
          ✕ {no}
        </span>
        <span
          className={`${pillSm} ${pillSize} border-white/[0.08] bg-[rgba(14,14,16,0.95)] text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}
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
