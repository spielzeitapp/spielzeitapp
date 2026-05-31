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

export type MonthEventChipCategory =
  | 'game'
  | 'training'
  | 'event'
  | 'tournament'
  | 'birthday'
  | 'holiday'
  | 'cancelled';

/** Monats-Chip-Kategorie aus bestehenden Event-Feldern ableiten (ohne DB-Änderung). */
export function inferMonthEventChipCategory(ev: CalendarEvent): MonthEventChipCategory {
  const hay = [ev.title, ev.notes, ev.description, ev.opponent]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(abgesagt|absage|cancelled|canceled|annuliert)/.test(hay)) return 'cancelled';
  if (/(geburtstag|birthday)/.test(hay)) return 'birthday';
  if (/(ferien|feiertag|holiday|weihnacht|ostern|pfingst|brückentag)/.test(hay)) return 'holiday';
  if (/(turnier|tournament|pokal)/.test(hay)) return 'tournament';
  if (ev.type === 'game') return 'game';
  if (ev.type === 'training') return 'training';
  return 'event';
}

export function getMonthEventChipClasses(category: MonthEventChipCategory): string {
  switch (category) {
    case 'game':
      return 'border border-red-500/35 bg-red-600/85 text-white';
    case 'training':
      return 'border border-emerald-500/35 bg-emerald-700/80 text-white';
    case 'tournament':
      return 'border border-purple-500/35 bg-purple-700/78 text-white';
    case 'birthday':
      return 'border border-orange-500/35 bg-orange-600/82 text-white';
    case 'holiday':
      return 'border border-teal-400/35 bg-teal-600/78 text-white';
    case 'cancelled':
      return 'border border-zinc-500/30 bg-zinc-600/72 text-white/75 line-through decoration-white/40';
    case 'event':
    default:
      return 'border border-blue-500/35 bg-blue-700/78 text-white';
  }
}

export function formatMonthChipTime(ev: CalendarEvent): string {
  return formatTime(ev.starts_at);
}

export const MONTH_LEGEND_ITEMS: { label: string; dotClass: string }[] = [
  { label: 'Spiel', dotClass: 'bg-red-600' },
  { label: 'Training', dotClass: 'bg-emerald-600' },
  { label: 'Event', dotClass: 'bg-blue-600' },
  { label: 'Turnier', dotClass: 'bg-purple-600' },
  { label: 'Geburtstag', dotClass: 'bg-orange-500' },
  { label: 'Ferien/Feiertag', dotClass: 'bg-teal-500' },
  { label: 'Abgesagt', dotClass: 'bg-zinc-500' },
];

export function formatMonthNavLabel(date: Date): string {
  const raw = date.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatNextMatchWeekdayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const formatted = new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  }).format(d);
  const commaIdx = formatted.indexOf(',');
  if (commaIdx === -1) return formatted;
  const weekday = formatted.slice(0, commaIdx).trim();
  const rest = formatted.slice(commaIdx + 1).trim();
  const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capWeekday}, ${rest}`;
}

/** Nächstes zukünftiges Liga-/Meisterschaftsspiel im geladenen Zeitraum. */
export function findNextUpcomingMatch(
  events: CalendarEvent[],
  now: Date = new Date(),
): CalendarEvent | null {
  const nowMs = now.getTime();
  const candidates = events
    .filter((ev) => {
      if (ev.type !== 'game') return false;
      if (inferMonthEventChipCategory(ev) === 'cancelled') return false;
      if (inferMonthEventChipCategory(ev) === 'tournament') return false;
      const startMs = new Date(ev.starts_at).getTime();
      return Number.isFinite(startMs) && startMs >= nowMs;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return candidates[0] ?? null;
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

