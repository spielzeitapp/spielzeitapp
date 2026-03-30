/** Österreichische lokale Zeit für Fristen (Trainings-Absage 12:00, Reminder 11:00). */
export const VIENNA_TZ = 'Europe/Vienna';

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function getDateTimePartsInTimeZone(date: Date, timeZone: string): DateTimeParts | null {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = fmt.formatToParts(date);
  const get = (type: string) => {
    const v = parts.find((p) => p.type === type)?.value;
    if (!v) return null;
    return Number(v);
  };

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');

  if ([year, month, day, hour, minute].some((v) => v == null || !Number.isFinite(v))) return null;
  return { year: year!, month: month!, day: day!, hour: hour!, minute: minute! };
}

/** Kalender-Uhrzeit in `timeZone` → UTC-Millisekunden (DST-fähig). */
export function zonedWallTimeToUtcMillis(
  parts: Omit<DateTimeParts, 'hour' | 'minute'> & { hour: number; minute: number },
  timeZone: string,
): number {
  const desiredUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);

  let utcMillis = desiredUtc;
  for (let i = 0; i < 3; i++) {
    const zoneParts = getDateTimePartsInTimeZone(new Date(utcMillis), timeZone);
    if (!zoneParts) break;

    const asUtc = Date.UTC(zoneParts.year, zoneParts.month - 1, zoneParts.day, zoneParts.hour, zoneParts.minute, 0, 0);
    const diff = asUtc - desiredUtc;
    if (diff === 0) break;
    utcMillis -= diff;
  }

  return utcMillis;
}

export function getViennaCutoffDate(startsAtIso: string, cutoffHour = 12, cutoffMinute = 0): Date | null {
  const start = new Date(startsAtIso);
  if (!start || isNaN(start.getTime())) return null;

  const ymd = getDateTimePartsInTimeZone(start, VIENNA_TZ);
  if (!ymd) return null;

  const cutoffUtcMillis = zonedWallTimeToUtcMillis(
    {
      year: ymd.year,
      month: ymd.month,
      day: ymd.day,
      hour: cutoffHour,
      minute: cutoffMinute,
    },
    VIENNA_TZ,
  );
  return new Date(cutoffUtcMillis);
}

export function isViennaCutoffPassed(startsAtIso: string, now: Date = new Date(), cutoffHour = 12, cutoffMinute = 0): boolean {
  const cutoff = getViennaCutoffDate(startsAtIso, cutoffHour, cutoffMinute);
  if (!cutoff) return false;
  return now.getTime() > cutoff.getTime();
}

export function isViennaCutoffSoon(startsAtIso: string, now: Date = new Date(), cutoffHour = 12, cutoffMinute = 0): boolean {
  const cutoff = getViennaCutoffDate(startsAtIso, cutoffHour, cutoffMinute);
  if (!cutoff) return false;
  const diffMs = cutoff.getTime() - now.getTime();
  return diffMs <= 30 * 60 * 1000 && diffMs >= 0;
}

