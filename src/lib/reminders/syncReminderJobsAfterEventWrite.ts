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
): Promise<void> {
  try {
    const event = eventRow as RawEventRow & { id: string; team_season_id: string };
    if (!event?.id || !event.team_season_id) {
      console.warn('[reminderJobs] skip sync: missing event.id or team_season_id', eventRow);
      return;
    }

    const { data: ts, error: tsErr } = await client
      .from('team_seasons')
      .select('team_id')
      .eq('id', event.team_season_id)
      .maybeSingle();

    if (tsErr || !ts || !(ts as { team_id?: string }).team_id) {
      console.error('[reminderJobs] team_seasons.team_id missing', tsErr?.message, tsErr);
      return;
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
        console.warn('[reminderJobs] settings load failed (use defaults)', setErr.message);
      }
      settings = mapTeamNotificationSettingsFromDb(
        settingsRaw as Record<string, unknown> | null,
        event.team_season_id,
      );
    }

    const res = await syncEventReminderJobs(client, event, settings, teamId);
    if (res.error) {
      console.error('[reminderJobs] sync failed', event.id, res.error);
    }
  } catch (e) {
    console.error('[reminderJobs] syncReminderJobsAfterEventWrite', e);
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
): Promise<void> {
  const event = eventRow as RawEventRow & { id: string; team_season_id: string };
  if (!event?.id || !event.team_season_id) {
    console.warn('[reminderJobs] createReminderJobs skip: missing event.id or team_season_id', eventRow);
    return;
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

  await syncReminderJobsAfterEventWrite(client, eventRow, forcedSettings);
}
