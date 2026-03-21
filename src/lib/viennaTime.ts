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

function zonedTimeToUtcMillis(parts: Omit<DateTimeParts, 'hour' | 'minute'> & { hour: number; minute: number }, timeZone: string) {
  const desiredUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);

  // Interpret desired local time as UTC, then iteratively correct using the real zone offset.
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

  const cutoffUtcMillis = zonedTimeToUtcMillis(
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

