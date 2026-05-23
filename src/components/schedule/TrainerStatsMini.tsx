import React from 'react';

type Props = {
  yes: number;
  no: number;
  open: number;
  isTraining?: boolean;
  /** Schmale rechte Spalte (Hero + Liste gleiche Größe). */
  listColumn?: boolean;
  /** @deprecated — gleiche Größe wie Hero */
  listCompact?: boolean;
  /** @deprecated — Alias für listColumn */
  heroColumn?: boolean;
  className?: string;
};

const pillSm =
  'inline-flex shrink-0 items-center justify-center rounded-full border font-bold leading-none tabular-nums';

/** Einheitliche Pill-Größe Hero + „Weitere Termine“. */
const pillSizeColumn = 'h-[26px] min-w-[36px] px-1.5 text-[10px]';
const pillSizeRow = 'h-9 min-w-[2.35rem] px-2.5 text-[12px]';

/** Teilnehmerzahlen für Trainer/Staff (nur Darstellung). */
export function TrainerStatsMini({
  yes,
  no,
  open,
  isTraining = false,
  listColumn = false,
  listCompact: _listCompact = false,
  heroColumn: _heroColumn = false,
  className = '',
}: Props) {
  void _listCompact;
  void _heroColumn;
  const yesTitle = isTraining ? 'Dabei' : 'Zugesagt';
  const pillSize = listColumn ? pillSizeColumn : pillSizeRow;

  if (listColumn) {
    return (
      <div
        className={`flex w-full max-w-[96px] flex-col items-end justify-center gap-1 ${className}`}
        aria-label="Zu- und Absagen"
      >
        <span
          className={`${pillSm} ${pillSize} border-emerald-500/40 bg-[rgba(14,58,40,0.55)] text-[#9DFFC5] shadow-[0_0_14px_rgba(40,255,120,0.12)]`}
          title={yesTitle}
        >
          ✓ {yes}
        </span>
        <span
          className={`${pillSm} ${pillSize} border-[rgba(122,29,42,0.4)] bg-[rgba(58,18,24,0.58)] text-[#E8B0B8] shadow-[0_0_14px_rgba(122,29,42,0.14)]`}
          title="Abgesagt"
        >
          ✕ {no}
        </span>
        <span
          className={`${pillSm} ${pillSize} border-white/[0.12] bg-[rgba(14,14,16,0.96)] text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
          title="Offen"
        >
          ? {open}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-row flex-wrap items-center justify-end gap-2 ${className}`} aria-label="Zu- und Absagen">
      <span
        className={`flex items-center justify-center rounded-full border border-emerald-500/40 bg-[rgba(14,58,40,0.55)] font-bold tabular-nums text-[#9DFFC5] ${pillSize} shadow-[0_0_14px_rgba(40,255,120,0.12)]`}
        title={yesTitle}
      >
        {yes}
      </span>
      <span
        className={`flex items-center justify-center rounded-full border border-[rgba(122,29,42,0.42)] bg-[rgba(58,18,24,0.55)] font-bold tabular-nums text-[#E8B0B8] ${pillSize} shadow-[0_0_14px_rgba(122,29,42,0.14)]`}
        title="Abgesagt"
      >
        {no}
      </span>
      <span
        className={`flex items-center justify-center rounded-full border border-white/[0.12] bg-[rgba(18,18,20,0.94)] font-bold tabular-nums text-[#B8B0B4] ${pillSize}`}
        title="Offen"
      >
        {open}
      </span>
    </div>
  );
}
