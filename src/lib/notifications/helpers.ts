import { isSameViennaCalendarDay, isViennaLocalTimeInRange } from '../viennaTime';
import type { NotificationRuntimeConfig } from './config';
import type { RawEventRow } from './eventTypes';
import { getCanonicalEventType, getParticipationMode } from './eventTypes';

/**
 * Training: gleicher Kalendertag wie Start, opt-out, Frist nicht deaktiviert,
 * Reminder-Fenster [11:00, 12:00) Wien (konfigurierbar).
 */
export function isTrainingReminderDue(
  event: RawEventRow,
  now: Date,
  cfg: NotificationRuntimeConfig,
): boolean {
  if (getCanonicalEventType(event) !== 'training') return false;
  if (getParticipationMode(event) !== 'opt_out') return false;
  if (event.training_absence_deadline_disabled === true) return false;
  if ((event.status ?? 'upcoming').toLowerCase() !== 'upcoming') return false;

  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) return false;

  if (!isSameViennaCalendarDay(start, now)) return false;

  return isViennaLocalTimeInRange(
    now,
    cfg.trainingReminderHour,
    cfg.trainingReminderMinute,
    cfg.trainingReminderWindowEndHour,
    cfg.trainingReminderWindowEndMinute,
  );
}

/**
 * Spiel: innerhalb der nächsten N Tage, opt-in, noch nicht vorbei.
 */
export function isGameReminderDue(
  event: RawEventRow,
  now: Date,
  cfg: NotificationRuntimeConfig,
): boolean {
  if (getCanonicalEventType(event) !== 'game') return false;
  if (getParticipationMode(event) !== 'opt_in') return false;
  if ((event.status ?? 'upcoming').toLowerCase() !== 'upcoming') return false;

  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) return false;
  if (start.getTime() <= now.getTime()) return false;

  const horizonMs = cfg.gameReminderDaysBefore * 24 * 60 * 60 * 1000;
  return start.getTime() <= now.getTime() + horizonMs;
}

/** Alle Kinder dieser User-Ansicht haben explizit "Abgesagt" (Training opt-out). */
export function hasAllChildrenDeclinedTraining(
  rosterPlayerIds: string[],
  attendanceByPlayerId: Map<string, string>,
): boolean {
  if (rosterPlayerIds.length === 0) return false;
  return rosterPlayerIds.every((pid) => attendanceByPlayerId.get(pid) === 'no');
}

/**
 * Spiel opt-in: jedes Kind hat eine definitive Zu-/Absage (ja/nein).
 * "maybe" zählt als noch offen → Reminder.
 */
export function hasAllChildrenAnsweredGameOptIn(
  rosterPlayerIds: string[],
  attendanceByPlayerId: Map<string, string>,
): boolean {
  if (rosterPlayerIds.length === 0) return true;
  return rosterPlayerIds.every((pid) => {
    const s = attendanceByPlayerId.get(pid);
    return s === 'yes' || s === 'no';
  });
}

/**
 * MVP-Hilfsfunktion: Soll für diesen User kein Training-Reminder mehr kommen?
 * = alle zugeordneten Kinder haben abgesagt.
 */
export function shouldSendTrainingReminderForPlayers(
  rosterPlayerIds: string[],
  attendanceByPlayerId: Map<string, string>,
): boolean {
  return !hasAllChildrenDeclinedTraining(rosterPlayerIds, attendanceByPlayerId);
}

/**
 * Soll Game-Reminder gesendet werden? = noch nicht alle Kinder mit ja/nein beantwortet.
 */
export function shouldSendGameReminderForPlayers(
  rosterPlayerIds: string[],
  attendanceByPlayerId: Map<string, string>,
): boolean {
  return !hasAllChildrenAnsweredGameOptIn(rosterPlayerIds, attendanceByPlayerId);
}
