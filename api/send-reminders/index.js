/**
 * Vercel: POST /api/send-reminders (CommonJS)
 * Verarbeitet fällige Zeilen in public.notification_jobs (Push + notifications).
 */
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const REMINDER_LINK = '/app/termine';
/** Idempotente Batches; mehrfaches Aufrufen möglich (Claim + messages-Dedupe). */
const JOB_BATCH_LIMIT = 50;

function formatTimeDe(iso) {
  if (!iso) return '--:--';
  try {
    return new Date(iso).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Vienna',
    });
  } catch (_) {
    return '--:--';
  }
}

/** Nur Debug-Logs: UTC-ISO → Europe/Vienna (keine Rechenbasis). */
function viennaDateTimeDebug(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('de-AT', {
      timeZone: 'Europe/Vienna',
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch (_) {
    return String(iso);
  }
}

/** Titel nach Job-Typ (match / training / event). */
function titleForJobKind(kind) {
  if (kind === 'match') return '⚽ Spiel-Erinnerung';
  if (kind === 'training') return '🏃 Trainings-Erinnerung';
  return '📌 Erinnerung';
}

/**
 * Fließtext z. B. „Erinnerung: Spiel heute um XX:XX“ (starts_at, Europe/Vienna).
 */
function buildReminderBody(kind, event, reminderKey) {
  const t = formatTimeDe(event.starts_at);
  if (kind === 'match') {
    if (reminderKey === 'match_reminder_2') {
      return `Erinnerung: Treffpunkt bald (Spiel um ${t}).`;
    }
    return `Erinnerung: Spiel heute um ${t}`;
  }
  if (kind === 'training') {
    return `Erinnerung: Training heute um ${t}`;
  }
  return `Erinnerung: Termin heute um ${t}`;
}

function parseBody(req) {
  try {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
    if (req.body && typeof req.body === 'object') return req.body;
  } catch (_) {
    return {};
  }
  return {};
}

function ensureVapid() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || '').trim();
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY und VAPID_SUBJECT müssen gesetzt sein.',
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

/** Wie Supabase Edge send-reminders: Trainer + Eltern + Spieler (kein Fan). */
const REMINDER_TEAM_ROLES = ['trainer', 'co_trainer', 'head_coach', 'parent', 'player'];

async function fetchReminderRecipientUserIdsForTeamSeason(admin, teamSeasonId) {
  const { data: members, error } = await admin
    .from('memberships')
    .select('user_id')
    .eq('team_season_id', teamSeasonId)
    .in('role', REMINDER_TEAM_ROLES);
  if (error) throw error;
  const ids = (members || []).map((m) => m.user_id);
  return [...new Set(ids.filter(Boolean))];
}

function parseJobPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw;
  const rk = typeof p.reminderKey === 'string' ? p.reminderKey : p.reminder_type;
  const om = p.offsetMinutes;
  const offsetMinutes = typeof om === 'number' ? om : typeof om === 'string' ? Number(om) : NaN;
  if (typeof rk !== 'string' || !Number.isFinite(offsetMinutes)) return null;
  return {
    reminderKey: rk,
    offsetMinutes,
    notificationType: p.notificationType,
    baseTimeIso: typeof p.baseTimeIso === 'string' ? p.baseTimeIso : '',
  };
}

