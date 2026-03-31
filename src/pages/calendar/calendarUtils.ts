import type { CalendarEvent, CalendarEventType } from './calendarTypes';
import {
  getDateTimePartsInTimeZone,
  toViennaDayKeyFromDate,
  toViennaDayKeyFromUtcIso,
  VIENNA_TZ,
  zonedWallTimeToUtcMillis,
} from '../../lib/viennaTime';

/** Gruppierung nach Kalendertag in Europe/Vienna (`Date`-Instant oder UTC-ISO). */
export function toViennaDayKey(input: Date | string): string {
  return typeof input === 'string' ? toViennaDayKeyFromUtcIso(input) : toViennaDayKeyFromDate(input);
}

/** @deprecated Verwende `toViennaDayKey` – gleiche Semantik wie bisheriger Name. */
export const toLocalDayKey = toViennaDayKey;

export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7; // Monday -> 0
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function parseEndTimeFromNotes(notes: string | null | undefined): { hh: number; mm: number } | null {
  if (!notes) return null;
  const m = notes.match(/ende:\s*(\d{1,2}):(\d{2})\s*uhr/i);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return { hh, mm };
}

export function resolveEndAtFromNotes(args: {
  startsAtIso: string;
  eventType: CalendarEventType;
  notes: string | null;
}): string | null {
  const start = new Date(args.startsAtIso);
  if (!start || isNaN(start.getTime())) return null;

  const parsed = parseEndTimeFromNotes(args.notes);
  if (parsed) {
    const startParts = getDateTimePartsInTimeZone(start, VIENNA_TZ);
    if (!startParts) return null;
    const ms = zonedWallTimeToUtcMillis(
      {
        year: startParts.year,
        month: startParts.month,
        day: startParts.day,
        hour: parsed.hh,
        minute: parsed.mm,
      },
      VIENNA_TZ,
    );
    return new Date(ms).toISOString();
  }

  const addMin = args.eventType === 'event' ? 60 : 90;
  const end = new Date(start.getTime() + addMin * 60 * 1000);
  return end.toISOString();
}

export function getEventTypeLabel(type: CalendarEvent['type']): string {
  if (type === 'game') return 'Spiel';
  if (type === 'training') return 'Training';
  if (type === 'event') return 'Event';
  return 'Termin';
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (!d || isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTimeRange(startIso: string, endIso?: string | null): string {
  const start = formatTime(startIso);
  const end = endIso ? formatTime(endIso) : '';
  if (!start) return '';
  if (!end) return start;
  return `${start} - ${end}`;
}

export function formatTrainingTimeRange(startIso: string, endIso?: string | null): string {
  const start = formatTime(startIso);
  const end = endIso ? formatTime(endIso) : '';
  if (!start) return '';
  if (!end) return `Beginn ${start}`;
  return `Beginn ${start} - Ende ${end}`;
}

export function formatMeetingPoint(meetupAt?: string | null): string | null {
  if (!meetupAt) return null;
  const t = formatTime(meetupAt);
  return t ? `Treffpunkt ${t}` : null;
}

export function notesTitleAndDescription(notes: string | null | undefined): {
  title: string | null;
  description: string | null;
} {
  const parts = (notes ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
  const title = parts[0] ?? null;
  const description = parts
    .slice(1)
    .filter((p) => !p.toLowerCase().startsWith('ende:'))
    .join(' · ')
    .trim();
  return { title, description: description || null };
}

