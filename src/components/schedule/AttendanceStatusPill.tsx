import React from 'react';
import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';

export type AttendanceStatusKind = 'yes' | 'no' | 'open' | 'laz';

type Props = {
  status: AttendanceStatusKind;
  /** Training: „Dabei“ / „Abwesend“ statt Zusage/Absage */
  isTraining?: boolean;
  /** Schmale Terminlisten-Karte (kurze Labels). */
  compact?: boolean;
  className?: string;
};

export function AttendanceStatusPill({
  status,
  isTraining = false,
  compact = false,
  className = '',
}: Props) {
  const size = compact ? 'h-10 w-10' : 'h-11 w-11';
  const iconSize = compact ? 'h-5 w-5' : 'h-[22px] w-[22px]';
  const base =
    `inline-flex ${size} shrink-0 items-center justify-center rounded-full border transition-all duration-200`;

  if (isTraining) {
    if (status === 'laz') {
      return (
        <span
          className={`${base} border-[rgba(40,160,100,0.35)] bg-[rgba(10,48,34,0.75)] text-[#72E09A] shadow-[0_0_14px_rgba(40,140,90,0.2)] ${className}`}
          aria-label="LAZ"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wide">LAZ</span>
        </span>
      );
    }
    if (status === 'no') {
      return (
        <span
          className={`${base} border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)] ${className}`}
          aria-label="Abgesagt"
        >
          <ThumbsDown className={iconSize} strokeWidth={2} aria-hidden />
        </span>
      );
    }
    return (
      <span
        className={`${base} border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)] ${className}`}
        aria-label="Dabei"
      >
        <ThumbsUp className={iconSize} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  if (status === 'yes') {
    return (
      <span
        className={`${base} border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)] ${className}`}
        aria-label="Zugesagt"
      >
        <ThumbsUp className={iconSize} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  if (status === 'no') {
    return (
      <span
        className={`${base} border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)] ${className}`}
        aria-label="Abgesagt"
      >
        <ThumbsDown className={iconSize} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  return (
    <span className={`${base} border-white/20 bg-zinc-700/75 text-white/90 ${className}`} aria-label="Offen">
      <CircleHelp className={iconSize} strokeWidth={2} aria-hidden />
    </span>
  );
}
