import React from 'react';
import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';
import { triggerHaptic } from '../../lib/hapticFeedback';
import type { AttendanceStatusKind } from './AttendanceStatusPill';
import { AppButton } from '../ui/AppButton';

type Props = {
  status: AttendanceStatusKind;
  isTraining: boolean;
  onOpen: () => void;
  /** Hero: kompakter, ruhiger integriert; Liste: Standard. */
  context?: 'hero' | 'list';
  className?: string;
};

const btnList =
  'ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border p-0 transition-all duration-200';

const btnHero =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border p-0 transition-all duration-200';

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
  const iconClass = isHero ? 'h-4 w-4' : 'h-5 w-5';
  const yesGlow = isHero
    ? 'border-emerald-400/35 bg-emerald-600/78 text-white shadow-[0_0_8px_rgba(16,185,129,0.18)]'
    : 'border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)]';
  const noGlow = isHero
    ? 'border-red-400/35 bg-red-600/78 text-white shadow-[0_0_8px_rgba(239,68,68,0.18)]'
    : 'border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)]';
  const pendingClass = isHero
    ? 'border-white/16 bg-zinc-700/65 text-white/85'
    : 'border-white/20 bg-zinc-700/75 text-white/90';

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
          className={`${btnBase} ${noGlow} ${className}`}
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
        className={`${btnBase} ${yesGlow} ${className}`}
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
        className={`${btnBase} ${yesGlow} ${className}`}
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
        className={`${btnBase} ${noGlow} ${className}`}
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
      className={`${btnBase} ${pendingClass} ${className}`}
      onClick={openModal}
      aria-label="Offen"
    >
      <CircleHelp className={iconClass} strokeWidth={2} aria-hidden />
    </AppButton>
  );
}
