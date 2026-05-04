import React from 'react';
import { Check, X } from 'lucide-react';
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
  'max-w-[100px] min-w-0 shrink-0 rounded-lg px-2.5 py-1 text-center text-sm font-semibold leading-tight transition-colors';

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
          className={`${btnBase} inline-flex items-center justify-center gap-1 border border-red-500/35 bg-red-950/50 text-red-100 active:bg-red-950/65 ${className}`}
          onClick={openModal}
        >
          <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          Abgesagt
        </button>
      );
    }
    return (
      <button
        type="button"
        className={`${btnBase} border border-white/15 bg-white/[0.06] text-white/85 hover:border-white/25 hover:bg-white/[0.09] active:bg-white/[0.12] ${className}`}
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
        className={`${btnBase} inline-flex items-center justify-center gap-1 border border-emerald-500/35 bg-emerald-950/55 text-emerald-100 active:bg-emerald-950/70 ${className}`}
        onClick={openModal}
      >
        <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        Zugesagt
      </button>
    );
  }
  if (status === 'no') {
    return (
      <button
        type="button"
        className={`${btnBase} inline-flex items-center justify-center gap-1 border border-red-500/35 bg-red-950/50 text-red-100 active:bg-red-950/65 ${className}`}
        onClick={openModal}
      >
        <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        Abgesagt
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`${btnBase} border border-white/15 bg-white/[0.06] text-white/85 hover:border-white/25 hover:bg-white/[0.09] active:bg-white/[0.12] ${className}`}
      onClick={openModal}
    >
      Zu-/Absagen
    </button>
  );
}
