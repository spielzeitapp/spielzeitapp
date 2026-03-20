import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from './calendarTypes';
import { addDays, startOfWeekMonday, toLocalDayKey, resolveEndAtFromNotes } from './calendarUtils';

type Props = {
  weekAnchor: Date;
  events: CalendarEvent[];
  getEventColorClass: (type: CalendarEvent['event_type']) => string;
  todayKey: string;
  onEventClick?: (eventId: string) => void;
};

const AXIS_START_HOUR = 8;
const AXIS_END_HOUR = 20;
const PX_PER_MINUTE = 2;

function formatTime(d: Date) {
  return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

export const CalendarWeekView: React.FC<Props> = ({
  weekAnchor,
  events,
  getEventColorClass,
  todayKey,
  onEventClick,
}) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekAnchor]);

  const eventsByDayKey = useMemo(() => {
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
    return map;
  }, [events]);

  useEffect(() => {
    // Optional: scroll to "now" in week view (only if within axis).
    if (!scrollRef.current) return;

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const axisStart = AXIS_START_HOUR * 60;
    const axisEnd = AXIS_END_HOUR * 60;
    if (minutes < axisStart || minutes > axisEnd) return;

    const offsetPx = (minutes - axisStart) * PX_PER_MINUTE - 120; // some context
    scrollRef.current.scrollTop = Math.max(0, offsetPx);
  }, [weekAnchor]);

  const axisTotalMinutes = (AXIS_END_HOUR - AXIS_START_HOUR) * 60;
  const axisHeightPx = axisTotalMinutes * PX_PER_MINUTE;

  const handleClick = (id: string) => {
    if (onEventClick) onEventClick(id);
    else navigate(`/app/events/${id}`);
  };

  return (
    <div className="mt-2">
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
        <div className="min-w-[720px]">
          <div className="flex border-b border-white/10">
            <div className="w-16 shrink-0 px-2 py-2 text-xs text-white/50" />
            {weekDays.map((d) => {
              const key = toLocalDayKey(d);
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  className={`flex-1 px-2 py-2 text-center text-xs border-l border-white/10 ${
                    isToday ? 'bg-yellow-400/10' : 'bg-transparent'
                  }`}
                >
                  <div className="font-semibold text-white/80">
                    {d.toLocaleDateString('de-AT', { weekday: 'short' })}
                  </div>
                  <div className="text-[11px] text-white/60">{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          <div className="flex">
            <div className="relative w-16 shrink-0 border-r border-white/10">
              <div className="relative" style={{ height: axisHeightPx }}>
                {Array.from({ length: AXIS_END_HOUR - AXIS_START_HOUR + 1 }, (_, i) => {
                  const hour = AXIS_START_HOUR + i;
                  const top = (hour - AXIS_START_HOUR) * 60 * PX_PER_MINUTE;
                  return (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 -top-2 px-1 text-[11px] text-white/50 text-right"
                      style={{ top }}
                    >
                      {String(hour).padStart(2, '0')}:00
                    </div>
                  );
                })}
              </div>
            </div>

            <div ref={scrollRef} className="overflow-y-auto w-full">
              <div className="relative" style={{ height: axisHeightPx }}>
                {/* Render columns with relative positioning for absolute blocks */}
                <div className="relative w-full h-full grid grid-cols-7">
                  {weekDays.map((day, idx) => {
                    const key = toLocalDayKey(day);
                    const isToday = key === todayKey;
                    const dayEvents = eventsByDayKey.get(key) ?? [];
                    return (
                      <div
                        key={key}
                        className={`relative border-l border-white/10 ${idx === 0 ? 'border-l-0' : ''} ${
                          isToday ? 'bg-yellow-400/5' : ''
                        }`}
                      >
                        {dayEvents.map((ev) => {
                          const start = new Date(ev.starts_at);
                          const endIso =
                            ev.end_at ??
                            resolveEndAtFromNotes({
                              startsAtIso: ev.starts_at,
                              eventType: ev.event_type,
                              notes: null,
                            });
                          const end = endIso ? new Date(endIso) : new Date(start.getTime() + 90 * 60 * 1000);

                          const startMinutes = start.getHours() * 60 + start.getMinutes();
                          const endMinutes = end.getHours() * 60 + end.getMinutes();

                          const axisStartMinutes = AXIS_START_HOUR * 60;
                          const axisEndMinutes = AXIS_END_HOUR * 60;

                          const clampedStart = Math.min(Math.max(startMinutes, axisStartMinutes), axisEndMinutes - 1);
                          const clampedEnd = Math.min(Math.max(endMinutes, axisStartMinutes + 1), axisEndMinutes);

                          const top = (clampedStart - axisStartMinutes) * PX_PER_MINUTE;
                          const height = Math.max(18, (clampedEnd - clampedStart) * PX_PER_MINUTE);

                          const timeText = `${formatTime(start)} - ${formatTime(end)}`;

                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => handleClick(ev.id)}
                              className={`absolute left-2 right-2 rounded-lg px-2 py-1 border border-white/15 text-left shadow-sm ${getEventColorClass(
                                ev.event_type,
                              )}`}
                              style={{ top, height }}
                            >
                              <div className="text-[11px] font-semibold tabular-nums leading-tight">
                                {timeText}
                              </div>
                              <div className="mt-0.5 text-[11px] font-semibold truncate leading-tight">
                                {ev.title}
                              </div>
                              {ev.team_name ? (
                                <div className="mt-0.5 text-[9px] text-white/80 truncate">{ev.team_name}</div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

