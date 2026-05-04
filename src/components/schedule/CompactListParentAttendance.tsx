import React from 'react';
import type { AttendanceStatusKind } from './AttendanceStatusPill';

type Props = {
  status: AttendanceStatusKind;
  isTraining: boolean;
  onOpen: () => void;
  className?: string;
};

const btnBase =
  'max-w-[86px] min-w-0 shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-center text-[11px] font-medium leading-tight transition-colors active:opacity-90';

/** Eltern/Spieler: Aktion rechts oben in „Weitere Termine“ (Eltern-Kompaktkarte). */
export function CompactListParentAttendance({ status, isTraining, onOpen, className = '' }: Props) {
  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onOpen();
  };

  const grayMuted = 'bg-gray-700/60 text-gray-200';
  const greenSoft = 'bg-emerald-800/90 text-emerald-50';
  const redSoft = 'bg-red-800/85 text-red-50';

  if (isTraining) {
    if (status === 'no') {
      return (
        <button type="button" className={`${btnBase} ${redSoft} ${className}`} onClick={openModal}>
          ✕ Abgesagt
        </button>
      );
    }
    return (
      <button type="button" className={`${btnBase} ${grayMuted} ${className}`} onClick={openModal}>
        Absagen
      </button>
    );
  }

  if (status === 'yes') {
    return (
      <button type="button" className={`${btnBase} ${greenSoft} ${className}`} onClick={openModal}>
        ✓ Dabei
      </button>
    );
  }
  if (status === 'no') {
    return (
      <button type="button" className={`${btnBase} ${redSoft} ${className}`} onClick={openModal}>
        ✕ Abgesagt
      </button>
    );
  }
  return (
    <button type="button" className={`${btnBase} ${grayMuted} ${className}`} onClick={openModal}>
      Antworten
    </button>
  );
}
