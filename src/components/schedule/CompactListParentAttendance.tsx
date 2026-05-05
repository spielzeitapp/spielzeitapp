import React from 'react';
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
  'w-auto ml-2 max-w-[92px] min-w-0 shrink-0 whitespace-nowrap leading-tight inline-flex items-center justify-center gap-0.5';

const iconPop =
  'compact-rsvp-icon-pop inline-block shrink-0 origin-center transition-all duration-200 ease-out opacity-80 scale-100';

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
        <AppButton type="button" variant="danger" size="sm" className={`${btnBase} ${className}`} onClick={openModal}>
          <span className={iconPop} aria-hidden>
            ✕
          </span>
          <span className="min-w-0">Abgesagt</span>
        </AppButton>
      );
    }
    return (
      <AppButton type="button" variant="success" size="sm" className={`${btnBase} ${className}`} onClick={openModal}>
        <span className="min-w-0">✓ Dabei</span>
      </AppButton>
    );
  }

  if (status === 'yes') {
    return (
      <AppButton type="button" variant="success" size="sm" className={`${btnBase} ${className}`} onClick={openModal}>
        <span className="min-w-0">✓ Zugesagt</span>
      </AppButton>
    );
  }
  if (status === 'no') {
    return (
      <AppButton type="button" variant="danger" size="sm" className={`${btnBase} ${className}`} onClick={openModal}>
        <span className="min-w-0">✕ Abgesagt</span>
      </AppButton>
    );
  }
  return (
    <AppButton type="button" variant="pending" size="sm" className={`${btnBase} ${className}`} onClick={openModal}>
      Zu-/Absagen
    </AppButton>
  );
}
