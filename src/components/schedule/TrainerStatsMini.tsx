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
  /** Hero: größere, lesbare Status-Pills. */
  heroColumn?: boolean;
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
  heroColumn = false,
  className = '',
}: Props) {
  const yesTitle = isTraining ? 'Dabei' : 'Zugesagt';
  const pillSize = heroColumn
    ? listColumn
      ? 'h-[26px] min-w-[34px] px-1.5 text-[10px]'
      : 'h-9 min-w-[2.35rem] px-2.5 text-[12px]'
    : listCompact
      ? 'h-[17px] min-w-[22px] px-0.5 text-[7px]'
      : 'h-[22px] min-w-[28px] px-1.5 text-[9px]';

  const yesGlow = heroColumn
    ? 'shadow-[0_0_14px_rgba(40,255,120,0.14)]'
    : 'shadow-[0_0_8px_rgba(40,255,120,0.08)]';
  const noGlow = heroColumn
    ? 'shadow-[0_0_14px_rgba(122,29,42,0.16)]'
    : 'shadow-[0_0_8px_rgba(122,29,42,0.1)]';

  if (listColumn) {
    return (
      <div
        className={`flex w-full max-w-[92px] flex-col items-end justify-center ${
          heroColumn ? 'gap-1' : 'gap-0.5'
        } ${className}`}
        aria-label="Zu- und Absagen"
      >
        <span
          className={`${pillSm} ${pillSize} border-emerald-500/35 bg-[rgba(14,58,40,0.52)] text-[#9DFFC5] ${yesGlow}`}
          title={yesTitle}
        >
          ✓ {yes}
        </span>
        <span
          className={`${pillSm} ${pillSize} border-[rgba(122,29,42,0.38)] bg-[rgba(58,18,24,0.55)] text-[#E8B0B8] ${noGlow}`}
          title="Abgesagt"
        >
          ✕ {no}
        </span>
        <span
          className={`${pillSm} ${pillSize} border-white/[0.1] bg-[rgba(14,14,16,0.96)] text-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
          title="Offen"
        >
          ? {open}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-row flex-wrap items-center justify-end ${heroColumn ? 'gap-2' : 'gap-1.5'} ${className}`}
      aria-label="Zu- und Absagen"
    >
      <span
        className={`flex items-center justify-center rounded-full border border-emerald-500/40 bg-[rgba(14,58,40,0.55)] font-bold tabular-nums text-[#9DFFC5] ${pillSize} ${yesGlow}`}
        title={yesTitle}
      >
        {yes}
      </span>
      <span
        className={`flex items-center justify-center rounded-full border border-[rgba(122,29,42,0.42)] bg-[rgba(58,18,24,0.55)] font-bold tabular-nums text-[#E8B0B8] ${pillSize} ${noGlow}`}
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
