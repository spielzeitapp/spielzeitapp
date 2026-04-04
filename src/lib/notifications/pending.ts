import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Empfänger-UUIDs vor dem Versand deduplizieren (stabile Reihenfolge: erstes Vorkommen).
 * Mehrere Membership-Zeilen oder Join-Pfade dürfen nicht zu doppelten Benachrichtigungen führen.
 */
export function dedupeRecipientUserIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Log/Debug: stabiler Fingerabdruck pro Job + Empfänger (entspricht DB-Unique source_notification_job_id + user_id). */
export function reminderNotificationDedupeFingerprint(jobId: string, userId: string): string {
  return `job:${jobId}:user:${userId}`;
}

export type NotificationKind =
  | 'training_reminder'
  | 'game_reminder'
  | 'game_second_reminder'
  | 'event_reminder';

export type PendingNotificationItem = {
  userId: string;
  eventId: string;
  teamId: string;
  notificationType: NotificationKind;
  /** z. B. training_120, match_1440, match_second_120, event_1440 */
  reminderKey: string;
  title: string;
  body: string;
  /** Kurz-Titel fürs Push-Body */
  eventTitleShort: string;
  /** Push-Textzeile (ohne App-Titel) */
  pushBody: string;
  /** Relativer Pfad unter App-Origin */
  url: string;
  /** optional: Klassifikation (Anzeige); Persistenz über `notifications.event_type` */
  terminReminderKind?: 'match' | 'training' | 'event';
};

/**
 * Früher: Cron `/api/notifications/dispatch` ermittelte fällige Reminder per Abfrage und
 * legte In-App-Zeilen an — parallel zu `public.notification_jobs` → doppelte Einträge.
 *
 * Zeitbasierte Erinnerungen laufen nur noch über `notification_jobs` (DB-Trigger + Worker).
 */
export async function getPendingNotifications(
  _admin: SupabaseClient,
  _now: Date = new Date(),
): Promise<PendingNotificationItem[]> {
  return [];
}
