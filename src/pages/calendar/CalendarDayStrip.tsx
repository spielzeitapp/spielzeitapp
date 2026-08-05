import React, { useEffect, useRef } from 'react';
import type { CalendarEvent } from './calendarTypes';
import {
  formatDayStripDay,
  formatDayStripWeekday,
  toViennaDayKey,
} from './calendarUtils';
import { isSameViennaCalendarDay } from '../../lib/viennaTime';

type Props = {
  days: Date[];
  selectedDate: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onSelectDate: (date: Date) => void;
};

export const CalendarDayStrip: React.FC<Props> = ({
  days,
  selectedDate,
  eventsByDay,
  onSelectDate,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const node = selectedRef.current;
    const container = scrollRef.current;
    if (!node || !container) return;
    const nodeLeft = node.offsetLeft;
    const nodeWidth = node.offsetWidth;
    const target = nodeLeft - container.clientWidth / 2 + nodeWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [selectedDate, days]);

  return (
    <div
      ref={scrollRef}
      className="-mx-1 flex gap-1 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((day) => {
        const key = toViennaDayKey(day);
        const hasEvents = (eventsByDay.get(key)?.length ?? 0) > 0;
        const isSelected = isSameViennaCalendarDay(day, selectedDate);
        const weekday = formatDayStripWeekday(day);
        const dayNum = formatDayStripDay(day);

        return (
          <button
            key={key}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            onClick={() => onSelectDate(day)}
            aria-pressed={isSelected}
            aria-label={`${weekday} ${dayNum}`}
            className={[
              'flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center rounded-full px-2.5 py-1.5 transition',
              isSelected
                ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.35)]'
                : 'text-white/75 hover:bg-white/8',
            ].join(' ')}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
              {weekday}
            </span>
            <span className="mt-0.5 text-[15px] font-bold tabular-nums leading-none">{dayNum}</span>
            <span
              className={[
                'mt-1 h-1 w-1 rounded-full',
                hasEvents ? (isSelected ? 'bg-white/90' : 'bg-red-400') : 'bg-transparent',
              ].join(' ')}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
};
