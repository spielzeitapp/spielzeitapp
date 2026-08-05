import React from 'react';

type Props = {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onGoToday?: () => void;
  showTodayButton?: boolean;
  prevLabel?: string;
  nextLabel?: string;
};

export const CalendarPeriodNav: React.FC<Props> = ({
  label,
  onPrev,
  onNext,
  onGoToday,
  showTodayButton = false,
  prevLabel = 'Zurück',
  nextLabel = 'Weiter',
}) => {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label={prevLabel}
          className="inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-md text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          ←
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-xs font-bold tracking-wide text-white/85 sm:text-sm sm:tracking-widest">
          {label}
        </span>
        <button
          type="button"
          onClick={onNext}
          aria-label={nextLabel}
          className="inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-md text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          →
        </button>
      </div>
      {showTodayButton && onGoToday ? (
        <button
          type="button"
          onClick={onGoToday}
          className="shrink-0 rounded-full border border-red-500/30 bg-red-600/15 px-2.5 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-600/25"
        >
          Heute
        </button>
      ) : null}
    </div>
  );
};
