import React from 'react';
import type { AttendanceStatusKind } from './AttendanceStatusPill';

type Props = {
  status: AttendanceStatusKind;
  isTraining: boolean;
  onOpen: () => void;
  className?: string;
};

const btnBase =
  'max-w-[92px] min-w-0 shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-center text-[12px] font-semibold leading-tight transition-colors active:opacity-90';

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
          ✕ Abgesagt
        </button>
      );
    }
    return (
      <button type="button" className={`${btnBase} bg-green-600 text-white ${className}`} onClick={openModal}>
        ✓ Dabei
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
