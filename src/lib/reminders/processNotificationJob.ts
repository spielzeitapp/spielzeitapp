import type { SupabaseClient } from '@supabase/supabase-js';
import { getEventDisplayTitle, type RawEventRow } from '../notifications/eventTypes';
import { fetchPlayerIdsForUserInTeamSeason, fetchRecipientUserIdsForTeamSeason } from '../notifications/users';
import { buildPushReminderShort, buildReminderInAppBody, formatEventTimeVienna } from '../notifications/format';
import { sendWebPushForUser } from '../../../lib/notificationDispatchHandler';
import type { NotificationJobPayload, NotificationJobRow } from './types';

function hasAllPlayersAnswered(playerIds: string[], attendanceByPlayerId: Map<string, string>): boolean {
  if (playerIds.length === 0) return true;
  return playerIds.every((pid) => {
    const s = attendanceByPlayerId.get(pid);
    return s === 'yes' || s === 'no';
  });
}

function locationLineForBody(ev: RawEventRow): string | null {
  const loc = (ev.location ?? '').trim();
  const addr = (ev.address ?? '').trim();
  if (loc && addr) return `${loc} (${addr})`;
  return loc || addr || null;
}

function buildCopyForJob(
  jobKind: NotificationJobRow['kind'],
  event: RawEventRow,
): { title: string; body: string; pushBody: string } {
  const titleStr = getEventDisplayTitle(event);
  const meetIso = event.meetup_at ?? event.meeting_at ?? null;
  const startsIso = event.starts_at;
  const locLine = locationLineForBody(event);
  const meetForBody = meetIso && String(meetIso).trim() ? meetIso : null;

  if (jobKind === 'match') {
    const tIso = meetForBody ?? startsIso;
    const hhmm = formatEventTimeVienna(tIso);
    const title = `Erinnerung: Treffpunkt heute um ${hhmm} Uhr`;
    const body = buildReminderInAppBody(titleStr, startsIso, locLine, meetForBody);
    return { title, body, pushBody: buildPushReminderShort(titleStr) };
  }

  if (jobKind === 'training') {
    const hhmm = formatEventTimeVienna(startsIso);
    const title = `Training heute um ${hhmm} Uhr`;
    const body = buildReminderInAppBody(titleStr, startsIso, locLine, meetForBody);
    return { title, body, pushBody: buildPushReminderShort(titleStr) };
  }

  const hhmm = formatEventTimeVienna(startsIso);
  const title = `Termin heute um ${hhmm} Uhr`;
  const body = buildReminderInAppBody(titleStr, startsIso, locLine, meetForBody);
  return { title, body, pushBody: buildPushReminderShort(titleStr) };
}

function parsePayload(raw: unknown): NotificationJobPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const reminderKey =
    typeof p.reminderKey === 'string'
      ? p.reminderKey
      : typeof p.reminder_type === 'string'
        ? p.reminder_type
        : null;
  if (!reminderKey || typeof p.offsetMinutes !== 'number') return null;
  if (typeof p.notificationType !== 'string') return null;
  return {
    reminderKey,
    reminder_type: typeof p.reminder_type === 'string' ? p.reminder_type : reminderKey,
    offsetMinutes: p.offsetMinutes,
    notificationType: p.notificationType as NotificationJobPayload['notificationType'],
    baseTimeIso: typeof p.baseTimeIso === 'string' ? p.baseTimeIso : '',
    minutes_before: typeof p.minutes_before === 'number' ? p.minutes_before : undefined,
    event_title: typeof p.event_title === 'string' ? p.event_title : undefined,
    event_type: typeof p.event_type === 'string' ? p.event_type : undefined,
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

  const payload = parsePayload(job.payload);
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
    await completeJob(admin, job.id);
    return { ok: true };
  }

  const { title, body, pushBody } = buildCopyForJob(job.kind, ev);
  const linkPath = `/app/events/${job.event_id}`;

  const { data: attRows, error: attErr } = await admin
    .from('event_attendance')
    .select('player_id, status')
    .eq('event_id', job.event_id);
  if (attErr) {
    const err = attErr.message;
    await failJob(admin, job.id, err);
    return { ok: false, error: err };
  }

  const attMap = new Map<string, string>();
  for (const row of attRows ?? []) {
    const r = row as { player_id: string; status: string };
    attMap.set(r.player_id, r.status);
  }

  let userIds: string[];
  try {
    userIds = await fetchRecipientUserIdsForTeamSeason(admin, ev.team_season_id);
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    await failJob(admin, job.id, err);
    return { ok: false, error: err };
  }

  const recipients: string[] = [];
  for (const userId of userIds) {
    let playerIds: string[];
    try {
      playerIds = await fetchPlayerIdsForUserInTeamSeason(admin, userId, ev.team_season_id);
    } catch {
      continue;
    }
    if (playerIds.length === 0) continue;
    if (hasAllPlayersAnswered(playerIds, attMap)) continue;
    recipients.push(userId);
  }

  console.log('RECIPIENTS', recipients);

  try {
    for (const userId of recipients) {
      const { data: dup } = await admin
        .from('notification_dispatch_log')
        .select('id')
        .eq('user_id', userId)
        .eq('event_id', job.event_id)
        .eq('reminder_key', payload.reminderKey)
        .eq('channel', 'in_app')
        .maybeSingle();

      if (dup) continue;

      const { error: nErr } = await admin.from('notifications').insert({
        user_id: userId,
        team_id: job.team_id,
        event_id: job.event_id,
        title,
        message: body,
        read: false,
        type: 'auto',
        link: linkPath,
        event_type: 'reminder',
      });

      if (nErr) {
        throw new Error(nErr.message || String(nErr));
      }

      const { error: dispErr } = await admin.from('notification_dispatch_log').insert({
        user_id: userId,
        event_id: job.event_id,
        reminder_key: payload.reminderKey,
        channel: 'in_app',
      });
      if (dispErr) {
        const code = (dispErr as { code?: string }).code;
        if (code !== '23505') {
          console.warn('[processNotificationJob] notification_dispatch_log in_app', dispErr.message);
        }
      }

      const pushTag = `reminder-${payload.reminderKey}-${job.event_id}`;
      const pushRes = await sendWebPushForUser(admin, {
        userId,
        title: 'SpielzeitApp Erinnerung',
        body: pushBody,
        url: linkPath,
        tag: pushTag,
      });
      if (pushRes.sent > 0) {
        const { error: pushLogErr } = await admin.from('notification_dispatch_log').insert({
          user_id: userId,
          event_id: job.event_id,
          reminder_key: payload.reminderKey,
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
