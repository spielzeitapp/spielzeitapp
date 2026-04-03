import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawEventRow } from '../notifications/eventTypes';
import type { TeamNotificationSettingsRow } from '../notifications/teamSettings';
import type { ReminderJobInsert } from './types';
import { buildReminderJobsForEvent } from './buildReminderJobs';

/** Entfernt undefined / nicht-JSON-Werte — PostgREST kann sonst 400 bei jsonb/payload liefern. */
function sanitizeJobsForDbInsert(jobs: ReminderJobInsert[]): ReminderJobInsert[] {
  return JSON.parse(JSON.stringify(jobs)) as ReminderJobInsert[];
}

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
    const de = delErr as { message?: string; code?: string; details?: string; hint?: string };
    console.error('[reminderPipeline] notification_jobs delete error (kann HTTP 400 sein)', {
      message: de.message,
      code: de.code,
      details: de.details,
      hint: de.hint,
      raw: delErr,
    });
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

  const jobsToWrite = sanitizeJobsForDbInsert(jobs);
  console.log('[reminderPipeline] jobs.length before DB insert', jobsToWrite.length, {
    eventId: event.id,
    kinds: jobsToWrite.map((j) => j.kind),
    sendAts: jobsToWrite.map((j) => j.send_at),
    payloadPreview: jobsToWrite.map((j) => j.payload),
  });

  const { error: insErr } = await client.from('notification_jobs').insert(jobsToWrite);
  if (insErr) {
    const errObj = insErr as { message?: string; code?: string; details?: string; hint?: string };
    console.error('[reminderPipeline] notification_jobs insert error (HTTP oft 400 von PostgREST)', {
      message: errObj.message,
      code: errObj.code,
      details: errObj.details,
      hint: errObj.hint,
      raw: insErr,
    });
    return { deleted: true, inserted: 0, error: insErr.message };
  }

  console.log('[reminderPipeline] AUDIT insert ok — single writer path', {
    eventId: event.id,
    jobsWritten: jobsToWrite.length,
    jobs: jobsToWrite.map((j) => ({
      kind: j.kind,
      reminderKey: (j.payload as { reminderKey?: string }).reminderKey,
      minutesBefore: (j.payload as { offsetMinutes?: number }).offsetMinutes,
      dedupe_key: j.dedupe_key,
      send_at: j.send_at,
    })),
  });
  return { deleted: true, inserted: jobsToWrite.length, error: null };
}
