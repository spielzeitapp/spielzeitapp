import React from 'react';
import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';
import { triggerHaptic } from '../../lib/hapticFeedback';
import { ATTENDANCE_LAZ_PILL_COLORS } from '../../lib/attendanceColors';
import type { AttendanceStatusKind } from './AttendanceStatusPill';
import { AppButton } from '../ui/AppButton';

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

const yesList =
  'border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)]';
const noList = 'border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)]';
const pendingList = 'border-white/20 bg-zinc-700/75 text-white/90';

const yesHero =
  'border-emerald-400/38 bg-emerald-600/80 text-white shadow-[0_0_8px_rgba(16,185,129,0.18)]';
const noHero = 'border-red-400/35 bg-red-600/75 text-white shadow-[0_0_8px_rgba(239,68,68,0.16)]';
const pendingHero =
  'border-amber-400/45 bg-amber-500/80 text-white shadow-[0_0_10px_rgba(245,158,11,0.22)]';

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
  const yesTone = isHero ? yesHero : yesList;
  const noTone = isHero ? noHero : noList;
  const pendingTone = isHero ? pendingHero : pendingList;

  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic();
    onOpen();
  };

  if (isTraining) {
    if (status === 'laz') {
      return (
        <AppButton
          type="button"
          variant="secondary"
          size="sm"
          className={`${btnBase} ${ATTENDANCE_LAZ_PILL_COLORS} ${className}`}
          onClick={openModal}
          aria-label="LAZ"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wide">LAZ</span>
        </AppButton>
      );
    }
    if (status === 'no') {
      return (
        <AppButton
          type="button"
          variant="danger"
          size="sm"
          className={`${btnBase} ${noTone} ${className}`}
          onClick={openModal}
          aria-label="Abgesagt"
        >
          <ThumbsDown className={iconClass} strokeWidth={2} aria-hidden />
        </AppButton>
      );
    }
    return (
      <AppButton
        type="button"
        variant="success"
        size="sm"
        className={`${btnBase} ${yesTone} ${className}`}
        onClick={openModal}
        aria-label="Dabei"
      >
        <ThumbsUp className={iconClass} strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }

  if (status === 'yes') {
    return (
      <AppButton
        type="button"
        variant="success"
        size="sm"
        className={`${btnBase} ${yesTone} ${className}`}
        onClick={openModal}
        aria-label="Zugesagt"
      >
        <ThumbsUp className={iconClass} strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }
  if (status === 'no') {
    return (
      <AppButton
        type="button"
        variant="danger"
        size="sm"
        className={`${btnBase} ${noTone} ${className}`}
        onClick={openModal}
        aria-label="Abgesagt"
      >
        <ThumbsDown className={iconClass} strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }
  return (
    <AppButton
      type="button"
      variant="pending"
      size="sm"
      className={`${btnBase} ${pendingTone} ${className}`}
      onClick={openModal}
      aria-label="Offen"
    >
      <CircleHelp className={iconClass} strokeWidth={2} aria-hidden />
    </AppButton>
  );
}
