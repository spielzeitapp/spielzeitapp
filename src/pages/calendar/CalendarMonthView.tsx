import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from './calendarTypes';
import { toLocalDayKey } from './calendarUtils';

type Props = {
  days: Date[];
  currentMonth: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  getEventColorClass: (type: CalendarEvent['event_type']) => string;
  todayKey: string;
};

export const CalendarMonthView: React.FC<Props> = ({
  days,
  currentMonth,
  eventsByDay,
  getEventColorClass,
  todayKey,
}) => {
  const navigate = useNavigate();
  const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div className="mt-2">
      <div className="grid grid-cols-7 gap-2 text-xs text-white/60 mb-2">
        {weekdayLabels.map((w) => (
          <div key={w} className="text-center font-medium">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs">
        {days.map((day) => {
          const key = toLocalDayKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              className={`min-h-[72px] rounded-xl border px-1.5 py-1.5 ${
                isCurrentMonth
                  ? 'border-white/15 bg-white/5'
                  : 'border-white/5 bg-black/20 opacity-70'
              } ${isToday ? 'ring-2 ring-yellow-400/30' : ''}`}
            >
              <div className="mb-1 text-right text-[11px] font-semibold text-white/80">
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.map((ev) => {
                  const t = new Date(ev.starts_at);
                  const time = t.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => navigate(`/app/events/${ev.id}`)}
                      className={`flex flex-col rounded-md px-1 py-0.5 text-left ${getEventColorClass(
                        ev.event_type,
                      )}`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold tabular-nums">{time}</span>
                        <span className="truncate text-[10px] font-semibold">{ev.title}</span>
                      </div>
                      {ev.team_name ? (
                        <span className="text-[9px] text-white/80 truncate">{ev.team_name}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

