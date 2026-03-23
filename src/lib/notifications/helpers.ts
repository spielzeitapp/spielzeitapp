import type { NotificationRuntimeConfig } from './config';
import type { RawEventRow } from './eventTypes';
import { getCanonicalEventType, getParticipationMode } from './eventTypes';

function isWithinReminderWindow(now: Date, start: Date, hoursBefore: number): boolean {
  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return false;
  return diffMs <= hoursBefore * 60 * 60 * 1000;
}

export function isTrainingReminderDue(
  event: RawEventRow,
  now: Date,
  cfg: NotificationRuntimeConfig,
): boolean {
  if (getCanonicalEventType(event) !== 'training') return false;
  if (getParticipationMode(event) !== 'opt_in') return false;
  if ((event.status ?? 'upcoming').toLowerCase() !== 'upcoming') return false;

  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) return false;
  return isWithinReminderWindow(now, start, cfg.trainingReminderHoursBefore);
}

/**
 * Spiel: 24h vorher oder optional 2h vorher, opt-in.
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
  return (
    isWithinReminderWindow(now, start, cfg.eventReminderHoursBefore) ||
    isWithinReminderWindow(now, start, cfg.gameSecondReminderHoursBefore)
  );
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
