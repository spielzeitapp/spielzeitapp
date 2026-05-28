import React from 'react';
import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  attendanceAbsentPillClass,
  attendanceLazPillClass,
  attendanceOpenPillClass,
  attendancePresentPillClass,
} from '../../lib/attendanceColors';

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
  if (isTraining) {
    if (status === 'laz') {
      return (
        <span className={attendanceLazPillClass(size, className)} aria-label="LAZ">
          <span className="text-[10px] font-extrabold uppercase tracking-wide">LAZ</span>
        </span>
      );
    }
    if (status === 'no') {
      return (
        <span className={attendanceAbsentPillClass(size, className)} aria-label="Abgesagt">
          <ThumbsDown className={iconSize} strokeWidth={2} aria-hidden />
        </span>
      );
    }
    return (
      <span className={attendancePresentPillClass(size, className)} aria-label="Dabei">
        <ThumbsUp className={iconSize} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  if (status === 'yes') {
    return (
      <span className={attendancePresentPillClass(size, className)} aria-label="Zugesagt">
        <ThumbsUp className={iconSize} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  if (status === 'no') {
    return (
      <span className={attendanceAbsentPillClass(size, className)} aria-label="Abgesagt">
        <ThumbsDown className={iconSize} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  return (
    <span className={attendanceOpenPillClass(size, className)} aria-label="Offen">
      <CircleHelp className={iconSize} strokeWidth={2} aria-hidden />
    </span>
  );
}
