import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawEventRow } from '../notifications/eventTypes';
import { dedupeRecipientUserIds, reminderNotificationDedupeFingerprint } from '../notifications/pending';
import { fetchReminderRecipientUserIdsForTeamSeason } from '../notifications/users';
import { sendWebPushForUser } from '../../../lib/notificationDispatchHandler';
import type { NotificationJobPayload, NotificationJobRow, ReminderJobKind } from './types';
import { buildReminderUxCopy, reminderAppDeepLink } from './reminderUxCopy';

function notificationTypeFromJobKind(kind: ReminderJobKind): NotificationJobPayload['notificationType'] {
  if (kind === 'match') return 'game_reminder';
  if (kind === 'training') return 'training_reminder';
  return 'event_reminder';
}

function parsePayload(raw: unknown, jobKind: ReminderJobKind): NotificationJobPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const reminderKey =
    typeof p.reminderKey === 'string'
      ? p.reminderKey
      : typeof p.reminder_type === 'string'
        ? p.reminder_type
        : null;
  const om = p.offsetMinutes;
  const offsetMinutes =
    typeof om === 'number' ? om : typeof om === 'string' ? Number(om) : Number.NaN;
  if (!reminderKey || !Number.isFinite(offsetMinutes)) return null;
  const notificationType =
    typeof p.notificationType === 'string'
      ? (p.notificationType as NotificationJobPayload['notificationType'])
      : notificationTypeFromJobKind(jobKind);
  return {
    reminderKey,
    reminder_type: typeof p.reminder_type === 'string' ? p.reminder_type : reminderKey,
    offsetMinutes,
    notificationType,
    baseTimeIso: typeof p.baseTimeIso === 'string' ? p.baseTimeIso : '',
    minutes_before: typeof p.minutes_before === 'number' ? p.minutes_before : undefined,
    event_title: typeof p.event_title === 'string' ? p.event_title : undefined,
    type: typeof p.type === 'string' ? p.type : undefined,
  };
}

async function failJob(admin: SupabaseClient, jobId: string, err: string): Promise<void> {
  await admin
    .from('notification_jobs')
    .update({
      status: 'failed',
      last_error: err.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'processing');
}

async function completeJob(admin: SupabaseClient, jobId: string): Promise<void> {
  await admin
    .from('notification_jobs')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'processing');
}

/**
 * Verarbeitet einen bereits geclaimten Job (status processing).
 * Speichert pro Empfänger eine Zeile in public.notifications; optional Web Push.
 */
export async function processNotificationJob(
  admin: SupabaseClient,
  job: NotificationJobRow,
): Promise<{ ok: boolean; error?: string }> {
  console.log('PROCESS JOB', job.id);

  const payload = parsePayload(job.payload, job.kind);
  if (!payload) {
    const err = 'invalid job payload';
    await failJob(admin, job.id, err);
    return { ok: false, error: err };
  }

  const { data: event, error: evErr } = await admin.from('events').select('*').eq('id', job.event_id).single();

  if (evErr || !event) {
    const err = evErr?.message ?? 'event not found';
    console.error('EVENT load error', err);
    await failJob(admin, job.id, err);
    return { ok: false, error: err };
  }

  console.log('EVENT', event);

  const ev = event as RawEventRow;
  if ((ev.status ?? 'upcoming') !== 'upcoming') {
    console.log('[reminderPipeline] processNotificationJob skip: event not upcoming', {
      jobId: job.id,
      eventId: job.event_id,
      status: ev.status,
    });
    await completeJob(admin, job.id);
    return { ok: true };
  }

  const { title, message } = buildReminderUxCopy(job.kind, ev, payload.reminderKey);
  const linkPath = reminderAppDeepLink(job.kind, ev);

  let recipients: string[];
  try {
    recipients = await fetchReminderRecipientUserIdsForTeamSeason(admin, ev.team_season_id);
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    await failJob(admin, job.id, err);
    return { ok: false, error: err };
  }

  const recipientCountBeforeDedupe = recipients.length;
  recipients = dedupeRecipientUserIds(recipients);
  console.log('[notificationsDedup] job recipients', {
    jobId: job.id,
    eventId: job.event_id,
    rawCount: recipientCountBeforeDedupe,
    afterDedupeCount: recipients.length,
  });

  /** Pro Job genau ein Dispatch-Log pro User (Unique auf reminder_key); unabhängig von Payload-Varianten. */
  const dispatchLogReminderKey = `job:${job.id}`;

  console.log('[reminderPipeline] processNotificationJob recipients', {
    jobId: job.id,
    eventId: job.event_id,
    teamSeasonId: ev.team_season_id,
    count: recipients.length,
  });

  if (recipients.length === 0) {
    console.log('[reminderPipeline] processNotificationJob: no recipients (memberships empty)', {
      jobId: job.id,
      eventId: job.event_id,
      teamSeasonId: ev.team_season_id,
    });
    await completeJob(admin, job.id);
    return { ok: true };
  }

  try {
    for (const userId of recipients) {
      const { data: logRow, error: logInsErr } = await admin
        .from('notification_dispatch_log')
        .insert({
          user_id: userId,
          event_id: job.event_id,
          reminder_key: dispatchLogReminderKey,
          channel: 'in_app',
        })
        .select('id')
        .maybeSingle();

      if (logInsErr) {
        const code = (logInsErr as { code?: string }).code;
        if (code === '23505') {
          console.log('[notificationsDedup] dispatch_log insert skipped (duplicate)', {
            jobId: job.id,
            userId,
            reminderKey: dispatchLogReminderKey,
          });
          continue;
        }
        throw new Error(logInsErr.message || String(logInsErr));
      }
      const logId = logRow?.id as string | undefined;
      if (!logId) continue;

      const { error: nErr } = await admin.from('notifications').insert({
        user_id: userId,
        team_id: job.team_id,
        event_id: job.event_id,
        title,
        message,
        read: false,
        type: 'auto',
        link: linkPath,
        event_type: 'reminder',
        source_notification_job_id: job.id,
      });

      if (nErr) {
        const nCode = (nErr as { code?: string }).code;
        if (nCode === '23505') {
          console.log('[notificationsDedup] notification insert skipped (idempotent unique)', {
            jobId: job.id,
            userId,
            fingerprint: reminderNotificationDedupeFingerprint(job.id, userId),
          });
          continue;
        }
        await admin.from('notification_dispatch_log').delete().eq('id', logId);
        throw new Error(nErr.message || String(nErr));
      }

      console.log('[notificationsDedup] notification inserted', { jobId: job.id, userId });

      const pushTag = `reminder-${payload.reminderKey}-${job.event_id}`;
      const pushRes = await sendWebPushForUser(admin, {
        userId,
        title,
        body: message,
        url: linkPath,
        tag: pushTag,
      });
      if (pushRes.sent > 0) {
        const { error: pushLogErr } = await admin.from('notification_dispatch_log').insert({
          user_id: userId,
          event_id: job.event_id,
          reminder_key: dispatchLogReminderKey,
          channel: 'push',
        });
        if (pushLogErr) {
          const code = (pushLogErr as { code?: string }).code;
          if (code !== '23505') {
            console.warn('[processNotificationJob] notification_dispatch_log push', pushLogErr.message);
          }
        }
      }
      if (pushRes.errors.length) {
        console.warn('[processNotificationJob] push partial errors', userId, pushRes.errors);
      }
    }
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    await failJob(admin, job.id, err);
    return { ok: false, error: err };
  }

  await completeJob(admin, job.id);
  return { ok: true };
}
