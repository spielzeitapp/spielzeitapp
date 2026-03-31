import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawEventRow } from '../notifications/eventTypes';
import {
  mapTeamNotificationSettingsFromDb,
  resolveTeamSettings,
  type TeamNotificationSettingsRow,
} from '../notifications/teamSettings';
import { syncEventReminderJobs } from './syncEventReminderJobs';

/**
 * Lädt team_id + Einstellungen und synchronisiert Jobs (Client nach Insert/Update).
 * Optional: `teamNotificationSettings` bereits geladen → erspart einen Select.
 * Fehler loggen, UI nicht blockieren.
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

    const { data: ts, error: tsErr } = await client
      .from('team_seasons')
      .select('team_id')
      .eq('id', event.team_season_id)
      .maybeSingle();

    if (tsErr || !ts || !(ts as { team_id?: string }).team_id) {
      console.error('[reminderPipeline] team_seasons.team_id missing', tsErr?.message, tsErr);
      return { inserted: 0, error: tsErr?.message ?? 'team_id missing' };
    }

    const teamId = (ts as { team_id: string }).team_id;

    let settings: TeamNotificationSettingsRow;
    if (teamNotificationSettings) {
      settings = teamNotificationSettings;
    } else {
      const { data: settingsRaw, error: setErr } = await client
        .from('team_notification_settings')
        .select('*')
        .eq('team_season_id', event.team_season_id)
        .maybeSingle();

      if (setErr) {
        console.warn('[reminderPipeline] settings load failed (use defaults)', setErr.message);
      }
      settings = mapTeamNotificationSettingsFromDb(
        settingsRaw as Record<string, unknown> | null,
        event.team_season_id,
      );
    }

    const res = await syncEventReminderJobs(client, event, settings, teamId);
    if (res.error) {
      console.error('[reminderPipeline] sync failed', { eventId: event.id, error: res.error });
    } else {
      console.log('[reminderPipeline] sync ok', {
        eventId: event.id,
        inserted: res.inserted,
        clearedOldPendingOrFailed: res.deleted,
      });
    }
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
 * Finaler Auto-Create-Pfad nach Event-Insert:
 * - training: 2h vorher
 * - match: 24h + 2h vorher
 * - event: 24h vorher
 *
 * Nutzt dieselbe notification_jobs-Pipeline (kein Sonderweg).
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

  const forcedSettings = resolveTeamSettings(event.team_season_id, {
    team_season_id: event.team_season_id,
    training_enabled: true,
    training_minutes_before: 120,
    match_enabled: true,
    match_minutes_before: 1440,
    match_second_enabled: true,
    match_second_minutes_before: 120,
    event_enabled: true,
    event_minutes_before: 1440,
  });

  return syncReminderJobsAfterEventWrite(client, eventRow, forcedSettings);
}
