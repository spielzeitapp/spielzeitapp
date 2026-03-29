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

module.exports = async (req, res) => {
  console.log('SEND REMINDERS START');
  console.log('METHOD', req.method);

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const now = new Date();
    console.log('NOW', now.toISOString());

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
    });
  } catch (err) {
    console.error('SEND REMINDERS ERROR', err);
    return res.status(500).json({
      ok: false,
      error: (err && err.message) || 'Unknown error',
    });
  }
};
