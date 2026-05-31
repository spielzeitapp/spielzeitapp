import React from 'react';
import { MONTH_LEGEND_ITEMS } from './calendarUtils';

export const CalendarMonthLegend: React.FC = () => {
  return (
    <div className="-mx-0.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max flex-wrap items-center gap-x-3 gap-y-1.5 px-0.5 sm:min-w-0 sm:flex-wrap">
        {MONTH_LEGEND_ITEMS.map((item) => (
          <span
            key={item.label}
            className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-white/60"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${item.dotClass}`} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};
