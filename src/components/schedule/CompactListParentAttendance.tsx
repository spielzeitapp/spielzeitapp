import React from 'react';
import type { AttendanceStatusKind } from './AttendanceStatusPill';

type Props = {
  status: AttendanceStatusKind;
  /** Training: Standard = dabei → nur „Absagen“ / „Abgesagt“. */
  isTraining: boolean;
  onOpen: () => void;
  className?: string;
};

/** Passt in Karten-Spalte 118px neben Pfeil (~14px + gap). */
const btnBase =
  'max-w-[92px] min-w-0 shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-center text-xs font-semibold leading-tight transition-colors';

/** Eltern/Spieler: kompakte Aktion rechts in „Weitere Termine“. */
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
          className={`${btnBase} border border-red-500/45 bg-red-950/55 text-red-100 active:bg-red-950/70 ${className}`}
          onClick={openModal}
        >
          ✕ Abgesagt
        </button>
      );
    }
    return (
      <button
        type="button"
        className={`${btnBase} border border-white/20 bg-zinc-900/80 text-white/85 hover:border-white/30 hover:bg-zinc-800/85 active:bg-zinc-800 ${className}`}
        onClick={openModal}
      >
        Absagen
      </button>
    );
  }

  if (status === 'yes') {
    return (
      <button
        type="button"
        className={`${btnBase} border border-emerald-500/45 bg-emerald-950/55 text-emerald-100 active:bg-emerald-950/70 ${className}`}
        onClick={openModal}
      >
        ✓ Dabei
      </button>
    );
  }
  if (status === 'no') {
    return (
      <button
        type="button"
        className={`${btnBase} border border-red-500/45 bg-red-950/55 text-red-100 active:bg-red-950/70 ${className}`}
        onClick={openModal}
      >
        ✕ Abgesagt
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`${btnBase} border border-white/20 bg-zinc-900/80 text-white/85 hover:border-white/30 hover:bg-zinc-800/85 active:bg-zinc-800 ${className}`}
      onClick={openModal}
    >
      Antworten
    </button>
  );
}
