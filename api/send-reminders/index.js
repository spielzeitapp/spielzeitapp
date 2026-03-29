/**
 * Vercel: POST /api/send-reminders (CommonJS)
 * Verarbeitet fällige Zeilen in public.notification_jobs (Push + messages).
 */
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const REMINDER_LINK = '/app/termine';
const JOB_BATCH_LIMIT = 20;

const COPY = {
  match_reminder_1: {
    title: '⚽ Spiel-Erinnerung',
    body: 'Bitte Zu-/Absage abgeben.',
  },
  match_reminder_2: {
    title: '⚽ Spiel-Erinnerung',
    body: 'Erinnerung: Treffpunkt bald.',
  },
  training_reminder: {
    title: '🏃 Trainings-Erinnerung',
    body: 'Training startet bald.',
  },
  event_reminder: {
    title: '📌 Erinnerung',
    body: 'Ein Termin startet bald.',
  },
};

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

async function fetchRecipientUserIdsForTeamSeason(admin, teamSeasonId) {
  const { data: members, error } = await admin
    .from('memberships')
    .select('user_id')
    .eq('team_season_id', teamSeasonId)
    .in('role', ['parent', 'player']);
  if (error) throw error;
  const ids = (members || []).map((m) => m.user_id);
  return [...new Set(ids.filter(Boolean))];
}

async function fetchPlayerIdsForUserInTeamSeason(admin, userId, teamSeasonId) {
  const { data: players, error: pErr } = await admin
    .from('players')
    .select('id')
    .eq('team_season_id', teamSeasonId)
    .eq('is_active', true);
  if (pErr) throw pErr;
  const rosterIds = new Set((players || []).map((p) => p.id));

  const { data: g, error: gErr } = await admin
    .from('player_guardians')
    .select('player_id')
    .eq('user_id', userId);
  if (gErr) throw gErr;
  const fromG = (g || [])
    .map((x) => x.player_id)
    .filter((id) => rosterIds.has(id));

  const { data: pu, error: puErr } = await admin
    .from('player_users')
    .select('player_id')
    .eq('user_id', userId);
  if (puErr) throw puErr;
  const fromPu = (pu || [])
    .map((x) => x.player_id)
    .filter((id) => rosterIds.has(id));

  return [...new Set([...fromG, ...fromPu])];
}

function hasAllPlayersAnswered(playerIds, attMap) {
  if (playerIds.length === 0) return true;
  return playerIds.every((pid) => {
    const s = attMap.get(pid);
    return s === 'yes' || s === 'no';
  });
}

function parseJobPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw;
  const rk = typeof p.reminderKey === 'string' ? p.reminderKey : p.reminder_type;
  if (typeof rk !== 'string' || typeof p.offsetMinutes !== 'number') return null;
  return {
    reminderKey: rk,
    offsetMinutes: p.offsetMinutes,
    notificationType: p.notificationType,
    baseTimeIso: typeof p.baseTimeIso === 'string' ? p.baseTimeIso : '',
  };
}

async function messageExists(admin, userId, eventId, reminderKey) {
  const { data: ex } = await admin
    .from('messages')
    .select('id')
    .eq('user_id', userId)
    .eq('related_event_id', eventId)
    .eq('type', 'team_push')
    .eq('reminder_key', reminderKey)
    .maybeSingle();
  return Boolean(ex && ex.id);
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

function getCopy(reminderKey) {
  return COPY[reminderKey] || { title: 'SpielzeitApp', body: 'Erinnerung.' };
}

async function sendOnePush(subRow, title, body, url) {
  ensureVapid();
  const payload = JSON.stringify({ title, body, url });
  await webpush.sendNotification(
    {
      endpoint: subRow.endpoint,
      keys: { p256dh: subRow.p256dh, auth: subRow.auth },
    },
    payload,
    { TTL: 3600 },
  );
}

/**
 * Ein Job: Empfänger wie processNotificationJob (Attendance) → messages + push_subscriptions.
 */
async function processOneJob(admin, job) {
  const payload = parseJobPayload(job.payload);
  if (!payload) {
    const err = new Error('invalid job payload');
    await failJobWithRetry(admin, job, err.message);
    return { ok: false, error: err.message };
  }

  const reminderKey = payload.reminderKey;
  const { title, body: textBody } = getCopy(reminderKey);
  const url = REMINDER_LINK.startsWith('/') ? REMINDER_LINK : `/${REMINDER_LINK}`;
  const contentWithLink = `${textBody}\n\n${url}`;

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

  if ((event.status ?? 'upcoming') !== 'upcoming') {
    await completeJob(admin, job.id);
    return { ok: true, skipped: 'event_not_upcoming' };
  }

  const { data: attRows, error: attErr } = await admin
    .from('event_attendance')
    .select('player_id, status')
    .eq('event_id', job.event_id);
  if (attErr) {
    await failJobWithRetry(admin, job, attErr.message);
    return { ok: false, error: attErr.message };
  }

  const attMap = new Map();
  for (const row of attRows || []) {
    attMap.set(row.player_id, row.status);
  }

  let userIds;
  try {
    userIds = await fetchRecipientUserIdsForTeamSeason(admin, event.team_season_id);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    await failJobWithRetry(admin, job, msg);
    return { ok: false, error: msg };
  }

  const recipients = [];
  for (const userId of userIds) {
    let playerIds;
    try {
      playerIds = await fetchPlayerIdsForUserInTeamSeason(admin, userId, event.team_season_id);
    } catch {
      continue;
    }
    if (playerIds.length === 0) continue;
    if (hasAllPlayersAnswered(playerIds, attMap)) continue;
    recipients.push(userId);
  }

  if (recipients.length === 0) {
    await completeJob(admin, job.id);
    return { ok: true, inserted: 0, pushSent: 0, skipped: 'no_recipients' };
  }

  let inserted = 0;
  let pushSent = 0;

  for (const userId of recipients) {
    const exists = await messageExists(admin, userId, job.event_id, reminderKey);
    if (exists) continue;

    const { error: insErr } = await admin.from('messages').insert({
      team_id: job.team_id,
      user_id: userId,
      title,
      body: textBody,
      content: contentWithLink,
      type: 'team_push',
      read: false,
      link: url,
      related_event_id: job.event_id,
      event_id: job.event_id,
      reminder_key: reminderKey,
      notification_kind: job.kind === 'match' ? 'match' : job.kind === 'training' ? 'training' : 'event',
    });

    if (insErr) {
      throw new Error(insErr.message || String(insErr));
    }
    inserted += 1;

    const { data: sub } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)
      .not('endpoint', 'is', null)
      .maybeSingle();

    if (!sub || !sub.endpoint || !sub.p256dh || !sub.auth) continue;

    try {
      await sendOnePush(sub, title, textBody, url);
      pushSent += 1;
    } catch (pe) {
      console.error('[send-reminders] push failed', userId, pe && pe.message ? pe.message : pe);
    }
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
      .select('id')
      .eq('status', 'pending')
      .lte('send_at', nowIso)
      .order('send_at', { ascending: true })
      .limit(JOB_BATCH_LIMIT);

    if (qErr) {
      console.error('SEND REMINDERS ERROR', qErr);
      return res.status(500).json({ ok: false, error: qErr.message || 'query failed' });
    }

    const ids = (jobIds || []).map((r) => r.id).filter(Boolean);
    console.log('due job ids count', ids.length, ids);

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
      if (!claimed) continue;

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
