/**
 * Vercel Serverless: POST /api/send-reminders (CommonJS)
 * Reminder: Spiele (2 Stufen) + Training nach team_notification_settings; Push + messages.
 */
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const REMINDER_URL = '/app/termine';
const REMINDER_WINDOW_MS = 10 * 60 * 1000;

/** Nur bei SEND_REMINDERS_FORCE_TEST=true (Push+1 User-Message Test) */
const FORCE_REMINDER_PIPELINE_TEST = process.env.SEND_REMINDERS_FORCE_TEST === 'true';

const TEST_NOTIF_TITLE = '⚽ Test Spiel-Erinnerung';
const TEST_NOTIF_BODY = 'Test: Reminder Pipeline funktioniert.';
const TEST_LINK = '/termine';

const REMINDER_KEYS = {
  MATCH_1: 'match_reminder_1',
  MATCH_2: 'match_reminder_2',
  TRAINING: 'training_reminder',
};

const COPY = {
  match1: {
    title: '⚽ Spiel-Erinnerung',
    body: 'Spiel heute. Bitte Zu-/Absage prüfen.',
  },
  match2: {
    title: '⚽ Spiel-Erinnerung',
    body: 'Erinnerung: Spiel startet bald.',
  },
  training: {
    title: '🏃 Trainings-Erinnerung',
    body: 'Training startet bald.',
  },
};

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function nonEmptyIso(value) {
  if (value == null) return null;
  const t = String(value).trim();
  return t === '' ? null : t;
}

/** Spiel: Treff → Kickoff → Start */
function getBaseTimeIsoMatch(row) {
  const meet = nonEmptyIso(row.meetup_at) ?? nonEmptyIso(row.meeting_at);
  const kickoff = nonEmptyIso(row.kickoff_at);
  const start = nonEmptyIso(row.starts_at) ?? '';
  if (meet) return meet;
  if (kickoff) return kickoff;
  return start;
}

/** Training: Treff → Start */
function getBaseTimeIsoTraining(row) {
  const meet = nonEmptyIso(row.meetup_at) ?? nonEmptyIso(row.meeting_at);
  const start = nonEmptyIso(row.starts_at) ?? '';
  if (meet) return meet;
  return start;
}

function isMatchEvent(row) {
  const k = (row.kind || '').toLowerCase();
  const et = (row.event_type || '').toLowerCase();
  return k === 'match' || et === 'game' || et === 'spiel';
}

function isTrainingEvent(row) {
  const k = (row.kind || '').toLowerCase();
  const et = (row.event_type || '').toLowerCase();
  return k === 'training' || et === 'training';
}

/** now ∈ [reminderTime, reminderTime + 10min) */
function isInReminderWindow(now, reminderTime) {
  if (!reminderTime) return false;
  const t = reminderTime.getTime();
  const n = now.getTime();
  return n >= t && n < t + REMINDER_WINDOW_MS;
}

/** Wie mapTeamNotificationSettingsFromDb */
function mapFullSettingsFromDb(raw) {
  if (!raw) {
    return {
      training_enabled: true,
      training_minutes_before: 120,
      match_enabled: true,
      match_minutes_before: 1440,
      match_second_enabled: false,
      match_second_minutes_before: 120,
    };
  }
  return {
    training_enabled: Boolean(raw.training_enabled ?? raw.training_reminder_enabled ?? true),
    training_minutes_before: Number(
      raw.training_minutes_before ?? raw.training_reminder_minutes_before ?? 120,
    ),
    match_enabled: Boolean(raw.match_enabled ?? raw.match_reminder_enabled ?? true),
    match_minutes_before: Number(
      raw.match_minutes_before ?? raw.match_reminder_minutes_before ?? 1440,
    ),
    match_second_enabled: Boolean(
      raw.match_second_enabled ?? raw.match_second_reminder_enabled ?? false,
    ),
    match_second_minutes_before: Number(
      raw.match_second_minutes_before ?? raw.match_second_reminder_minutes_before ?? 120,
    ),
  };
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

async function getTeamIdForSeason(admin, teamSeasonId) {
  const { data: tsRow } = await admin
    .from('team_seasons')
    .select('team_id')
    .eq('id', teamSeasonId)
    .maybeSingle();
  return tsRow && tsRow.team_id != null ? tsRow.team_id : null;
}

async function getSettingsCached(admin, teamSeasonId, cache) {
  if (cache.has(teamSeasonId)) return cache.get(teamSeasonId);
  const { data: row } = await admin
    .from('team_notification_settings')
    .select('*')
    .eq('team_season_id', teamSeasonId)
    .maybeSingle();
  const mapped = mapFullSettingsFromDb(row);
  cache.set(teamSeasonId, mapped);
  return mapped;
}

/**
 * Dedupe: messages (user_id + related_event_id + reminder_key), siehe idx_messages_user_event_reminder_unique
 */
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
 * Pro User: Dedupe → messages.insert → Push an eigenes Abo
 */
async function deliverReminderToTeamSeason(admin, {
  teamSeasonId,
  teamId,
  event,
  reminderKey,
  title,
  body,
  notificationKind,
}) {
  const url = REMINDER_URL.startsWith('/') ? REMINDER_URL : `/${REMINDER_URL}`;
  const contentWithLink = `${body}\n\n${url}`;

  const { data: memRows, error: memErr } = await admin
    .from('memberships')
    .select('user_id')
    .eq('team_season_id', teamSeasonId);
  if (memErr) {
    console.error('[send-reminders] memberships', memErr.message || memErr);
    return { inserted: 0, pushSent: 0, skipped: 0 };
  }

  const userIds = [...new Set((memRows || []).map((m) => m.user_id).filter(Boolean))];
  let inserted = 0;
  let pushSent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    const exists = await messageExists(admin, userId, event.id, reminderKey);
    if (exists) {
      skipped += 1;
      continue;
    }

    const { error: insErr } = await admin.from('messages').insert({
      team_id: teamId,
      user_id: userId,
      title,
      body,
      content: contentWithLink,
      type: 'team_push',
      read: false,
      link: url,
      related_event_id: event.id,
      event_id: event.id,
      reminder_key: reminderKey,
      notification_kind: notificationKind,
    });

    if (insErr) {
      console.error('[send-reminders] messages insert', insErr.message || insErr, {
        userId,
        eventId: event.id,
        reminderKey,
      });
      continue;
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
      await sendOnePush(sub, title, body, url);
      pushSent += 1;
    } catch (e) {
      console.error('[send-reminders] webpush', e && e.message ? e.message : e, { userId });
    }
  }

  return { inserted, pushSent, skipped, userCount: userIds.length };
}

