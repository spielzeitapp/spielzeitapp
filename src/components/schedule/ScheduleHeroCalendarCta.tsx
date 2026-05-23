import React from 'react';
import { CalendarPlus, ChevronRight } from 'lucide-react';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';

type Props = {
  onClick: () => void;
  label?: string;
  className?: string;
};

/** Voller Deep-Red Kalender-CTA im Termine-Hero. */
export function ScheduleHeroCalendarCta({
  onClick,
  label = 'Zum Kalender hinzufügen',
  className = '',
}: Props) {
  return (
    <button
      type="button"
      className={`mt-2.5 flex w-full min-h-[52px] items-center gap-3 px-4 py-3.5 shadow-[0_0_28px_rgba(122,29,42,0.28)] ${dsPrimaryCtaClass()} ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <CalendarPlus className="h-5 w-5 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1 text-left text-[15px] font-semibold tracking-[0.01em]">{label}</span>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/80" strokeWidth={2} aria-hidden />
    </button>
  );
}
