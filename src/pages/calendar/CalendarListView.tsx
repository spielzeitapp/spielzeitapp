import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from './calendarTypes';
import {
  formatDaySheetHeader,
  formatMonthHeaderUpper,
  formatSelectedDayCountLabel,
  getDaysInMonth,
  toViennaDayKey,
} from './calendarUtils';
import { CalendarDayStrip } from './CalendarDayStrip';
import { CalendarCompactEventCard } from './CalendarCompactEventCard';

type Props = {
  eventsByDay: Map<string, CalendarEvent[]>;
  currentMonth: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToday: () => void;
  todayKey: string;
  showTeamName?: boolean;
  onEventClick?: (eventId: string) => void;
};

export const CalendarListView: React.FC<Props> = ({
  eventsByDay,
  currentMonth,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onGoToday,
  todayKey,
  showTeamName = false,
  onEventClick,
}) => {
  const navigate = useNavigate();
  const monthDays = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  const monthLabel = useMemo(() => formatMonthHeaderUpper(currentMonth), [currentMonth]);

  const selectedKey = toViennaDayKey(selectedDate);
  const dayEvents = useMemo(() => {
    const list = eventsByDay.get(selectedKey) ?? [];
    return [...list].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  }, [eventsByDay, selectedKey]);

  const dayHeader = formatDaySheetHeader(selectedDate);
  const countLabel = formatSelectedDayCountLabel(dayEvents.length);
  const isTodaySelected = selectedKey === todayKey;

  const handleClick = (id: string) => {
    if (onEventClick) onEventClick(id);
    else navigate(`/app/events/${id}`);
  };

  return (
    <div className="space-y-3 overflow-x-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="Vorheriger Monat"
            className="inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-md text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            ←
          </button>
          <span className="min-w-0 flex-1 truncate text-center text-xs font-bold tracking-widest text-white/85">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Nächster Monat"
            className="inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-md text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            →
          </button>
        </div>
        {!isTodaySelected ? (
          <button
            type="button"
            onClick={onGoToday}
            className="shrink-0 rounded-full border border-red-500/30 bg-red-600/15 px-2.5 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-600/25"
          >
            Heute
          </button>
        ) : null}
      </div>

      <CalendarDayStrip
        days={monthDays}
        selectedDate={selectedDate}
        eventsByDay={eventsByDay}
        onSelectDate={onSelectDate}
      />

      <div className="flex items-baseline justify-between gap-2 border-b border-white/8 pb-2">
        <h2 className="min-w-0 text-sm font-semibold text-white/90">{dayHeader}</h2>
        {countLabel ? <span className="shrink-0 text-xs text-white/50">{countLabel}</span> : null}
      </div>

      <div className="space-y-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        {dayEvents.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/55">Keine Termine an diesem Tag.</p>
        ) : (
          dayEvents.map((ev) => (
            <CalendarCompactEventCard
              key={ev.id}
              ev={ev}
              showTeamName={showTeamName}
              onClick={handleClick}
            />
          ))
        )}
      </div>
    </div>
  );
};
