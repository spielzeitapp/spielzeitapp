import React, { useMemo } from 'react';
import type { CalendarEvent } from './calendarTypes';
import {
  formatMonthNavLabel,
  getDayEventMarkerDots,
  toViennaDayKey,
} from './calendarUtils';
import { getDateTimePartsInTimeZone, isSameViennaCalendarDay, VIENNA_TZ } from '../../lib/viennaTime';
import { CalendarDayAgenda } from './CalendarDayAgenda';
import { CalendarPeriodNav } from './CalendarPeriodNav';

type Props = {
  days: Date[];
  currentMonth: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToday: () => void;
  todayKey: string;
  showTeamName?: boolean;
  onEventClick?: (eventId: string) => void;
};

const WEEKDAY_LABELS = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];

export const CalendarMonthView: React.FC<Props> = ({
  days,
  currentMonth,
  eventsByDay,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onGoToday,
  todayKey,
  showTeamName = false,
  onEventClick,
}) => {
  const monthLabel = useMemo(() => formatMonthNavLabel(currentMonth), [currentMonth]);
  const currentMonthParts = getDateTimePartsInTimeZone(currentMonth, VIENNA_TZ);
  const isTodaySelected = toViennaDayKey(selectedDate) === todayKey;

  const handleDayTap = (day: Date) => {
    onSelectDate(day);
  };

  return (
    <div className="min-w-0 space-y-3 overflow-hidden">
      <CalendarPeriodNav
        label={monthLabel}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
        onGoToday={onGoToday}
        showTodayButton={!isTodaySelected}
        prevLabel="Vorheriger Monat"
        nextLabel="Nächster Monat"
      />

      <div className="min-w-0 overflow-hidden">
        <div className="mb-1 grid grid-cols-7 gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-center">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {days.map((day) => {
            const key = toViennaDayKey(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const markerDots = getDayEventMarkerDots(dayEvents);
            const dayParts = getDateTimePartsInTimeZone(day, VIENNA_TZ);
            const isCurrentMonth =
              currentMonthParts && dayParts
                ? dayParts.month === currentMonthParts.month &&
                  dayParts.year === currentMonthParts.year
                : day.getMonth() === currentMonth.getMonth();
            const isSelected = isSameViennaCalendarDay(day, selectedDate);
            const isToday = key === todayKey;
            const dayNumber = dayParts ? dayParts.day : day.getDate();
            const eventCount = dayEvents.length;

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleDayTap(day)}
                aria-pressed={isSelected}
                aria-label={`${dayNumber}. ${eventCount} Termine`}
                className={[
                  'flex min-h-[44px] min-w-0 flex-col items-center justify-start rounded-lg border py-1 transition',
                  isCurrentMonth
                    ? 'border-white/10 bg-white/[0.03]'
                    : 'border-white/[0.05] bg-black/20 opacity-55',
                  isSelected
                    ? 'border-red-500/40 bg-red-600/20 shadow-[0_0_10px_rgba(220,38,38,0.2)]'
                    : 'hover:border-white/15 hover:bg-white/[0.05]',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums',
                    isSelected
                      ? 'bg-red-600 text-white'
                      : isToday
                        ? 'text-red-300'
                        : isCurrentMonth
                          ? 'text-white/85'
                          : 'text-white/40',
                  ].join(' ')}
                >
                  {dayNumber}
                </span>

                <span className="mt-0.5 flex h-1.5 items-center justify-center gap-0.5" aria-hidden>
                  {markerDots.map((dotClass) => (
                    <span key={dotClass} className={`h-1 w-1 rounded-full ${dotClass}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <CalendarDayAgenda
        selectedDate={selectedDate}
        eventsByDay={eventsByDay}
        showTeamName={showTeamName}
        onEventClick={onEventClick}
      />
    </div>
  );
};
