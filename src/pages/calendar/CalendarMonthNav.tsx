import React from 'react';
import { formatMonthNavLabel } from './calendarUtils';

type Props = {
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export const CalendarMonthNav: React.FC<Props> = ({ currentMonth, onPrevMonth, onNextMonth }) => {
  const label = formatMonthNavLabel(currentMonth);

  return (
    <div className="flex items-center justify-center gap-3 py-0.5">
      <button
        type="button"
        onClick={onPrevMonth}
        aria-label="Vorheriger Monat"
        className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        ←
      </button>
      <span className="min-w-[7.5rem] text-center text-sm font-semibold tracking-tight text-white/90">
        {label}
      </span>
      <button
        type="button"
        onClick={onNextMonth}
        aria-label="Nächster Monat"
        className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md px-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        →
      </button>
    </div>
  );
};