/** Gleicher Kalendertag in Europe/Vienna. */
export function isSameViennaCalendarDay(a: Date, b: Date): boolean {
  const pa = getDateTimePartsInTimeZone(a, VIENNA_TZ);
  const pb = getDateTimePartsInTimeZone(b, VIENNA_TZ);
  if (!pa || !pb) return false;
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

/**
 * Liegt `now` in Wien im Halboffenen Intervall [start, end) (lokale Uhrzeit)?
 * Beispiel: Reminder-Fenster Training 11:00–12:00 → start 11:0, end 12:0.
 */
export function isViennaLocalTimeInRange(
  now: Date,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): boolean {
  const p = getDateTimePartsInTimeZone(now, VIENNA_TZ);
  if (!p) return false;
  const minutes = p.hour * 60 + p.minute;
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return minutes >= start && minutes < end;
}

const DT_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const TIME_HM_RE = /^(\d{1,2}):(\d{2})$/;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * `datetime-local`-Wert (ohne Zeitzone) als **Europe/Vienna** interpretieren → UTC-ISO für DB.
 */
export function parseViennaDateTimeLocalToUtcIso(datetimeLocal: string): string | null {
  const m = DT_LOCAL_RE.exec(datetimeLocal.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  if (![y, mo, d, h, mi].every((v) => Number.isFinite(v))) return null;
  const ms = zonedWallTimeToUtcMillis({ year: y, month: mo, day: d, hour: h, minute: mi }, VIENNA_TZ);
  return new Date(ms).toISOString();
}

/** UTC-ISO aus DB → `YYYY-MM-DDTHH:mm` für `datetime-local` (immer Vienna-Wandzeit). */
export function utcIsoToViennaDateTimeLocal(iso: string): string {
  if (!iso || !String(iso).trim()) return '';
  const parts = getDateTimePartsInTimeZone(new Date(iso), VIENNA_TZ);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** UTC-ISO → `HH:mm` (Vienna) für Treffpunkt-Zeitfeld. */
export function utcIsoToViennaTimeHHmm(iso: string): string {
  if (!iso || !String(iso).trim()) return '';
  const parts = getDateTimePartsInTimeZone(new Date(iso), VIENNA_TZ);
  if (!parts) return '';
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/**
 * Treffpunkt-Uhrzeit (HH:mm) am **gleichen Kalendertag in Vienna** wie `startUtcIso`.
 */
export function meetupUtcIsoOnViennaEventDay(startUtcIso: string, timeHHmm: string): string | null {
  const tm = TIME_HM_RE.exec(timeHHmm.trim());
  if (!tm) return null;
  const h = Number(tm[1]);
  const mi = Number(tm[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  const dayParts = getDateTimePartsInTimeZone(new Date(startUtcIso), VIENNA_TZ);
  if (!dayParts) return null;
  const ms = zonedWallTimeToUtcMillis(
    { year: dayParts.year, month: dayParts.month, day: dayParts.day, hour: h, minute: mi },
    VIENNA_TZ,
  );
  return new Date(ms).toISOString();
}

/** `YYYY-MM-DD` (Datum aus date-Input) als letzter Moment dieses **Vienna**-Kalendertags (UTC-ISO). */
export function viennaDateOnlyEndOfDayUtcIso(ymd: string): string | null {
  const m = YMD_RE.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (![y, mo, d].every((v) => Number.isFinite(v))) return null;
  const rolled = new Date(Date.UTC(y, mo - 1, d + 1, 12, 0, 0));
  const ny = rolled.getUTCFullYear();
  const nm = rolled.getUTCMonth() + 1;
  const nd = rolled.getUTCDate();
  const nextMidnight = zonedWallTimeToUtcMillis({ year: ny, month: nm, day: nd, hour: 0, minute: 0 }, VIENNA_TZ);
  return new Date(nextMidnight - 1).toISOString();
}

/** +N Kalendertage (gregorianisch, gleiche Vienna-Uhrzeit wie im Ausgangs-Instant). */
export function addViennaCalendarDaysToUtcIso(startUtcIso: string, deltaDays: number): string {
  const parts = getDateTimePartsInTimeZone(new Date(startUtcIso), VIENNA_TZ);
  if (!parts) return startUtcIso;
  const rolled = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + deltaDays, 12, 0, 0));
  const ny = rolled.getUTCFullYear();
  const nm = rolled.getUTCMonth() + 1;
  const nd = rolled.getUTCDate();
  const ms = zonedWallTimeToUtcMillis(
    { year: ny, month: nm, day: nd, hour: parts.hour, minute: parts.minute },
    VIENNA_TZ,
  );
  return new Date(ms).toISOString();
}

/** Gruppierungsschlüssel YYYY-MM-DD (Europe/Vienna) für ein UTC-ISO-Event. */
export function toViennaDayKeyFromUtcIso(iso: string): string {
  const parts = getDateTimePartsInTimeZone(new Date(iso), VIENNA_TZ);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** Vienna-Kalendertag für einen beliebigen `Date`-Instant (z. B. Rasterzelle). */
export function toViennaDayKeyFromDate(d: Date): string {
  const parts = getDateTimePartsInTimeZone(d, VIENNA_TZ);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

