import React from 'react';
import type { AttendanceStatusKind } from './AttendanceStatusPill';

type Props = {
  status: AttendanceStatusKind;
  /** Training: Standard = dabei → nur „Absagen“ / „Abgesagt“. */
  isTraining: boolean;
  onOpen: () => void;
  className?: string;
};

const btnBase =
  'shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-center text-[12px] font-semibold leading-tight transition-colors active:opacity-90';

/** Eltern/Spieler: kompakte Aktion in Zeile 1 neben dem Titel („Weitere Termine“). */
export function CompactListParentAttendance({ status, isTraining, onOpen, className = '' }: Props) {
  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onOpen();
  };

  if (isTraining) {
    if (status === 'no') {
      return (
        <button
          type="button"
          className={`${btnBase} bg-red-600 text-white ${className}`}
          onClick={openModal}
        >
          ✕ Abgesagt
        </button>
      );
    }
    return (
      <button type="button" className={`${btnBase} bg-gray-700 text-white ${className}`} onClick={openModal}>
        Absagen
      </button>
    );
  }

  if (status === 'yes') {
    return (
      <button type="button" className={`${btnBase} bg-green-600 text-white ${className}`} onClick={openModal}>
        ✓ Dabei
      </button>
    );
  }
  if (status === 'no') {
    return (
      <button type="button" className={`${btnBase} bg-red-600 text-white ${className}`} onClick={openModal}>
        ✕ Abgesagt
      </button>
    );
  }
  return (
    <button type="button" className={`${btnBase} bg-gray-700 text-gray-200 ${className}`} onClick={openModal}>
      Antworten
    </button>
  );
}
