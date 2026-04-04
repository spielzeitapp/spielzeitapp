import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawEventRow } from '../notifications/eventTypes';
import type { TeamNotificationSettingsRow } from '../notifications/teamSettings';

/**
 * Früher: Client schrieb notification_jobs nach Event-Speichern.
 * Jetzt: nur DB-Trigger `trg_events_sync_notification_jobs` — keine Client-Writes mehr.
 */
export async function syncEventReminderJobs(
  _client: SupabaseClient,
  _event: RawEventRow & { id: string; team_season_id: string },
  _settings: TeamNotificationSettingsRow,
  _teamId: string,
  _now: Date = new Date(),
): Promise<{ deleted: boolean; inserted: number; error: string | null }> {
  console.log('[reminderPipeline] client writer disabled, relying on DB trigger');
  return { deleted: false, inserted: 0, error: null };
}
