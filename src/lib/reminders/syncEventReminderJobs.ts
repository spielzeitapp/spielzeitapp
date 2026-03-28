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
  console.log('REMINDER SYNC EVENT', event);
  console.log('REMINDER SYNC SETTINGS', settings);

  const jobs = buildReminderJobsForEvent(event, settings, teamId, now);
  console.log('REMINDER BUILT JOBS', jobs);

  console.log('[reminderJobs] delete pending/failed for event_id', event.id);
  const { error: delErr } = await client
    .from('notification_jobs')
    .delete()
    .eq('event_id', event.id)
    .in('status', ['pending', 'failed']);

  if (delErr) {
    console.error('[reminderJobs] delete error', delErr.message, delErr);
    return { deleted: false, inserted: 0, error: delErr.message };
  }

  if (jobs.length === 0) {
    console.log('[reminderJobs] no jobs to insert (0 slots or event not upcoming / in past)');
    return { deleted: true, inserted: 0, error: null };
  }

  const { error: insErr } = await client.from('notification_jobs').insert(jobs);
  if (insErr) {
    console.error('[reminderJobs] insert error', insErr.message, insErr);
    return { deleted: true, inserted: 0, error: insErr.message };
  }

  console.log('[reminderJobs] insert ok, count', jobs.length, '→ public.notification_jobs');
  return { deleted: true, inserted: jobs.length, error: null };
}
