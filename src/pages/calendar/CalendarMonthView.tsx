import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from './calendarTypes';
import {
  findNextUpcomingMatch,
  formatMonthChipTime,
  getMonthEventChipClasses,
  inferMonthEventChipCategory,
  toLocalDayKey,
} from './calendarUtils';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from '../../lib/viennaTime';
import { CalendarMonthLegend } from './CalendarMonthLegend';
import { CalendarMonthNav } from './CalendarMonthNav';
import { CalendarNextMatchHero } from './CalendarNextMatchHero';

type Props = {
  days: Date[];
  currentMonth: Date;
  events: CalendarEvent[];
  eventsByDay: Map<string, CalendarEvent[]>;
  getEventColorClass: (type: CalendarEvent['type']) => string;
  todayKey: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

const MAX_VISIBLE_EVENTS = 3;

function sortEventsByStart(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
}

export const CalendarMonthView: React.FC<Props> = ({
  days,
  currentMonth,
  events,
  eventsByDay,
  todayKey,
  onPrevMonth,
  onNextMonth,
}) => {
  const navigate = useNavigate();
  const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const currentMonthParts = getDateTimePartsInTimeZone(currentMonth, VIENNA_TZ);
  const nextMatch = useMemo(() => findNextUpcomingMatch(events), [events]);

  return (
    <div className="min-w-0 space-y-3 overflow-hidden">
      <CalendarMonthNav
        currentMonth={currentMonth}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
      />
      <CalendarMonthLegend />
      {nextMatch ? <CalendarNextMatchHero match={nextMatch} /> : null}

      <div className="min-w-0 overflow-hidden">
        <div className="mb-1.5 grid grid-cols-7 gap-1 text-[10px] text-white/55 sm:gap-2 sm:text-xs">
          {weekdayLabels.map((w) => (
            <div key={w} className="text-center font-semibold uppercase tracking-wide">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {days.map((day) => {
            const key = toLocalDayKey(day);
            const dayEvents = sortEventsByStart(eventsByDay.get(key) ?? []);
            const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
            const hiddenCount = Math.max(0, dayEvents.length - visibleEvents.length);
            const dayParts = getDateTimePartsInTimeZone(day, VIENNA_TZ);
            const isCurrentMonth =
              currentMonthParts && dayParts
                ? dayParts.month === currentMonthParts.month
                : day.getMonth() === currentMonth.getMonth();
            const isToday = key === todayKey;
            const dayNumber = dayParts ? dayParts.day : day.getDate();

            return (
              <div
                key={key}
                className={[
                  'flex min-h-[5.75rem] min-w-0 flex-col overflow-hidden rounded-lg border px-1 py-1 sm:min-h-[6.25rem] sm:rounded-xl sm:px-1.5 sm:py-1.5',
                  isCurrentMonth
                    ? 'border-white/12 bg-white/[0.04]'
                    : 'border-white/[0.06] bg-black/25 opacity-65',
                  isToday
                    ? 'border-red-500/35 shadow-[inset_0_0_18px_rgba(220,38,38,0.12)] ring-1 ring-red-500/25'
                    : '',
                ].join(' ')}
              >
                <div className="mb-1 flex shrink-0 justify-end">
                  {isToday ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white shadow-[0_0_12px_rgba(220,38,38,0.55)]">
                      {dayNumber}
                    </span>
                  ) : (
                    <span
                      className={`pr-0.5 text-[11px] font-semibold tabular-nums ${
                        isCurrentMonth ? 'text-white/82' : 'text-white/45'
                      }`}
                    >
                      {dayNumber}
                    </span>
                  )}
                </div>

                <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
                  {visibleEvents.map((ev) => {
                    const category = inferMonthEventChipCategory(ev);
                    const chipClass = getMonthEventChipClasses(category);
                    const timeLabel = formatMonthChipTime(ev);

                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => navigate(`/app/events/${ev.id}`)}
                        title={`${timeLabel} · ${ev.title}`}
                        className={`flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-[9px] font-semibold leading-tight sm:text-[10px] ${chipClass}`}
                      >
                        <span className="shrink-0 tabular-nums opacity-90">{timeLabel}</span>
                        <span className="min-w-0 truncate">{ev.title}</span>
                      </button>
                    );
                  })}

                  {hiddenCount > 0 ? (
                    <div className="truncate px-0.5 text-[9px] font-medium text-white/50 sm:text-[10px]">
                      +{hiddenCount} weitere
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
