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
  'ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border p-0';

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
          className={`${btnBase} border-red-500/35 bg-red-950/60 text-red-100 ${className}`}
          onClick={openModal}
          aria-label="Abgesagt"
        >
          <ThumbsDown className="h-4 w-4" strokeWidth={2} aria-hidden />
        </AppButton>
      );
    }
    return (
      <AppButton
        type="button"
        variant="success"
        size="sm"
        className={`${btnBase} border-emerald-500/35 bg-emerald-950/50 text-emerald-100 ${className}`}
        onClick={openModal}
        aria-label="Dabei"
      >
        <ThumbsUp className="h-4 w-4" strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }

  if (status === 'yes') {
    return (
      <AppButton
        type="button"
        variant="success"
        size="sm"
        className={`${btnBase} border-emerald-500/35 bg-emerald-950/50 text-emerald-100 ${className}`}
        onClick={openModal}
        aria-label="Zugesagt"
      >
        <ThumbsUp className="h-4 w-4" strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }
  if (status === 'no') {
    return (
      <AppButton
        type="button"
        variant="danger"
        size="sm"
        className={`${btnBase} border-red-500/35 bg-red-950/60 text-red-100 ${className}`}
        onClick={openModal}
        aria-label="Abgesagt"
      >
        <ThumbsDown className="h-4 w-4" strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }
  return (
    <AppButton
      type="button"
      variant="pending"
      size="sm"
      className={`${btnBase} border-white/20 bg-white/[0.1] text-white/70 ${className}`}
      onClick={openModal}
      aria-label="Offen"
    >
      <CircleHelp className="h-4 w-4" strokeWidth={2} aria-hidden />
    </AppButton>
  );
}
