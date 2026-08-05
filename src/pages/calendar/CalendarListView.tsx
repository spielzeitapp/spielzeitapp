import React, { useMemo } from 'react';
import type { CalendarEvent } from './calendarTypes';
import {
  addDays,
  formatMonthHeaderUpper,
  formatWeekRangeLabel,
  getDaysInMonth,
  startOfWeekMonday,
  toViennaDayKey,
} from './calendarUtils';
import { CalendarDayAgenda } from './CalendarDayAgenda';
import { CalendarDayStrip } from './CalendarDayStrip';
import { CalendarPeriodNav } from './CalendarPeriodNav';

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
  const monthDays = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  const monthLabel = useMemo(() => formatMonthHeaderUpper(currentMonth), [currentMonth]);
  const isTodaySelected = toViennaDayKey(selectedDate) === todayKey;

  return (
    <div className="space-y-3 overflow-x-hidden">
      <CalendarPeriodNav
        label={monthLabel}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
        onGoToday={onGoToday}
        showTodayButton={!isTodaySelected}
        prevLabel="Vorheriger Monat"
        nextLabel="Nächster Monat"
      />

      <CalendarDayStrip
        days={monthDays}
        selectedDate={selectedDate}
        eventsByDay={eventsByDay}
        onSelectDate={onSelectDate}
      />

      <CalendarDayAgenda
        selectedDate={selectedDate}
        eventsByDay={eventsByDay}
        showTeamName={showTeamName}
        onEventClick={onEventClick}
      />
    </div>
  );
};
