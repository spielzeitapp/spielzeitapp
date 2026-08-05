import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CalendarEvent } from './calendarTypes';
import {
  addDays,
  formatMeetingPoint,
  formatTimeRange,
  formatTrainingTimeRange,
  formatWeekRangeLabel,
  startOfWeekMonday,
  toViennaDayKey,
} from './calendarUtils';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from '../../lib/viennaTime';
import { CalendarDayAgenda } from './CalendarDayAgenda';
import { CalendarDayStrip } from './CalendarDayStrip';
import { CalendarPeriodNav } from './CalendarPeriodNav';

type Props = {
  weekAnchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToday: () => void;
  todayKey: string;
  showTeamName?: boolean;
  getEventColorClass: (type: CalendarEvent['type']) => string;
  onEventClick?: (eventId: string) => void;
};

const AXIS_START_HOUR = 8;
const AXIS_END_HOUR = 20;
const PX_PER_MINUTE = 2;

function DesktopWeekTimeGrid({
  weekDays,
  eventsByDay,
  todayKey,
  getEventColorClass,
  onEventClick,
}: {
  weekDays: Date[];
  eventsByDay: Map<string, CalendarEvent[]>;
  todayKey: string;
  getEventColorClass: (type: CalendarEvent['type']) => string;
  onEventClick?: (eventId: string) => void;
}) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const nowParts = getDateTimePartsInTimeZone(now, VIENNA_TZ);
    const minutes = nowParts ? nowParts.hour * 60 + nowParts.minute : now.getHours() * 60 + now.getMinutes();
    const axisStart = AXIS_START_HOUR * 60;
    const axisEnd = AXIS_END_HOUR * 60;
    if (minutes < axisStart || minutes > axisEnd) return;
    const offsetPx = (minutes - axisStart) * PX_PER_MINUTE - 120;
    scrollRef.current.scrollTop = Math.max(0, offsetPx);
  }, [weekDays]);

  const axisTotalMinutes = (AXIS_END_HOUR - AXIS_START_HOUR) * 60;
  const axisHeightPx = axisTotalMinutes * PX_PER_MINUTE;

  const handleClick = (id: string) => {
    if (onEventClick) onEventClick(id);
    else navigate(`/app/events/${id}`);
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
      <div className="min-w-[720px]">
        <div className="flex border-b border-white/10">
          <div className="w-16 shrink-0 px-2 py-2 text-xs text-white/50" />
          {weekDays.map((d) => {
            const key = toViennaDayKey(d);
            const isToday = key === todayKey;
            const dp = getDateTimePartsInTimeZone(d, VIENNA_TZ);
            return (
              <div
                key={key}
                className={`flex-1 border-l border-white/10 px-2 py-2 text-center text-xs ${
                  isToday ? 'bg-yellow-400/10' : 'bg-transparent'
                }`}
              >
                <div className="font-semibold text-white/80">
                  {new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, weekday: 'short' }).format(d)}
                </div>
                <div className="text-[11px] text-white/60">{dp ? dp.day : d.getDate()}</div>
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
                    className="absolute left-0 right-0 -top-2 px-1 text-right text-[11px] text-white/50"
                    style={{ top }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                );
              })}
            </div>
          </div>

          <div ref={scrollRef} className="w-full overflow-y-auto">
            <div className="relative" style={{ height: axisHeightPx }}>
              <div className="relative grid h-full w-full grid-cols-7">
                {weekDays.map((day, idx) => {
                  const key = toViennaDayKey(day);
                  const isToday = key === todayKey;
                  const dayEvents = eventsByDay.get(key) ?? [];
                  return (
                    <div
                      key={key}
                      className={`relative border-l border-white/10 ${idx === 0 ? 'border-l-0' : ''} ${
                        isToday ? 'bg-yellow-400/5' : ''
                      }`}
                    >
                      {dayEvents.map((ev) => {
                        const start = new Date(ev.starts_at);
                        const end = ev.end_at ? new Date(ev.end_at) : new Date(start.getTime() + 90 * 60 * 1000);
                        const sp = getDateTimePartsInTimeZone(start, VIENNA_TZ);
                        const ep = getDateTimePartsInTimeZone(end, VIENNA_TZ);
                        const startMinutes = sp
                          ? sp.hour * 60 + sp.minute
                          : start.getHours() * 60 + start.getMinutes();
                        const endMinutes = ep
                          ? ep.hour * 60 + ep.minute
                          : end.getHours() * 60 + end.getMinutes();
                        const axisStartMinutes = AXIS_START_HOUR * 60;
                        const axisEndMinutes = AXIS_END_HOUR * 60;
                        const clampedStart = Math.min(
                          Math.max(startMinutes, axisStartMinutes),
                          axisEndMinutes - 1,
                        );
                        const clampedEnd = Math.min(
                          Math.max(endMinutes, axisStartMinutes + 1),
                          axisEndMinutes,
                        );
                        const top = (clampedStart - axisStartMinutes) * PX_PER_MINUTE;
                        const height = Math.max(18, (clampedEnd - clampedStart) * PX_PER_MINUTE);
                        const timeText =
                          ev.type === 'training'
                            ? formatTrainingTimeRange(ev.starts_at, ev.end_at)
                            : formatTimeRange(ev.starts_at, ev.end_at);
                        const venue = (ev.venue_short ?? '').trim() || null;
                        const meetingPointLine = formatMeetingPoint(ev.meeting_at);

                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => handleClick(ev.id)}
                            className={`absolute left-2 right-2 rounded-lg border border-white/15 px-2 py-1 text-left shadow-sm ${getEventColorClass(
                              ev.type,
                            )}`}
                            style={{ top, height }}
                          >
                            <div className="text-[11px] font-semibold tabular-nums leading-tight">
                              {timeText}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] font-semibold leading-tight">
                              {ev.title}
                            </div>
                            {venue ? (
                              <div className="mt-0.5 truncate text-[9px] text-white/80">{venue}</div>
                            ) : null}
                            {meetingPointLine ? (
                              <div className="mt-0.5 truncate text-[9px] text-yellow-200/90">
                                {meetingPointLine}
                              </div>
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
  );
}

export const CalendarWeekView: React.FC<Props> = ({
  weekAnchor,
  eventsByDay,
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onGoToday,
  todayKey,
  showTeamName = false,
  getEventColorClass,
  onEventClick,
}) => {
  const weekStart = useMemo(() => startOfWeekMonday(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekStart, weekEnd), [weekStart, weekEnd]);
  const isTodaySelected = toViennaDayKey(selectedDate) === todayKey;

  return (
    <div className="space-y-3 overflow-x-hidden">
      <div className="md:hidden">
        <CalendarPeriodNav
          label={weekLabel}
          onPrev={onPrevWeek}
          onNext={onNextWeek}
          onGoToday={onGoToday}
          showTodayButton={!isTodaySelected}
          prevLabel="Vorherige Woche"
          nextLabel="Nächste Woche"
        />

        <div className="mt-3">
          <CalendarDayStrip
            days={weekDays}
            selectedDate={selectedDate}
            eventsByDay={eventsByDay}
            onSelectDate={onSelectDate}
            layout="fixed-7"
          />
        </div>

        <div className="mt-3">
          <CalendarDayAgenda
            selectedDate={selectedDate}
            eventsByDay={eventsByDay}
            showTeamName={showTeamName}
            emptyMessage="Keine Termine geplant"
            onEventClick={onEventClick}
          />
        </div>
      </div>

      <div className="hidden md:block">
        <DesktopWeekTimeGrid
          weekDays={weekDays}
          eventsByDay={eventsByDay}
          todayKey={todayKey}
          getEventColorClass={getEventColorClass}
          onEventClick={onEventClick}
        />
      </div>
    </div>
  );
};
