import React from 'react';
import { triggerHaptic } from '../../lib/hapticFeedback';
import type { AttendanceStatusKind } from './AttendanceStatusPill';

type Props = {
  status: AttendanceStatusKind;
  isTraining: boolean;
  onOpen: () => void;
  className?: string;
};

const btnBase =
  'ml-2 max-w-[92px] min-w-0 shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-tight transition-all duration-150 active:scale-95 inline-flex items-center justify-center gap-0.5 border';

const btnPositive = 'bg-green-600/85 text-white border-green-400/20 shadow-[0_0_12px_rgba(34,197,94,0.22)]';
const btnNegative = 'bg-red-600/85 text-white border-red-400/20 shadow-[0_0_12px_rgba(239,68,68,0.22)]';
const btnPending = 'bg-slate-700/70 text-white/90 border-white/10';

const iconPop =
  'compact-rsvp-icon-pop inline-block shrink-0 origin-center transition-all duration-200 ease-out opacity-100 scale-100';

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
        <button type="button" className={`${btnBase} ${btnNegative} ${className}`} onClick={openModal}>
          <span className={iconPop} aria-hidden>
            ✕
          </span>
          <span className="min-w-0">✕ Abgesagt</span>
        </button>
      );
    }
    return (
      <button type="button" className={`${btnBase} ${btnPositive} ${className}`} onClick={openModal}>
        <span className="min-w-0">✓ Dabei</span>
      </button>
    );
  }

  if (status === 'yes') {
    return (
      <button type="button" className={`${btnBase} ${btnPositive} ${className}`} onClick={openModal}>
        <span className="min-w-0">✓ Zugesagt</span>
      </button>
    );
  }
  if (status === 'no') {
    return (
      <button type="button" className={`${btnBase} ${btnNegative} ${className}`} onClick={openModal}>
        <span className="min-w-0">✕ Abgesagt</span>
      </button>
    );
  }
  return (
    <button type="button" className={`${btnBase} ${btnPending} ${className}`} onClick={openModal}>
      Zu-/Absagen
    </button>
  );
}
