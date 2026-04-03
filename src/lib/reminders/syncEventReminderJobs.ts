import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawEventRow } from '../notifications/eventTypes';
import type { TeamNotificationSettingsRow } from '../notifications/teamSettings';
import { buildReminderJobsForEvent } from './buildReminderJobs';

/**
 * EINZIGER Ort, der notification_jobs per App-Client einfügt (nach Event-Insert/Update).
 * Vorher: DELETE pending/failed für event_id (räumt auch Legacy-Keys vom DB-Trigger weg).
 * dedupe_key: event:{id}:kind:{kind}:reminder:{minutes}[:r:{reminderKey} bei Kollision]
 *
 * Kein zweiter Writer: Migrationen entfernen trg_events_sync_notification_jobs (Supabase-seitig).
 */
export async function syncEventReminderJobs(
  client: SupabaseClient,
  event: RawEventRow & { id: string; team_season_id: string },
  settings: TeamNotificationSettingsRow,
  teamId: string,
  now: Date = new Date(),
): Promise<{ deleted: boolean; inserted: number; error: string | null }> {
  console.log('[reminderPipeline] syncEventReminderJobs called', { eventId: event.id, teamSeasonId: event.team_season_id });
  const jobs = buildReminderJobsForEvent(event, settings, teamId, now);
  console.log('[reminderPipeline] AUDIT buildReminderJobsForEvent', {
    eventId: event.id,
    kind: event.kind,
    type: event.type,
    status: event.status,
    jobCount: jobs.length,
    sendAtPreview: jobs.slice(0, 3).map((j) => j.send_at),
  });
  // Ersetzt alle pending/failed für dieses Event (inkl. Legacy-dedupe_key vom alten DB-Trigger)
  const { data: removedRows, error: delErr } = await client
    .from('notification_jobs')
    .delete()
    .eq('event_id', event.id)
    .in('status', ['pending', 'failed'])
    .select('id');

  if (delErr) {
    console.error('[reminderPipeline] notification_jobs delete error', delErr.message, delErr);
    return { deleted: false, inserted: 0, error: delErr.message };
  }

  const removedCount = Array.isArray(removedRows) ? removedRows.length : 0;
  console.log('[reminderPipeline] AUDIT delete-before-insert', {
    eventId: event.id,
    removedPendingOrFailedCount: removedCount,
  });

  if (jobs.length === 0) {
    console.warn('[reminderPipeline] ZERO jobs — nothing written (event skipped or buildReminderJobsForEvent returned []). Check status, base time, settings.', {
      eventId: event.id,
    });
    return { deleted: true, inserted: 0, error: null };
  }

  console.log('[reminderPipeline] jobs.length before DB insert', jobs.length, {
    eventId: event.id,
    kinds: jobs.map((j) => j.kind),
    sendAts: jobs.map((j) => j.send_at),
  });

  const { error: insErr } = await client.from('notification_jobs').insert(jobs);
  if (insErr) {
    console.error('[reminderPipeline] notification_jobs insert error', insErr.message, insErr);
    return { deleted: true, inserted: 0, error: insErr.message };
  }

  console.log('[reminderPipeline] AUDIT insert ok — single writer path', {
    eventId: event.id,
    jobsWritten: jobs.length,
    jobs: jobs.map((j) => ({
      kind: j.kind,
      reminderKey: (j.payload as { reminderKey?: string }).reminderKey,
      minutesBefore: (j.payload as { offsetMinutes?: number }).offsetMinutes,
      dedupe_key: j.dedupe_key,
      send_at: j.send_at,
    })),
  });
  return { deleted: true, inserted: jobs.length, error: null };
}
