import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { lockBodyScroll } from '../../lib/bodyScrollLock';
import type { CalendarEvent } from './calendarTypes';
import {
  formatDaySheetHeader,
  getDaySheetCategoryLabel,
  getDaySheetEventLines,
  getDaySheetEventTitle,
  getMonthEventDotClass,
  inferMonthEventChipCategory,
} from './calendarUtils';

type Props = {
  isOpen: boolean;
  dayDate: Date | null;
  events: CalendarEvent[];
  onClose: () => void;
};

function DayEventCard({ ev }: { ev: CalendarEvent }) {
  const navigate = useNavigate();
  const category = inferMonthEventChipCategory(ev);
  const cancelled = category === 'cancelled';
  const label = getDaySheetCategoryLabel(category, ev);
  const title = getDaySheetEventTitle(ev);
  const lines = getDaySheetEventLines(ev, category);
  const dotClass = getMonthEventDotClass(category);
  const actionLabel =
    ev.type === 'game' && !cancelled
      ? 'Zum Spiel'
      : ev.type === 'tournament'
        ? 'Turnier öffnen'
        : 'Details';

  return (
    <div
      className={[
        'overflow-hidden rounded-xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[2px]',
        cancelled
          ? 'border-zinc-500/25 bg-zinc-800/45 opacity-80'
          : 'border-white/10 bg-black/35',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <span
          className={`text-[11px] font-bold uppercase tracking-wide ${
            cancelled ? 'text-white/50 line-through' : 'text-white/88'
          }`}
        >
          {label}
        </span>
      </div>

      <p
        className={`mt-2 text-sm font-semibold leading-snug ${
          cancelled ? 'text-white/55 line-through decoration-white/35' : 'text-white'
        }`}
      >
        {title}
      </p>

      {lines.length > 0 ? (
        <div className="mt-2 space-y-0.5">
          {lines.map((line) => (
            <p
              key={line}
              className={`text-[12px] leading-snug ${
                cancelled ? 'text-white/45 line-through decoration-white/30' : 'text-white/72'
              }`}
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {!cancelled ? (
        <button
          type="button"
          onClick={() => navigate(`/app/events/${ev.id}`)}
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-red-500/30 bg-red-600/85 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-600"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export const CalendarDayDetailSheet: React.FC<Props> = ({ isOpen, dayDate, events, onClose }) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isOpen) return;
    return lockBodyScroll();
  }, [isOpen]);

  if (!isOpen || !dayDate) return null;

  const header = formatDaySheetHeader(dayDate);
  const sorted = [...events].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );

  return (
    <div
      className="modalOverlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="modalSheet max-h-[75vh] border-red-500/15 shadow-[0_0_32px_rgba(220,38,38,0.1)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-day-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div id="calendar-day-sheet-title" className="modalTitle text-white">
            {header}
          </div>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>

        <div className="modalBody space-y-2.5">
          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/55">Keine Termine</p>
          ) : (
            sorted.map((ev) => <DayEventCard key={ev.id} ev={ev} />)
          )}
        </div>
      </div>
    </div>
  );
};
