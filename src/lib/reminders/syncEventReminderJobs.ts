import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawEventRow } from '../notifications/eventTypes';
import type { TeamNotificationSettingsRow } from '../notifications/teamSettings';
import { buildReminderJobsForEvent } from './buildReminderJobs';

/**
 * Single Source of Truth (Client nach Event-Write): ersetzt alle pending/failed Jobs für dieses Event,
 * dann Insert mit deterministischem dedupe_key (event:{id}:{kind}:{reminderKey}).
 * Kein zweiter Pfad (DB-Trigger) — sonst doppelte Jobs.
 */
export async function syncEventReminderJobs(
  client: SupabaseClient,
  event: RawEventRow & { id: string; team_season_id: string },
  settings: TeamNotificationSettingsRow,
  teamId: string,
  now: Date = new Date(),
): Promise<{ deleted: boolean; inserted: number; error: string | null }> {
  const jobs = buildReminderJobsForEvent(event, settings, teamId, now);
  console.log('[reminderPipeline] event → built jobs', {
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
  if (removedCount > 0) {
    console.log('[reminderPipeline] removed old pending/failed notification_jobs', {
      eventId: event.id,
      removedCount,
    });
  }

  if (jobs.length === 0) {
    console.log('[reminderPipeline] no jobs to insert (canonical type has no offsets, not upcoming, or base time in past)');
    return { deleted: true, inserted: 0, error: null };
  }

  const { error: insErr } = await client.from('notification_jobs').insert(jobs);
  if (insErr) {
    console.error('[reminderPipeline] notification_jobs insert error', insErr.message, insErr);
    return { deleted: true, inserted: 0, error: insErr.message };
  }

  console.log('[reminderPipeline] notification_jobs insert ok', {
    writtenForEvent: jobs.length,
    eventId: event.id,
    dedupeKeys: jobs.map((j) => j.dedupe_key),
  });
  return { deleted: true, inserted: jobs.length, error: null };
}
