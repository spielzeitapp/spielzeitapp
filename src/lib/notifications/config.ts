/**
 * Konfiguration Reminder (MVP). Optional per Env überschreibbar.
 */
export type NotificationRuntimeConfig = {
  /** Training: Stunden vor Start (MVP: 2h) */
  trainingReminderHoursBefore: number;
  /** Spiel/Event: Stunden vor Start (MVP: 24h) */
  eventReminderHoursBefore: number;
  /** Spiel: optional zusätzlicher Reminder kurz vor Start (MVP: 2h) */
  gameSecondReminderHoursBefore: number;
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
    trainingReminderHoursBefore: envInt('NOTIFICATION_TRAINING_REMINDER_HOURS_BEFORE', 2),
    eventReminderHoursBefore: envInt('NOTIFICATION_EVENT_REMINDER_HOURS_BEFORE', 24),
    gameSecondReminderHoursBefore: envInt('NOTIFICATION_GAME_SECOND_REMINDER_HOURS_BEFORE', 2),
    timeZone: 'Europe/Vienna',
  };
}
