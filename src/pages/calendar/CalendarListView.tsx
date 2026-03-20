import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from './calendarTypes';
import { toLocalDayKey } from './calendarUtils';

type Props = {
  events: CalendarEvent[];
  getEventColorClass: (type: CalendarEvent['event_type']) => string;
  todayKey: string;
  onEventClick?: (eventId: string) => void;
};

export const CalendarListView: React.FC<Props> = ({
  events,
  getEventColorClass,
  todayKey,
  onEventClick,
}) => {
  const navigate = useNavigate();

  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.starts_at);
      const key = toLocalDayKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }

    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => ({ key, list }));
  }, [events]);

  const handleClick = (id: string) => {
    if (onEventClick) onEventClick(id);
    else navigate(`/app/events/${id}`);
  };

  return (
    <div className="mt-2">
      <div className="space-y-4">
        {groups.length === 0 ? (
          <p className="text-sm text-white/60">Keine Termine für diesen Monat.</p>
        ) : null}

        {groups.map(({ key, list }) => {
          const d = new Date(list[0] ? list[0].starts_at : `${key}T00:00:00`);
          const heading = d.toLocaleDateString('de-AT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });
          const isToday = key === todayKey;

          return (
            <div key={key} className={isToday ? 'rounded-xl border border-yellow-400/30 p-2' : undefined}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white/90">{heading}</h2>
                {isToday ? <span className="text-xs text-yellow-300">Heute</span> : null}
              </div>

              <div className="space-y-2">
                {list.map((ev) => {
                  const start = new Date(ev.starts_at);
                  const time = start.toLocaleTimeString('de-AT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => handleClick(ev.id)}
                      className={`w-full text-left rounded-xl px-3 py-2 border border-white/10 bg-black/25 ${getEventColorClass(
                        ev.event_type,
                      )}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold tabular-nums">{time}</span>
                        <span className="truncate text-xs font-semibold">{ev.title}</span>
                      </div>
                      {ev.team_name ? (
                        <div className="mt-1 text-[11px] text-white/80 truncate">{ev.team_name}</div>
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

