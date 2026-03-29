/**
 * Vercel Serverless: POST /api/send-reminders (CommonJS)
 * Scan: Spiele mit Reminder-Fenster; optional Push + In-App (match_reminder).
 */
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const REMINDER_MS = 24 * 60 * 60 * 1000;
const DUE_WINDOW_MS = 10 * 60 * 1000;

const REMINDER_TITLE = '⚽ Spiel Erinnerung';
const REMINDER_BODY = 'Morgen Spiel! Bitte Zu-/Absagen nicht vergessen.';
const REMINDER_URL = '/app/termine';

/** Temporär: Pipeline testen ohne Zeitfenster. `SEND_REMINDERS_FORCE_TEST=false` → normaler Match-Scan. */
const FORCE_REMINDER_PIPELINE_TEST = process.env.SEND_REMINDERS_FORCE_TEST !== 'false';

const TEST_NOTIF_TITLE = '⚽ Test Spiel-Erinnerung';
const TEST_NOTIF_BODY = 'Test: Reminder Pipeline funktioniert.';
/** notifications.link + Push-Payload `url` (wie api/push/send-team Default) */
const TEST_LINK = '/termine';

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

function getBaseTimeIso(row) {
  const meet = nonEmptyIso(row.meetup_at) ?? nonEmptyIso(row.meeting_at);
  const kickoff = nonEmptyIso(row.kickoff_at);
  const start = nonEmptyIso(row.starts_at) ?? '';
  if (meet) return meet;
  if (kickoff) return kickoff;
  return start;
}

