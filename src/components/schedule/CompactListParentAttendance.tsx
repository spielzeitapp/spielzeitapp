import React from 'react';
import type { AttendanceStatusKind } from './AttendanceStatusPill';

type Props = {
  status: AttendanceStatusKind;
  isTraining: boolean;
  onOpen: () => void;
  className?: string;
};

const btnBase =
  'max-w-[92px] min-w-0 shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-tight ease-out [transition:transform_150ms_ease-out,background-color_200ms_ease-out,color_200ms_ease-out,border-color_200ms_ease-out] active:scale-95 inline-flex items-center justify-center gap-0.5';

const iconPop = 'compact-rsvp-icon-pop inline-block shrink-0 origin-center transition-all duration-200 ease-out';

/** Eltern/Spieler: Aktion rechts oben in „Weitere Termine“ (Eltern-Kompaktkarte). */
export function CompactListParentAttendance({ status, isTraining, onOpen, className = '' }: Props) {
  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onOpen();
  };

  if (isTraining) {
    if (status === 'no') {
      return (
        <button type="button" className={`${btnBase} bg-red-600 text-white ${className}`} onClick={openModal}>
          <span className={iconPop} aria-hidden>
            ✕
          </span>
          <span className="min-w-0 truncate">Abgesagt</span>
        </button>
      );
    }
    return (
      <button type="button" className={`${btnBase} bg-green-600 text-white ${className}`} onClick={openModal}>
        <span className={iconPop} aria-hidden>
          ✓
        </span>
        <span className="min-w-0 truncate">Dabei</span>
      </button>
    );
  }

  if (status === 'yes') {
    return (
      <button type="button" className={`${btnBase} bg-green-600 text-white ${className}`} onClick={openModal}>
        <span className={iconPop} aria-hidden>
          ✓
        </span>
        <span className="min-w-0 truncate">Zugesagt</span>
      </button>
    );
  }
  if (status === 'no') {
    return (
      <button type="button" className={`${btnBase} bg-red-600 text-white ${className}`} onClick={openModal}>
        <span className={iconPop} aria-hidden>
          ✕
        </span>
        <span className="min-w-0 truncate">Abgesagt</span>
      </button>
    );
  }
  return (
    <button type="button" className={`${btnBase} bg-gray-700 text-gray-200 ${className}`} onClick={openModal}>
      Zu-/Absagen
    </button>
  );
}
