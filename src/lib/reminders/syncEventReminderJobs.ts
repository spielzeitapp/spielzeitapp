import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawEventRow } from '../notifications/eventTypes';
import type { TeamNotificationSettingsRow } from '../notifications/teamSettings';
import { buildReminderJobsForEvent } from './buildReminderJobs';

/**
 * Aktualisiert notification_jobs für ein Event: alte pending/failed entfernen, neue einfügen.
 * Duplikate werden über dedupe_key verhindert (Unique); nach Delete sollte Insert sauber sein.
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
  const { error: delErr } = await client
    .from('notification_jobs')
    .delete()
    .eq('event_id', event.id)
    .in('status', ['pending', 'failed']);

  if (delErr) {
    console.error('[reminderPipeline] notification_jobs delete error', delErr.message, delErr);
    return { deleted: false, inserted: 0, error: delErr.message };
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

  console.log('[reminderPipeline] notification_jobs insert ok', { count: jobs.length, eventId: event.id });
  return { deleted: true, inserted: jobs.length, error: null };
}
