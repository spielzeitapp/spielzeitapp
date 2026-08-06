/**
 * Relative Demo-Zeitstempel — immer konsistent zu „jetzt“ (Europe/Vienna).
 */

import { getDateTimePartsInTimeZone, VIENNA_TZ, zonedWallTimeToUtcMillis } from '../lib/viennaTime';

/** Wanduhrzeit in Wien, relativ zu heutigem Kalendertag (+/− Tage). */
export function demoOffsetIso(dayOffset: number, hour: number, minute = 0): string {
  const nowParts = getDateTimePartsInTimeZone(new Date(), VIENNA_TZ);
  if (!nowParts) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }
  const probe = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day + dayOffset, 12, 0, 0));
  const ymd = getDateTimePartsInTimeZone(probe, VIENNA_TZ) ?? nowParts;
  const ms = zonedWallTimeToUtcMillis(
    { year: ymd.year, month: ymd.month, day: ymd.day, hour, minute },
    VIENNA_TZ,
  );
  return new Date(ms).toISOString();
}

/** Minuten relativ zu jetzt (für Live-Anpfiff). */
export function demoMinutesFromNowIso(minuteOffset: number): string {
  return new Date(Date.now() + minuteOffset * 60_000).toISOString();
}