/** Wie mapTeamNotificationSettingsFromDb (src/lib/notifications/teamSettings.ts) */
function mapSettingsFromDb(raw) {
  if (!raw) {
    return {
      match_enabled: true,
      match_minutes_before: 1440,
      match_second_enabled: false,
      match_second_minutes_before: 120,
    };
  }
  return {
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

/**
 * Debug: nächstes Spiel + team_notification_settings + Abo (warum ggf. kein Reminder).
 */
async function buildReminderWhyDebug(admin, now, matches) {
  if (!matches || matches.length === 0) {
    return {
      now: now.toISOString(),
      match: null,
      baseTime: null,
      settings: null,
      firstReminder: null,
      secondReminder: null,
      isFirstDue: false,
      isSecondDue: false,
      hasSubscription: false,
      subscription: null,
      reasons: ['Kein kommendes Spiel in events (Filter: match/game, starts_at > now, nicht canceled).'],
      codeNote:
        'Der eigentliche Scan unten nutzt fest 24h vor Basiszeit + 10-Min-Fenster (REMINDER_MS / DUE_WINDOW_MS), unabhängig von team_notification_settings.',
    };
  }

  const match = matches[0];
  console.log('MATCH:', match);

  const meetingIso = nonEmptyIso(match.meetup_at) ?? nonEmptyIso(match.meeting_at);
  const startIso = nonEmptyIso(match.starts_at);
  const meetingTime = meetingIso ? safeDate(meetingIso) : null;
  const startTime = startIso ? safeDate(startIso) : null;

  const baseTime = meetingTime || startTime || null;
  console.log('BASE TIME:', baseTime ? baseTime.toISOString() : null);

  const { data: settingsRow } = await admin
    .from('team_notification_settings')
    .select('*')
    .eq('team_season_id', match.team_season_id)
    .maybeSingle();

  const settings = mapSettingsFromDb(settingsRow);
  console.log('SETTINGS:', settings);

  let firstReminder = null;
  let secondReminder = null;
  if (baseTime) {
    firstReminder = new Date(baseTime.getTime() - settings.match_minutes_before * 60000);
    secondReminder = new Date(baseTime.getTime() - settings.match_second_minutes_before * 60000);
    console.log('FIRST REMINDER:', firstReminder.toISOString());
    console.log('SECOND REMINDER:', secondReminder.toISOString());
  }

  const isFirstDue = Boolean(baseTime && firstReminder && now >= firstReminder);
  const isSecondDue = Boolean(baseTime && secondReminder && now >= secondReminder);

  console.log('isFirstDue:', isFirstDue);
  console.log('isSecondDue:', isSecondDue);

  const { data: subscription } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .not('endpoint', 'is', null)
    .limit(1)
    .maybeSingle();

  console.log('SUBSCRIPTION:', subscription);

  const hasSubscription = Boolean(subscription && subscription.id);

  const reasons = [];
  if (!settings.match_enabled) {
    reasons.push('match_reminder_enabled / match_enabled ist aus — erste Stufe deaktiviert.');
  }
  if (settings.match_second_enabled === false && isSecondDue && !isFirstDue) {
    reasons.push('Zweite Erinnerung in Settings aus (match_second_reminder_enabled).');
  }
  if (baseTime && firstReminder && !isFirstDue && !isSecondDue) {
    reasons.push(
      'Jetzt liegt noch vor den berechneten Reminder-Zeitpunkten (first/second vor baseTime).',
    );
  }
  if (!hasSubscription) {
    reasons.push('Kein Push-Abo in push_subscriptions gefunden (Test-Query limit 1).');
  }
  reasons.push(
    `Hinweis: send-reminders markiert „due“ aktuell nur im ${REMINDER_MS / 3600000}h-vor-Base + ${DUE_WINDOW_MS / 60000}min Fenster — kann von SETTINGS-Minuten abweichen.`,
  );

  return {
    now: now.toISOString(),
    match: {
      id: match.id,
      team_season_id: match.team_season_id,
      start_time: match.starts_at,
      meeting_time: meetingIso || null,
      opponent: match.opponent ?? null,
    },
    baseTime: baseTime ? baseTime.toISOString() : null,
    settings: {
      match_enabled: settings.match_enabled,
      match_minutes_before: settings.match_minutes_before,
      match_second_enabled: settings.match_second_enabled,
      match_second_minutes_before: settings.match_second_minutes_before,
    },
    settingsRow: settingsRow || null,
    firstReminder: firstReminder ? firstReminder.toISOString() : null,
    secondReminder: secondReminder ? secondReminder.toISOString() : null,
    isFirstDue,
    isSecondDue,
    hasSubscription,
    subscription: subscription
      ? {
          id: subscription.id,
          user_id: subscription.user_id,
          endpointPreview: String(subscription.endpoint || '').slice(0, 80),
        }
      : null,
    reasons,
    codeNote:
      'dueMatches im Code: base − 24h, Fenster ±10 min — siehe REMINDER_MS / DUE_WINDOW_MS.',
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

/**
 * POST /api/push/send-team — benötigt User-JWT (Trainer/Admin).
 * Optional: SEND_REMINDERS_PUSH_BEARER_TOKEN + VERCEL_URL.
 */
async function sendTeamPushViaFetch(teamSeasonId, matchId) {
  const rawHost = process.env.VERCEL_URL;
  const bearer = (process.env.SEND_REMINDERS_PUSH_BEARER_TOKEN || '').trim();
  if (!rawHost || !bearer) {
    return { ok: false, skipped: true, reason: 'no_vercel_url_or_bearer' };
  }
  const host = String(rawHost).replace(/^https?:\/\//, '');
  const url = `https://${host}/api/push/send-team`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({
      team_season_id: teamSeasonId,
      recipient_group: 'all',
      title: REMINDER_TITLE,
      body: REMINDER_BODY,
      url: REMINDER_URL,
      related_event_id: matchId,
    }),
  });
  let bodyText = '';
  try {
    bodyText = await res.text();
  } catch (_) {
    bodyText = '';
  }
  let jsonOk = res.ok;
  if (res.ok && bodyText) {
    try {
      const j = JSON.parse(bodyText);
      if (j && j.ok === false) jsonOk = false;
    } catch (_) {
      /* ignore */
    }
  }
  return {
    ok: jsonOk,
    status: res.status,
    bodyPreview: bodyText.slice(0, 400),
  };
}

/** Gleicher Push-Payload wie api/push/send-team (title, body, url). */
async function sendPushInline(admin, teamSeasonId) {
  ensureVapid();
  const { data: memRows, error: memErr } = await admin
    .from('memberships')
    .select('user_id')
    .eq('team_season_id', teamSeasonId);
  if (memErr) {
    console.error('[send-reminders] memberships', memErr.message || memErr);
    return { sent: 0, failed: 0 };
  }
  const userIds = [
    ...new Set((memRows || []).map((m) => m.user_id).filter(Boolean)),
  ];
  if (userIds.length === 0) return { sent: 0, failed: 0 };

  const { data: subRows, error: subErr } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', userIds)
    .not('endpoint', 'is', null);

  if (subErr) {
    console.error('[send-reminders] push_subscriptions', subErr.message || subErr);
    return { sent: 0, failed: 0 };
  }

  const rows = (subRows || []).filter((r) => r.endpoint && r.p256dh && r.auth);
  const payload = JSON.stringify({
    title: REMINDER_TITLE,
    body: REMINDER_BODY,
    url: REMINDER_URL,
  });

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload,
        { TTL: 3600 },
      );
      sent += 1;
    } catch (e) {
      failed += 1;
      console.error('[send-reminders] webpush error', e && e.message ? e.message : e);
    }
  }
  return { sent, failed };
}

