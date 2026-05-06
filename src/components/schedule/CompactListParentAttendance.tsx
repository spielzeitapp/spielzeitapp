import React from 'react';
import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';
import { triggerHaptic } from '../../lib/hapticFeedback';
import type { AttendanceStatusKind } from './AttendanceStatusPill';
import { AppButton } from '../ui/AppButton';

type Props = {
  status: AttendanceStatusKind;
  isTraining: boolean;
  onOpen: () => void;
  className?: string;
};

const btnBase =
  'ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border p-0 transition-all duration-200';

/** Eltern/Spieler: Aktion rechts oben in „Weitere Termine“ (Eltern-Kompaktkarte). */
export function CompactListParentAttendance({ status, isTraining, onOpen, className = '' }: Props) {
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
          className={`${btnBase} border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)] ${className}`}
          onClick={openModal}
          aria-label="Abgesagt"
        >
          <ThumbsDown className="h-5 w-5" strokeWidth={2} aria-hidden />
        </AppButton>
      );
    }
    return (
      <AppButton
        type="button"
        variant="success"
        size="sm"
        className={`${btnBase} border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)] ${className}`}
        onClick={openModal}
        aria-label="Dabei"
      >
        <ThumbsUp className="h-5 w-5" strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }

  if (status === 'yes') {
    return (
      <AppButton
        type="button"
        variant="success"
        size="sm"
        className={`${btnBase} border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)] ${className}`}
        onClick={openModal}
        aria-label="Zugesagt"
      >
        <ThumbsUp className="h-5 w-5" strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }
  if (status === 'no') {
    return (
      <AppButton
        type="button"
        variant="danger"
        size="sm"
        className={`${btnBase} border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)] ${className}`}
        onClick={openModal}
        aria-label="Abgesagt"
      >
        <ThumbsDown className="h-5 w-5" strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }
  return (
    <AppButton
      type="button"
      variant="pending"
      size="sm"
      className={`${btnBase} border-white/20 bg-zinc-700/75 text-white/90 ${className}`}
      onClick={openModal}
      aria-label="Offen"
    >
      <CircleHelp className="h-5 w-5" strokeWidth={2} aria-hidden />
    </AppButton>
  );
}
