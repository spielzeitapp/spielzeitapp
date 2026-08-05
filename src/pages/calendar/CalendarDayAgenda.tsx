import React, { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from './calendarTypes';
import {
  formatDaySheetHeader,
  formatSelectedDayCountLabel,
  toViennaDayKey,
} from './calendarUtils';
import { CalendarCompactEventCard } from './CalendarCompactEventCard';

type Props = {
  selectedDate: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  showTeamName?: boolean;
  emptyMessage?: string;
  onEventClick?: (eventId: string) => void;
};

export const CalendarDayAgenda: React.FC<Props> = ({
  selectedDate,
  eventsByDay,
  showTeamName = false,
  emptyMessage = 'Keine Termine an diesem Tag.',
  onEventClick,
}) => {
  const navigate = useNavigate();
  const selectedKey = toViennaDayKey(selectedDate);

  const dayEvents = useMemo(() => {
    const list = eventsByDay.get(selectedKey) ?? [];
    return [...list].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  }, [eventsByDay, selectedKey]);

  const dayHeader = formatDaySheetHeader(selectedDate);
  const countLabel = formatSelectedDayCountLabel(dayEvents.length);

  const handleClick = (id: string) => {
    if (onEventClick) onEventClick(id);
    else navigate(`/app/events/${id}`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 border-b border-white/8 pb-2">
        <h2 className="min-w-0 text-sm font-semibold text-white/90">{dayHeader}</h2>
        {countLabel ? <span className="shrink-0 text-xs text-white/50">{countLabel}</span> : null}
      </div>

      <div className="space-y-2">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CalendarDays className="h-8 w-8 text-white/25" strokeWidth={1.5} aria-hidden />
            <p className="text-sm text-white/55">{emptyMessage}</p>
          </div>
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
