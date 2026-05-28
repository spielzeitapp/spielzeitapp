import React from 'react';
import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';

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
    const towerBase = isHero
      ? 'flex w-full max-w-[58px] shrink-0 flex-col overflow-hidden rounded-[13px] border border-white/[0.14] bg-[linear-gradient(170deg,rgba(20,20,24,0.98)_0%,rgba(10,10,12,0.98)_58%,rgba(26,10,14,0.95)_100%)] shadow-[0_12px_24px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[1px]'
      : 'flex w-full max-w-[54px] shrink-0 flex-col overflow-hidden rounded-[12px] border border-white/[0.12] bg-[linear-gradient(170deg,rgba(20,20,24,0.98)_0%,rgba(10,10,12,0.98)_58%,rgba(26,10,14,0.95)_100%)] shadow-[0_10px_20px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[1px]';
    const rowBase = isHero
      ? 'flex min-h-[25px] items-center justify-center gap-1 px-1.5 text-[14px] font-extrabold tabular-nums leading-none'
      : 'flex min-h-[23px] items-center justify-center gap-1 px-1.5 text-[13px] font-extrabold tabular-nums leading-none';
    const iconSize = isHero ? 'h-4 w-4' : 'h-3.5 w-3.5';
    return (
      <div className={`${towerBase} ${className}`} aria-label="Zu- und Absagen">
        <span className={`${rowBase} text-emerald-300`} title={yesTitle}>
          <ThumbsUp className={`${iconSize} shrink-0`} strokeWidth={2.25} aria-hidden />
          {yes}
        </span>
        {!isTraining ? (
          <span className={`${rowBase} border-t border-white/[0.08] text-amber-300`} title="Offen">
            <CircleHelp className={`${iconSize} shrink-0`} strokeWidth={2.25} aria-hidden />
            {open}
          </span>
        ) : null}
        <span className={`${rowBase} border-t border-white/[0.08] text-rose-300`} title="Abgesagt">
          <ThumbsDown className={`${iconSize} shrink-0`} strokeWidth={2.25} aria-hidden />
          {no}
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
      {!isTraining ? (
        <span
          className={`flex items-center justify-center rounded-full border border-white/[0.12] bg-[rgba(18,18,20,0.94)] font-bold tabular-nums text-[#B8B0B4] ${pillSize}`}
          title="Offen"
        >
          {open}
        </span>
      ) : null}
    </div>
  );
}