/**
 * Ein Abo + eine notifications-Zeile + ein Push (gleicher Mechanismus wie send-team Payload).
 */
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
      const { data: tsRow } = await admin
        .from('team_seasons')
        .select('team_id')
        .eq('id', mem.team_season_id)
        .maybeSingle();
      if (tsRow && tsRow.team_id != null) teamId = tsRow.team_id;
    }
  }

  const notificationPayload = {
    team_id: teamId,
    user_id: sub.user_id || null,
    title: TEST_NOTIF_TITLE,
    message: TEST_NOTIF_BODY,
    link: TEST_LINK,
    type: 'auto',
    read: false,
  };

  const { data: insRows, error: insErr } = await admin
    .from('notifications')
    .insert(notificationPayload)
    .select('id');

  let notificationInserted = false;
  let notificationId = null;
  if (insErr) {
    console.error('[forced-test] notification insert', insErr.message || insErr);
  } else {
    notificationInserted = true;
    notificationId = insRows && insRows[0] ? insRows[0].id : null;
    console.log('notification insert result', { ok: true, id: notificationId });
  }

  let pushAttempted = false;
  let pushOk = false;
  let pushError = null;
  try {
    pushAttempted = true;
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
    ok: Boolean(notificationInserted || pushOk),
    message: 'Forced reminder test sent',
    notificationInserted,
    pushAttempted,
    subscriptionId: sub.id,
    ...(notificationId ? { notificationId } : {}),
    ...(insErr ? { notificationError: insErr.message || String(insErr) } : {}),
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

    const { data: rows, error: qErr } = await admin
      .from('events')
      .select('*')
      .or('kind.eq.match,event_type.eq.game,event_type.eq.spiel')
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

    const matches = Array.isArray(rows) ? rows : [];
    console.log('MATCH COUNT', matches.length);

    const debug = await buildReminderWhyDebug(admin, now, matches);

    const dueMatches = [];
    const windowStart = now.getTime() - DUE_WINDOW_MS;
    const windowEnd = now.getTime() + DUE_WINDOW_MS;

    for (const row of matches) {
      const baseIso = getBaseTimeIso(row);
      const base = safeDate(baseIso);
      if (!base) continue;

      const reminderAt = new Date(base.getTime() - REMINDER_MS);
      const t = reminderAt.getTime();
      if (t >= windowStart && t <= windowEnd) {
        dueMatches.push({
          id: row.id,
          team_season_id: row.team_season_id,
          opponent: row.opponent ?? null,
          base_time: base.toISOString(),
          reminder_at: reminderAt.toISOString(),
          reminder_due: true,
        });
      }
    }

    console.log('DUE MATCHES', dueMatches);

    const results = [];
    for (const match of dueMatches) {
      console.log('SENDING REMINDER FOR MATCH', match.id);

      const { data: dup, error: dupErr } = await admin
        .from('notifications')
        .select('id')
        .eq('event_id', match.id)
        .eq('event_type', 'match_reminder')
        .limit(1)
        .maybeSingle();

      if (dupErr) {
        console.error('[send-reminders] dedupe query', dupErr.message || dupErr);
      }
      if (dup && dup.id) {
        results.push({ matchId: match.id, skipped: true, reason: 'already_sent' });
        continue;
      }

      const { data: tsRow, error: tsErr } = await admin
        .from('team_seasons')
        .select('team_id')
        .eq('id', match.team_season_id)
        .maybeSingle();

      if (tsErr || !tsRow || tsRow.team_id == null) {
        console.error('[send-reminders] team_seasons', tsErr || 'no team_id');
        results.push({
          matchId: match.id,
          error: 'team_id_resolve_failed',
        });
        continue;
      }

      const teamId = tsRow.team_id;

      let pushResult = { via: 'none', sent: 0 };
      const fetchResult = await sendTeamPushViaFetch(
        match.team_season_id,
        match.id,
      );
      if (fetchResult.ok) {
        console.log('PUSH SENT', { via: 'fetch', matchId: match.id, status: fetchResult.status });
        pushResult = { via: 'fetch', status: fetchResult.status };
      } else {
        try {
          const inline = await sendPushInline(admin, match.team_season_id);
          console.log('PUSH SENT', {
            via: 'inline',
            matchId: match.id,
            sent: inline.sent,
            failed: inline.failed,
          });
          pushResult = { via: 'inline', ...inline };
        } catch (pushErr) {
          console.error('SEND REMINDERS ERROR', pushErr);
          pushResult = {
            via: 'inline',
            error: pushErr && pushErr.message ? pushErr.message : String(pushErr),
          };
        }
      }

      const { error: insErr } = await admin.from('notifications').insert({
        team_id: teamId,
        event_id: match.id,
        title: REMINDER_TITLE,
        message: REMINDER_BODY,
        link: REMINDER_URL,
        type: 'auto',
        event_type: 'match_reminder',
        read: false,
      });

      if (insErr) {
        console.error('[send-reminders] notifications insert', insErr.message || insErr);
        results.push({
          matchId: match.id,
          pushResult,
          notificationInserted: false,
          error: insErr.message || String(insErr),
        });
        continue;
      }

      console.log('NOTIFICATION INSERTED', match.id);
      results.push({
        matchId: match.id,
        pushResult,
        notificationInserted: true,
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Match reminders sent',
      processed: dueMatches.length,
      scanned: matches.length,
      matches: dueMatches,
      results,
      debug,
    });
  } catch (err) {
    console.error('SEND REMINDERS ERROR', err);
    return res.status(500).json({
      ok: false,
      error: (err && err.message) || 'Unknown error',
    });
  }
};
