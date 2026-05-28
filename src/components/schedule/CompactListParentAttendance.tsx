import React from 'react';
import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';
import { triggerHaptic } from '../../lib/hapticFeedback';
import {
  attendanceAbsentPillClass,
  attendanceLazPillClass,
  attendanceOpenPillClass,
  attendancePresentPillClass,
} from '../../lib/attendanceColors';
import type { AttendanceStatusKind } from './AttendanceStatusPill';

type Props = {
  status: AttendanceStatusKind;
  isTraining: boolean;
  onOpen: () => void;
  /** Hero: wie Liste, etwas kompakter; kein FAB-Look. */
  context?: 'hero' | 'list';
  className?: string;
};

const btnList =
  'inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border p-0 transition-all duration-200';

const btnHero =
  'inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border p-0 transition-all duration-200';

/** Native button – AppButton-Varianten würden LAZ/Dabei-Farben überschreiben (z. B. secondary = schwarz/grau). */
function AttendancePillButton({
  className,
  ariaLabel,
  onClick,
  children,
}: {
  className: string;
  ariaLabel: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/** Eltern/Spieler: Daumen in Hero oder „Weitere Termine“. */
export function CompactListParentAttendance({
  status,
  isTraining,
  onOpen,
  context = 'list',
  className = '',
}: Props) {
  const isHero = context === 'hero';
  const btnBase = isHero ? btnHero : btnList;
  const iconClass = isHero ? 'h-5 w-5' : 'h-5 w-5';

  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic();
    onOpen();
  };

  if (isTraining) {
    if (status === 'laz') {
      return (
        <AttendancePillButton
          className={attendanceLazPillClass(btnBase, className)}
          ariaLabel="LAZ"
          onClick={openModal}
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wide">LAZ</span>
        </AttendancePillButton>
      );
    }
    if (status === 'no') {
      return (
        <AttendancePillButton
          className={attendanceAbsentPillClass(btnBase, className)}
          ariaLabel="Abgesagt"
          onClick={openModal}
        >
          <ThumbsDown className={iconClass} strokeWidth={2} aria-hidden />
        </AttendancePillButton>
      );
    }
    return (
      <AttendancePillButton
        className={attendancePresentPillClass(btnBase, className)}
        ariaLabel="Dabei"
        onClick={openModal}
      >
        <ThumbsUp className={iconClass} strokeWidth={2} aria-hidden />
      </AttendancePillButton>
    );
  }

  if (status === 'yes') {
    return (
      <AttendancePillButton
        className={attendancePresentPillClass(btnBase, className)}
        ariaLabel="Zugesagt"
        onClick={openModal}
      >
        <ThumbsUp className={iconClass} strokeWidth={2} aria-hidden />
      </AttendancePillButton>
    );
  }
  if (status === 'no') {
    return (
      <AttendancePillButton
        className={attendanceAbsentPillClass(btnBase, className)}
        ariaLabel="Abgesagt"
        onClick={openModal}
      >
        <ThumbsDown className={iconClass} strokeWidth={2} aria-hidden />
      </AttendancePillButton>
    );
  }
  return (
    <AttendancePillButton
      className={attendanceOpenPillClass(btnBase, className)}
      ariaLabel="Offen"
      onClick={openModal}
    >
      <CircleHelp className={iconClass} strokeWidth={2} aria-hidden />
    </AttendancePillButton>
  );
}
