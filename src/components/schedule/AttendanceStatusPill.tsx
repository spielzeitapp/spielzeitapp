import React from 'react';
import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';

export type AttendanceStatusKind = 'yes' | 'no' | 'open';

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
  const size = compact ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const base =
    `inline-flex ${size} shrink-0 items-center justify-center rounded-full border transition-colors`;

  if (isTraining) {
    if (status === 'no') {
      return (
        <span className={`${base} border-red-500/35 bg-red-950/55 text-red-100 ${className}`} aria-label="Abgesagt">
          <ThumbsDown className={iconSize} strokeWidth={2} aria-hidden />
        </span>
      );
    }
    return (
      <span className={`${base} border-emerald-500/35 bg-emerald-950/45 text-emerald-100 ${className}`} aria-label="Dabei">
        <ThumbsUp className={iconSize} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  if (status === 'yes') {
    return (
      <span className={`${base} border-emerald-500/35 bg-emerald-950/45 text-emerald-100 ${className}`} aria-label="Zugesagt">
        <ThumbsUp className={iconSize} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  if (status === 'no') {
    return (
      <span className={`${base} border-red-500/35 bg-red-950/55 text-red-100 ${className}`} aria-label="Abgesagt">
        <ThumbsDown className={iconSize} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  return (
    <span className={`${base} border-white/20 bg-white/[0.09] text-white/70 ${className}`} aria-label="Offen">
      <CircleHelp className={iconSize} strokeWidth={2} aria-hidden />
    </span>
  );
}
