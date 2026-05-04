import React from 'react';
import { Check, X } from 'lucide-react';
import type { AttendanceStatusKind } from './AttendanceStatusPill';

type Props = {
  status: AttendanceStatusKind;
  onOpen: () => void;
  className?: string;
};

/** Kompakte Zu-/Absage für „Weitere Termine“ (Eltern/Spieler). */
export function CompactListParentAttendance({ status, onOpen, className = '' }: Props) {
  const baseBtn =
    'w-full min-w-0 rounded-lg px-1.5 py-1.5 text-center text-[9px] font-bold leading-tight transition-colors sm:text-[10px]';

  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onOpen();
  };

  if (status === 'yes') {
    return (
      <button
        type="button"
        className={`${baseBtn} inline-flex items-center justify-center gap-0.5 border border-emerald-500/35 bg-emerald-950/55 text-emerald-100 active:bg-emerald-950/70 ${className}`}
        onClick={openModal}
      >
        <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
        Zugesagt
      </button>
    );
  }
  if (status === 'no') {
    return (
      <button
        type="button"
        className={`${baseBtn} inline-flex items-center justify-center gap-0.5 border border-red-500/35 bg-red-950/50 text-red-100 active:bg-red-950/65 ${className}`}
        onClick={openModal}
      >
        <X className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
        Abgesagt
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`${baseBtn} border border-white/15 bg-white/[0.06] text-white/80 hover:border-white/25 hover:bg-white/[0.09] active:bg-white/[0.12] ${className}`}
      onClick={openModal}
    >
      Zu-/Absagen
    </button>
  );
}
