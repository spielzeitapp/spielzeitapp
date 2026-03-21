/**
 * Konfiguration Reminder (MVP). Optional per Env überschreibbar.
 */
export type NotificationRuntimeConfig = {
  /** Training: Reminder-Fenster Start (Stunde Wien) */
  trainingReminderHour: number;
  trainingReminderMinute: number;
  /** Training: Ende Reminder-Fenster / gleich Absagefrist-Stunde (12:00) */
  trainingReminderWindowEndHour: number;
  trainingReminderWindowEndMinute: number;
  /** Spiele: wie viele Tage vor Termin erinnern */
  gameReminderDaysBefore: number;
  timeZone: string;
};

function readEnv(key: string): string | undefined {
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.[key];
}

function envInt(name: string, fallback: number): number {
  const v = readEnv(name);
  if (v == null || v === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function getNotificationConfig(): NotificationRuntimeConfig {
  return {
    trainingReminderHour: envInt('NOTIFICATION_TRAINING_REMINDER_HOUR', 11),
    trainingReminderMinute: envInt('NOTIFICATION_TRAINING_REMINDER_MINUTE', 0),
    trainingReminderWindowEndHour: envInt('NOTIFICATION_TRAINING_WINDOW_END_HOUR', 12),
    trainingReminderWindowEndMinute: envInt('NOTIFICATION_TRAINING_WINDOW_END_MINUTE', 0),
    gameReminderDaysBefore: envInt('NOTIFICATION_GAME_REMINDER_DAYS', 7),
    timeZone: 'Europe/Vienna',
  };
}
