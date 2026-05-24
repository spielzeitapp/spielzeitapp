import React from 'react';

type Props = {
  yes: number;
  no: number;
  open: number;
  isTraining?: boolean;
  listColumn?: boolean;
  /** Hero: größere Chips; Liste: kompakter. */
  size?: 'hero' | 'list';
  listCompact?: boolean;
  heroColumn?: boolean;
  className?: string;
};

const pillSm =
  'inline-flex shrink-0 items-center justify-center rounded-full border font-bold leading-none tabular-nums';

export function TrainerStatsMini({
  yes,
  no,
  open,
  isTraining = false,
  listColumn = false,
  size = 'list',
  listCompact: _listCompact = false,
  heroColumn: _heroColumn = false,
  className = '',
}: Props) {
  void _listCompact;
  void _heroColumn;
  const yesTitle = isTraining ? 'Dabei' : 'Zugesagt';
  const isHero = size === 'hero';
  const pillSize = listColumn
    ? isHero
      ? 'h-[22px] min-w-[32px] max-w-[52px] px-1 text-[9px]'
      : 'h-[20px] min-w-[30px] px-1 text-[8.5px]'
    : isHero
      ? 'h-8 min-w-[2.2rem] px-2 text-[11px]'
      : 'h-7 min-w-[1.85rem] px-1.5 text-[10px]';

  const yesGlow = isHero
    ? 'shadow-[0_0_12px_rgba(40,255,120,0.12)]'
    : 'shadow-[0_0_6px_rgba(40,255,120,0.08)]';
  const noGlow = isHero
    ? 'shadow-[0_0_12px_rgba(122,29,42,0.14)]'
    : 'shadow-[0_0_6px_rgba(122,29,42,0.08)]';

  if (listColumn) {
    return (
      <div
        className={`flex w-full max-w-[54px] flex-col items-end justify-center ${isHero ? 'gap-1' : 'gap-1'} ${className}`}
        aria-label="Zu- und Absagen"
      >
        <span
          className={`${pillSm} ${pillSize} border-emerald-500/42 bg-[rgba(14,58,40,0.58)] text-[#9DFFC5] ${yesGlow}`}
          title={yesTitle}
        >
          ✓ {yes}
        </span>
        <span
          className={`${pillSm} ${pillSize} border-[rgba(122,29,42,0.42)] bg-[rgba(58,18,24,0.6)] text-[#E8B0B8] ${noGlow}`}
          title="Abgesagt"
        >
          ✕ {no}
        </span>
        <span
          className={`${pillSm} ${pillSize} border-white/[0.12] bg-[rgba(14,14,16,0.96)] text-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
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
        className={`flex items-center justify-center rounded-full border border-emerald-500/42 bg-[rgba(14,58,40,0.58)] font-bold tabular-nums text-[#9DFFC5] ${pillSize} ${yesGlow}`}
        title={yesTitle}
      >
        {yes}
      </span>
      <span
        className={`flex items-center justify-center rounded-full border border-[rgba(122,29,42,0.44)] bg-[rgba(58,18,24,0.6)] font-bold tabular-nums text-[#E8B0B8] ${pillSize} ${noGlow}`}
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