async function notificationAlreadyDispatched(admin, userId, eventId, reminderKey) {
  const { data, error } = await admin
    .from('notification_dispatch_log')
    .select('id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .eq('reminder_key', reminderKey)
    .eq('channel', 'in_app')
    .limit(1);
  if (error) throw error;
  return Boolean(data && data.length > 0);
}

async function completeJob(admin, jobId) {
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

async function failJobWithRetry(admin, job, err) {
  const attempt = (job.attempt_count || 0) + 1;
  const lastErr = String(err).slice(0, 2000);
  if (attempt < 3) {
    await admin
      .from('notification_jobs')
      .update({
        status: 'pending',
        attempt_count: attempt,
        last_error: lastErr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  } else {
    await admin
      .from('notification_jobs')
      .update({
        status: 'failed',
        attempt_count: attempt,
        last_error: lastErr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }
}

function pushIsGoneError(err) {
  const code = Number(err && err.statusCode);
  const status = Number(err && err.status);
  return code === 404 || code === 410 || status === 404 || status === 410;
}

async function sendPushesForUser(admin, userId, title, body, url) {
  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
    .not('endpoint', 'is', null);
  if (error) throw error;
  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, removed: 0 };
  }
  ensureVapid();
  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  let removed = 0;
  for (const row of subscriptions) {
    const endpoint = row.endpoint || '';
    const p256dh = row.p256dh || '';
    const auth = row.auth || '';
    if (!endpoint || !p256dh || !auth) continue;
    try {
      await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload, { TTL: 3600 });
      sent += 1;
    } catch (err) {
      console.error('[reminderPipeline] push failed', { userId, endpoint, error: err });
      if (pushIsGoneError(err)) {
        const { error: delErr } = await admin
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
        if (!delErr) removed += 1;
      }
    }
  }
  return { sent, removed };
}

/**
 * Ein Job: Empfänger wie Edge send-reminders (Trainer + Eltern + Spieler, kein Teilnahme-Filter).
 */
async function processOneJob(admin, job) {
  const nowIso = new Date().toISOString();
  console.log('[reminderTz] process job (UTC compare)', {
    jobId: job.id,
    eventId: job.event_id,
    send_at_utc: job.send_at || null,
    send_at_vienna: viennaDateTimeDebug(job.send_at),
    now_utc: nowIso,
    now_vienna: viennaDateTimeDebug(nowIso),
  });

  const payload = parseJobPayload(job.payload);
  if (!payload) {
    const err = new Error('invalid job payload');
    await failJobWithRetry(admin, job, err.message);
    return { ok: false, error: err.message };
  }

  const reminderKey = payload.reminderKey;

  const { data: event, error: evErr } = await admin
    .from('events')
    .select('*')
    .eq('id', job.event_id)
    .maybeSingle();

  if (evErr || !event) {
    const err = evErr?.message || 'event not found';
    await failJobWithRetry(admin, job, err);
    return { ok: false, error: err };
  }

  console.log('[reminderTz] event row (stored UTC)', {
    eventId: event.id,
    starts_at_raw: event.starts_at,
    meeting_at_raw: event.meeting_at,
    starts_at_vienna_debug: viennaDateTimeDebug(event.starts_at),
    meeting_at_vienna_debug: event.meeting_at ? viennaDateTimeDebug(event.meeting_at) : null,
  });

  const title = titleForJobKind(job.kind);
  const textBody = buildReminderBody(job.kind, event, reminderKey);
  const url = REMINDER_LINK.startsWith('/') ? REMINDER_LINK : `/${REMINDER_LINK}`;

  if ((event.status ?? 'upcoming') !== 'upcoming') {
    console.log('[reminderPipeline] skip: event not upcoming', { jobId: job.id, eventId: job.event_id });
    await completeJob(admin, job.id);
    return { ok: true, skipped: 'event_not_upcoming' };
  }

  let recipients;
  try {
    recipients = await fetchReminderRecipientUserIdsForTeamSeason(admin, event.team_season_id);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    await failJobWithRetry(admin, job, msg);
    return { ok: false, error: msg };
  }

  console.log('[reminderPipeline] job recipients resolved', {
    jobId: job.id,
    eventId: job.event_id,
    recipientCount: recipients.length,
  });

  if (recipients.length === 0) {
    console.log('[reminderPipeline] no recipients (empty memberships)', { jobId: job.id, eventId: job.event_id });
    await completeJob(admin, job.id);
    return { ok: true, inserted: 0, pushSent: 0, skipped: 'no_recipients' };
  }

  let inserted = 0;
  let pushSent = 0;

  for (const userId of recipients) {
    const exists = await notificationAlreadyDispatched(admin, userId, job.event_id, reminderKey);
    if (exists) continue;

    const { error: insErr } = await admin.from('notifications').insert({
      team_id: job.team_id,
      user_id: userId,
      event_id: job.event_id,
      title,
      message: textBody,
      type: 'auto',
      event_type: 'reminder',
      read: false,
      link: url,
    });

    if (insErr) {
      throw new Error(insErr.message || String(insErr));
    }
    inserted += 1;
    console.log('[reminderPipeline] notifications row created', { jobId: job.id, userId, eventId: job.event_id });

    const { error: dispErr } = await admin.from('notification_dispatch_log').insert({
      user_id: userId,
      event_id: job.event_id,
      reminder_key: reminderKey,
      channel: 'in_app',
    });
    if (dispErr) {
      const code = dispErr.code;
      if (code !== '23505') {
        console.warn('[send-reminders] notification_dispatch_log insert failed', dispErr.message || dispErr);
      }
    }

    const pushRes = await sendPushesForUser(admin, userId, title, textBody, url);
    pushSent += pushRes.sent;
    console.log('[reminderPipeline] push attempt', {
      jobId: job.id,
      userId,
      sent: pushRes.sent,
      removed: pushRes.removed,
    });
  }

  await completeJob(admin, job.id);
  return { ok: true, inserted, pushSent, skippedUsers: recipients.length - inserted };
}

module.exports = async (req, res) => {
  console.log('SEND REMINDERS START');
  console.log('METHOD', req.method);

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const body = parseBody(req);
    if (body.manualTest === true) {
      console.log('[send-reminders] manualTest trigger (same job worker)');
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({ ok: false, error: 'Missing Supabase env' });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const nowIso = new Date().toISOString();

    const { data: jobIds, error: qErr } = await admin
      .from('notification_jobs')
      .select('id, send_at, event_id, status')
      .eq('status', 'pending')
      .lte('send_at', nowIso)
      .order('send_at', { ascending: true })
      .limit(JOB_BATCH_LIMIT);

    if (qErr) {
      console.error('SEND REMINDERS ERROR', qErr);
      return res.status(500).json({ ok: false, error: qErr.message || 'query failed' });
    }

    const ids = (jobIds || []).map((r) => r.id).filter(Boolean);
    console.log('[reminderPipeline] due jobs selected', {
      nowIso,
      nowVienna: viennaDateTimeDebug(nowIso),
      count: ids.length,
      ids,
      sampleRows: (jobIds || []).slice(0, 5).map((r) => ({
        ...r,
        send_at_vienna: viennaDateTimeDebug(r.send_at),
      })),
    });

    let processed = 0;
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const id of ids) {
      const { data: claimed, error: claimErr } = await admin
        .from('notification_jobs')
        .update({
          status: 'processing',
          updated_at: nowIso,
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();

      if (claimErr) {
        console.error('[send-reminders] claim', id, claimErr.message);
        failed += 1;
        continue;
      }
      if (!claimed) {
        console.log('[reminderTz] claim skipped (race or row no longer pending)', { jobId: id, nowUtc: nowIso });
        continue;
      }

      processed += 1;
      const job = claimed;
      try {
        const r = await processOneJob(admin, job);
        if (r.ok) sent += 1;
        else failed += 1;
        if (r.error) errors.push({ jobId: id, error: r.error });
        console.log('[send-reminders] job result', id, r);
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        console.error('SEND REMINDERS ERROR job', id, msg, e && e.stack);
        await failJobWithRetry(admin, job, msg);
        failed += 1;
        errors.push({ jobId: id, error: msg });
      }
    }

    return res.status(200).json({
      ok: true,
      message: 'Reminder jobs processed',
      processed,
      sent,
      failed,
      ...(errors.length ? { errors } : {}),
    });
  } catch (err) {
    console.error('SEND REMINDERS ERROR', err);
    return res.status(500).json({
      ok: false,
      error: (err && err.message) || 'Unknown error',
    });
  }
};
