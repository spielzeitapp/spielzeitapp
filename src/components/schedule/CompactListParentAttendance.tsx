import React from 'react';
import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';
import { triggerHaptic } from '../../lib/hapticFeedback';
import type { AttendanceStatusKind } from './AttendanceStatusPill';
import { AppButton } from '../ui/AppButton';

type Props = {
  status: AttendanceStatusKind;
  isTraining: boolean;
  onOpen: () => void;
  /** Hero: wie Liste, max. +2px; kein FAB-Look. */
  context?: 'hero' | 'list';
  className?: string;
};

const btnList =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border p-0 transition-all duration-200';

const btnHero =
  'inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border p-0 transition-all duration-200';

const yesTone =
  'border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)]';
const noTone = 'border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)]';
const pendingTone = 'border-white/20 bg-zinc-700/75 text-white/90';

/** Eltern/Spieler: Daumen in Hero oder „Weitere Termine“. */
export function CompactListParentAttendance({
  status,
  isTraining,
  onOpen,
  context = 'list',
  className = '',
}: Props) {
  const isHero = context === 'hero';
  const btnBase = isHero ? btnHero : `${btnList} ml-2`;
  const iconClass = 'h-5 w-5';

  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic();
    onOpen();
  };

  if (isTraining) {
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
