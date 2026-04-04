import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawEventRow } from '../notifications/eventTypes';
import { resolveTeamSettings, type TeamNotificationSettingsRow } from '../notifications/teamSettings';
import { syncEventReminderJobs } from './syncEventReminderJobs';

/**
 * Keine Client-Writes auf notification_jobs mehr — nur noch Hinweis-Log und Rückgabe.
 * Jobs erzeugt `trg_events_sync_notification_jobs`.
 */
export async function syncReminderJobsAfterEventWrite(
  client: SupabaseClient,
  eventRow: Record<string, unknown>,
  teamNotificationSettings?: TeamNotificationSettingsRow | null,
): Promise<{ inserted: number; error: string | null } | undefined> {
  try {
    const event = eventRow as RawEventRow & { id: string; team_season_id: string };
    if (!event?.id || !event.team_season_id) {
      console.warn('[reminderPipeline] skip sync: missing event.id or team_season_id', eventRow);
      return { inserted: 0, error: 'missing id or team_season_id' };
    }

    const settings = resolveTeamSettings(event.team_season_id, teamNotificationSettings ?? undefined);
    const res = await syncEventReminderJobs(client, event, settings, '');
    return { inserted: res.inserted, error: res.error };
  } catch (e) {
    console.error('[reminderPipeline] syncReminderJobsAfterEventWrite', e);
    return { inserted: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Kompatible Signatur: gespeicherte Zeile + Settings (wie im Auftrag).
 * `team_id` der Mannschaft wird über team_seasons ermittelt.
 */
export async function syncEventReminderJobsForSavedEvent(
  client: SupabaseClient,
  savedEvent: Record<string, unknown>,
  teamNotificationSettings: TeamNotificationSettingsRow,
): Promise<void> {
  await syncReminderJobsAfterEventWrite(client, savedEvent, teamNotificationSettings);
}

/**
 * Nach Event-Insert: Jobs erzeugt der DB-Trigger (kein Client-Write mehr).
 */
export async function createReminderJobs(
  client: SupabaseClient,
  eventRow: Record<string, unknown>,
): Promise<{ inserted: number; error: string | null } | undefined> {
  const event = eventRow as RawEventRow & { id: string; team_season_id: string };
  if (!event?.id || !event.team_season_id) {
    console.warn('[reminderPipeline] createReminderJobs skip: missing event.id or team_season_id', eventRow);
    return { inserted: 0, error: 'missing id or team_season_id' };
  }

  return syncReminderJobsAfterEventWrite(client, eventRow);
}