async function runForcedPipelineTest(admin, res) {
  const { data: sub, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .not('endpoint', 'is', null)
    .not('p256dh', 'is', null)
    .not('auth', 'is', null)
    .limit(1)
    .maybeSingle();

  if (subErr) {
    console.error('[forced-test] push_subscriptions', subErr.message || subErr);
    return res.status(500).json({
      ok: false,
      error: subErr.message || 'push_subscriptions query failed',
    });
  }

  if (!sub || !sub.id) {
    return res.status(200).json({
      ok: false,
      error: 'No push subscription found',
    });
  }

  console.log('found subscription', {
    id: sub.id,
    user_id: sub.user_id,
    endpointPreview: String(sub.endpoint || '').slice(0, 72),
  });

  let teamId = null;
  if (sub.user_id) {
    const { data: mem } = await admin
      .from('memberships')
      .select('team_season_id')
      .eq('user_id', sub.user_id)
      .limit(1)
      .maybeSingle();
    if (mem && mem.team_season_id) {
      teamId = await getTeamIdForSeason(admin, mem.team_season_id);
    }
  }

  const url = TEST_LINK.startsWith('/') ? TEST_LINK : `/${TEST_LINK}`;
  const textBody = TEST_NOTIF_BODY;
  const contentWithLink = url ? `${textBody}\n\n${url}` : textBody;
  const inAppTargetTable = 'messages';

  const messagePayload =
    teamId && sub.user_id
      ? {
          team_id: teamId,
          user_id: sub.user_id,
          title: TEST_NOTIF_TITLE,
          body: textBody,
          content: contentWithLink,
          type: 'team_push',
          read: false,
          link: url || null,
        }
      : null;

  console.log('[forced-test] in-app target table:', inAppTargetTable);
  console.log('[forced-test] messages insert payload:', JSON.stringify(messagePayload));

  let inAppInserted = false;
  let messageId = null;
  let messagesInsertError = null;
  if (!messagePayload) {
    messagesInsertError =
      !teamId || !sub.user_id
        ? 'missing team_id (membership/team_seasons) or user_id — cannot insert messages'
        : 'unknown';
    console.error('[forced-test] messages insert skipped:', messagesInsertError);
  } else {
    const { data: msgRows, error: msgErr } = await admin
      .from('messages')
      .insert(messagePayload)
      .select('id');
    if (msgErr) {
      messagesInsertError = msgErr.message || String(msgErr);
      console.error('[forced-test] messages insert error:', messagesInsertError);
    } else {
      inAppInserted = true;
      messageId = msgRows && msgRows[0] ? msgRows[0].id : null;
      console.log('[forced-test] messages insert result:', { ok: true, id: messageId });
    }
  }

  let pushOk = false;
  let pushError = null;
  try {
    ensureVapid();
    const payload = JSON.stringify({
      title: TEST_NOTIF_TITLE,
      body: TEST_NOTIF_BODY,
      url: TEST_LINK,
    });
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload,
      { TTL: 3600 },
    );
    pushOk = true;
    console.log('push result', { ok: true, subscriptionId: sub.id });
  } catch (e) {
    pushError = e && e.message ? e.message : String(e);
    console.error('[forced-test] push result', { ok: false, error: pushError });
  }

  return res.status(200).json({
    ok: Boolean(inAppInserted || pushOk),
    message: 'Forced reminder test sent',
    pushSent: pushOk,
    inAppInserted,
    targetTable: inAppTargetTable,
    subscriptionId: sub.id,
    ...(messageId ? { messageId } : {}),
    ...(messagesInsertError ? { inAppError: messagesInsertError } : {}),
    ...(pushError ? { pushError } : {}),
  });
}

module.exports = async (req, res) => {
  console.log('SEND REMINDERS START');
  console.log('METHOD', req.method);

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const now = new Date();
    console.log('NOW:', now.toISOString());

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

    if (FORCE_REMINDER_PIPELINE_TEST) {
      return runForcedPipelineTest(admin, res);
    }

    const nowIso = now.toISOString();
    const settingsCache = new Map();

    const { data: eventRows, error: qErr } = await admin
      .from('events')
      .select('*')
      .gt('starts_at', nowIso)
      .neq('status', 'canceled')
      .order('starts_at', { ascending: true })
      .limit(500);

    if (qErr) {
      console.error('SEND REMINDERS ERROR', qErr);
      return res.status(500).json({
        ok: false,
        error: qErr.message || 'events query failed',
      });
    }

    const rows = Array.isArray(eventRows) ? eventRows : [];
    const rowById = new Map(rows.map((r) => [r.id, r]));
    console.log('UPCOMING EVENTS', rows.length);

    const dueMatches1 = [];
    const dueMatches2 = [];
    const dueTrainings = [];

    for (const row of rows) {
      const settings = await getSettingsCached(admin, row.team_season_id, settingsCache);
      const baseMatch = safeDate(getBaseTimeIsoMatch(row));
      const baseTrain = safeDate(getBaseTimeIsoTraining(row));

      if (isMatchEvent(row) && baseMatch) {
        if (settings.match_enabled) {
          const r1 = new Date(baseMatch.getTime() - settings.match_minutes_before * 60000);
          if (isInReminderWindow(now, r1)) {
            dueMatches1.push({
              id: row.id,
              team_season_id: row.team_season_id,
              opponent: row.opponent ?? null,
              baseTime: baseMatch.toISOString(),
              reminderAt: r1.toISOString(),
            });
          }
        }
        if (settings.match_second_enabled) {
          const r2 = new Date(
            baseMatch.getTime() - settings.match_second_minutes_before * 60000,
          );
          if (isInReminderWindow(now, r2)) {
            dueMatches2.push({
              id: row.id,
              team_season_id: row.team_season_id,
              opponent: row.opponent ?? null,
              baseTime: baseMatch.toISOString(),
              reminderAt: r2.toISOString(),
            });
          }
        }
      }

      if (isTrainingEvent(row) && baseTrain) {
        if (settings.training_enabled) {
          const rt = new Date(baseTrain.getTime() - settings.training_minutes_before * 60000);
          if (isInReminderWindow(now, rt)) {
            dueTrainings.push({
              id: row.id,
              team_season_id: row.team_season_id,
              opponent: row.opponent ?? null,
              baseTime: baseTrain.toISOString(),
              reminderAt: rt.toISOString(),
            });
          }
        }
      }
    }

    console.log('DUE MATCHES 1', dueMatches1.length);
    console.log('DUE MATCHES 2', dueMatches2.length);
    console.log('DUE TRAININGS', dueTrainings.length);

    let matches1Sent = 0;
    let matches2Sent = 0;
    let trainingsSent = 0;

    async function handleDueList(list, slot, reminderKey, copy, notifKind) {
      for (const item of list) {
        const ev = rowById.get(item.id);
        if (!ev) continue;
        const teamId = await getTeamIdForSeason(admin, ev.team_season_id);
        if (!teamId) {
          console.error('[send-reminders] no team_id for season', ev.team_season_id);
          continue;
        }
        console.log(`SENDING ${slot}`, ev.id, reminderKey);
        const r = await deliverReminderToTeamSeason(admin, {
          teamSeasonId: ev.team_season_id,
          teamId,
          event: ev,
          reminderKey,
          title: copy.title,
          body: copy.body,
          notificationKind: notifKind,
        });
        if (slot === 'match1') matches1Sent += r.inserted;
        if (slot === 'match2') matches2Sent += r.inserted;
        if (slot === 'training') trainingsSent += r.inserted;
        console.log(`[send-reminders] ${slot} result`, r);
      }
    }

    await handleDueList(dueMatches1, 'match1', REMINDER_KEYS.MATCH_1, COPY.match1, 'match');
    await handleDueList(dueMatches2, 'match2', REMINDER_KEYS.MATCH_2, COPY.match2, 'match');
    await handleDueList(dueTrainings, 'training', REMINDER_KEYS.TRAINING, COPY.training, 'training');

    return res.status(200).json({
      ok: true,
      message: 'Reminder scan complete',
      sent: {
        matches1: matches1Sent,
        matches2: matches2Sent,
        trainings: trainingsSent,
      },
      debug: {
        dueMatches1,
        dueMatches2,
        dueTrainings,
      },
    });
  } catch (err) {
    console.error('SEND REMINDERS ERROR', err);
    return res.status(500).json({
      ok: false,
      error: (err && err.message) || 'Unknown error',
    });
  }
};
