/**
 * Vercel: POST /api/send-reminders (CommonJS)
 * Verarbeitet fällige `notification_jobs` → `notifications` + Web Push über `push_subscriptions`
 * (gleicher Pfad wie Team-Push / Direkt-Push).
 *
 * Nur einen Cron einplanen (dieser Endpoint **oder** Supabase Edge `send-reminders`), sonst Doppelversand.
 */
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
const { assertStagingSafeToRunOutbound } = require('../../lib/stagingGuards');

/** Idempotente Batches; mehrfaches Aufrufen möglich (Claim + messages-Dedupe). */
const JOB_BATCH_LIMIT = 50;
/** Keine alten Reminder nach einem Cron-Ausfall gesammelt nachsenden. */
const MAX_REMINDER_DELAY_MS = 2 * 60 * 60 * 1000;

function formatTimeDe(iso) {
  if (!iso) return '--:--';
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: 'Europe/Vienna',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
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

function settingBool(row, longKey, shortKey, fallback) {
  const value = row?.[longKey] ?? row?.[shortKey];
  return value == null ? fallback : value === true || value === 'true' || value === 1;
}

function settingMinutes(row, longKey, shortKey, fallback) {
  const value = Number(row?.[longKey] ?? row?.[shortKey]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function zonedParts(instant) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** 11:00 Europe/Vienna am lokalen Kalendertag des Termins als UTC-Instant. */
function trainingReminderAt(eventStartIso) {
  const eventParts = zonedParts(new Date(eventStartIso));
  const wallClockUtc = Date.UTC(
    Number(eventParts.year),
    Number(eventParts.month) - 1,
    Number(eventParts.day),
    11,
  );
  const probe = new Date(wallClockUtc);
  const probeParts = zonedParts(probe);
  const representedAsUtc = Date.UTC(
    Number(probeParts.year),
    Number(probeParts.month) - 1,
    Number(probeParts.day),
    Number(probeParts.hour),
    Number(probeParts.minute),
    Number(probeParts.second),
  );
  return new Date(wallClockUtc - (representedAsUtc - wallClockUtc)).toISOString();
}

/**
 * Selbstheilung, falls der DB-Trigger bei älteren/extern importierten Terminen keinen Job angelegt hat.
 * Standard: Training am Tag um 11:00 Wien; Match 48h und 24h vorher.
 */
async function ensureUpcomingReminderJobs(admin) {
  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error: eventsErr } = await admin
    .from('events')
    .select('id, team_season_id, starts_at, status, type, kind')
    .or('status.eq.upcoming,status.is.null')
    .gt('starts_at', now.toISOString())
    .lte('starts_at', horizon)
    .limit(500);
  if (eventsErr) throw eventsErr;
  if (!events?.length) return { inserted: 0, normalized: 0 };

  const seasonIds = [...new Set(events.map((event) => event.team_season_id).filter(Boolean))];
  if (!seasonIds.length) return { inserted: 0, normalized: 0 };
  const eventIds = events.map((event) => event.id);
  const [{ data: seasons, error: seasonsErr }, { data: settings, error: settingsErr }, { data: jobs, error: jobsErr }] =
    await Promise.all([
      admin.from('team_seasons').select('id, team_id').in('id', seasonIds),
      admin.from('team_notification_settings').select('*').in('team_season_id', seasonIds),
      admin.from('notification_jobs').select('id, event_id, kind, dedupe_key, status').in('event_id', eventIds),
    ]);
  if (seasonsErr) throw seasonsErr;
  if (settingsErr) throw settingsErr;
  if (jobsErr) throw jobsErr;

  const teamBySeason = new Map((seasons || []).map((row) => [row.id, row.team_id]));
  const settingsBySeason = new Map((settings || []).map((row) => [row.team_season_id, row]));
  const jobsByEvent = new Map();
  for (const job of jobs || []) {
    const list = jobsByEvent.get(job.event_id) || [];
    list.push(job);
    jobsByEvent.set(job.event_id, list);
  }

  let inserted = 0;
  let normalized = 0;
  for (const event of events) {
    const teamId = teamBySeason.get(event.team_season_id);
    if (!teamId) continue;
    const row = settingsBySeason.get(event.team_season_id);
    const rawType = String(event.type || event.kind || '').toLowerCase();
    const kind = rawType === 'training' ? 'training' : rawType === 'event' || rawType === 'other' ? rawType : 'match';
    const existing = jobsByEvent.get(event.id) || [];

    if (kind === 'training' && settingBool(row, 'training_reminder_enabled', 'training_enabled', true)) {
      const sendAt = trainingReminderAt(event.starts_at);
      if (Date.parse(sendAt) < now.getTime() - MAX_REMINDER_DELAY_MS) continue;
      const dedupeKey = `event:${event.id}:training_day_1100`;
      const completed = existing.some(
        (job) => job.kind === 'training' && (job.status === 'sent' || job.status === 'processing'),
      );
      const current =
        existing.find(
          (job) => job.dedupe_key === dedupeKey && (job.status === 'pending' || job.status === 'failed'),
        ) ||
        existing.find(
          (job) => job.kind === 'training' && (job.status === 'pending' || job.status === 'failed'),
        );
      const payload = {
        reminderKey: 'training_day_1100',
        reminder_type: 'training_day_1100',
        offsetMinutes: 0,
        schedule: 'training_day_1100',
        baseTimeIso: event.starts_at,
      };
      if (completed) {
        continue;
      }
      if (current) {
        const { error } = await admin.from('notification_jobs').update({
          send_at: sendAt,
          status: 'pending',
          dedupe_key: dedupeKey,
          payload,
          updated_at: now.toISOString(),
        }).eq('id', current.id);
        if (error) throw error;
        normalized += 1;
      } else if (!current) {
        const { error } = await admin.from('notification_jobs').insert({
          event_id: event.id,
          team_id: teamId,
          kind: 'training',
          send_at: sendAt,
          payload,
          status: 'pending',
          dedupe_key: dedupeKey,
        });
        if (error && error.code !== '23505') throw error;
        if (!error) inserted += 1;
      }
      continue;
    }

    if (kind !== 'match') continue;
    const baseMs = Date.parse(event.starts_at);
    const slots = [];
    if (settingBool(row, 'match_reminder_enabled', 'match_enabled', true)) {
      slots.push(['match', settingMinutes(row, 'match_reminder_minutes_before', 'match_minutes_before', 2880)]);
    }
    if (settingBool(row, 'match_second_reminder_enabled', 'match_second_enabled', true)) {
      slots.push(['match_second', settingMinutes(row, 'match_second_reminder_minutes_before', 'match_second_minutes_before', 1440)]);
    }
    const expectedDedupeKeys = new Set(
      slots.map(([slot, minutes]) => `event:${event.id}:${slot}_${minutes}`),
    );
    const obsoleteIds = existing
      .filter(
        (job) =>
          job.kind === 'match' &&
          (job.status === 'pending' || job.status === 'failed') &&
          String(job.dedupe_key || '').startsWith(`event:${event.id}:match`) &&
          !expectedDedupeKeys.has(job.dedupe_key),
      )
      .map((job) => job.id);
    if (obsoleteIds.length) {
      const { error } = await admin.from('notification_jobs').delete().in('id', obsoleteIds);
      if (error) throw error;
      console.log('[reminderPipeline] obsolete match reminders removed', {
        eventId: event.id,
        removed: obsoleteIds.length,
      });
    }

    for (const [slot, minutes] of slots) {
      const reminderKey = `${slot}_${minutes}`;
      const dedupeKey = `event:${event.id}:${reminderKey}`;
      if (existing.some((job) => job.dedupe_key === dedupeKey)) continue;
      const idealMs = baseMs - minutes * 60 * 1000;
      if (idealMs < now.getTime() - MAX_REMINDER_DELAY_MS) continue;
      const sendAt = new Date(Math.max(idealMs, now.getTime() + 2 * 60 * 1000)).toISOString();
      const { error } = await admin.from('notification_jobs').insert({
        event_id: event.id,
        team_id: teamId,
        kind: 'match',
        send_at: sendAt,
        payload: { reminderKey, reminder_type: reminderKey, offsetMinutes: minutes, baseTimeIso: event.starts_at },
        status: 'pending',
        dedupe_key: dedupeKey,
      });
      if (error && error.code !== '23505') throw error;
      if (!error) inserted += 1;
    }
  }
  console.log('[reminderPipeline] reconciliation complete', { inserted, normalized });
  return { inserted, normalized };
}

function reminderAppDeepLink(kind, event) {
  const mid = event.match_id;
  if (kind === 'match' && mid) return `/app/match/${mid}`;
  if (kind === 'match') return `/app/events/${event.id}`;
  return `/app/events/${event.id}`;
}

function formatDateShortDeVienna(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('de-AT', {
      timeZone: 'Europe/Vienna',
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
    });
  } catch (_) {
    return '';
  }
}

/** Kurze iPhone-ähnliche Texte für In-App + Push. */
function buildReminderUxCopy(kind, event, reminderKey) {
  const meetOrStart =
    event.meeting_at && String(event.meeting_at).trim() ? event.meeting_at : event.starts_at;
  const timeStr = formatTimeDe(meetOrStart);
  if (kind === 'match') {
    const opp = (event.opponent || '').trim();
    const gegner = opp || 'Gegner';
    const title = `⚽ Spiel gegen ${gegner}`;
    const isSecond =
      reminderKey === 'match_reminder_2' ||
      reminderKey === 'match_second_reminder' ||
      (typeof reminderKey === 'string' && reminderKey.includes('second'));
    const message = isSecond
      ? `Heute ${timeStr} – Gleich Treffpunkt`
      : `Heute ${timeStr} – Treffpunkt nicht vergessen`;
    return { title, message };
  }
  if (kind === 'training') {
    return { title: 'Training', message: `Heute ${timeStr} – Treffpunkt nicht vergessen` };
  }
  const dateStr = formatDateShortDeVienna(event.starts_at);
  const startTime = formatTimeDe(event.starts_at);
  return { title: 'Termin', message: `${dateStr} ${startTime} – Treffpunkt nicht vergessen` };
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

function reminderNotificationDedupeFingerprint(jobId, userId) {
  return `job:${jobId}:user:${userId}`;
}

/** Stabile Deduplizierung (erstes Vorkommen), analog zu src/lib/notifications/pending.ts */
function dedupeRecipientUserIds(ids) {
  const out = [];
  const seen = new Set();
  for (const raw of ids || []) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function fetchReminderRecipientUserIdsForTeamSeason(admin, teamSeasonId) {
  const { data: rpcRows, error: rpcErr } = await admin.rpc('distinct_reminder_recipient_user_ids', {
    p_team_season_id: teamSeasonId,
  });

  let ids = [];
  if (rpcErr) {
    console.warn('[notificationsDedup] distinct_reminder_recipient_user_ids RPC failed, fallback memberships', {
      teamSeasonId,
      message: rpcErr.message,
    });
    const { data: members, error } = await admin
      .from('memberships')
      .select('user_id')
      .eq('team_season_id', teamSeasonId)
      .in('role', REMINDER_TEAM_ROLES);
    if (error) throw error;
    ids = (members || []).map((m) => m.user_id).filter(Boolean);
  } else {
    ids = (rpcRows || []).map((r) => r.user_id).filter(Boolean);
  }

  const fromQueryCount = ids.length;
  const out = dedupeRecipientUserIds(ids);
  console.log('[notificationsDedup] recipients from memberships', {
    teamSeasonId,
    rowOrDistinctCount: fromQueryCount,
    afterClientDedupe: out.length,
  });
  return out;
}

/** Empfänger für Termin-Reminder: nur Eltern/Spieler, deren Spieler noch keine Rückmeldung hat. */
async function fetchOpenRsvpRecipientUserIds(admin, event) {
  let rosterPlayerIds = [];
  const { data: rosterRows, error: rosterErr } = await admin
    .from('team_season_players')
    .select('player_id, status, is_active')
    .eq('team_season_id', event.team_season_id);

  if (!rosterErr) {
    rosterPlayerIds = (rosterRows || [])
      .filter((row) => row.is_active !== false && String(row.status || 'active').toLowerCase() === 'active')
      .map((row) => row.player_id)
      .filter(Boolean);
  } else {
    console.warn('[reminderPipeline] roster mapping fallback to players', rosterErr.message);
    const { data: playerRows, error: playersErr } = await admin
      .from('players')
      .select('id, status, is_active')
      .eq('team_season_id', event.team_season_id);
    if (playersErr) throw playersErr;
    rosterPlayerIds = (playerRows || [])
      .filter((row) => row.is_active !== false && String(row.status || 'active').toLowerCase() === 'active')
      .map((row) => row.id)
      .filter(Boolean);
  }

  rosterPlayerIds = [...new Set(rosterPlayerIds)];
  if (!rosterPlayerIds.length) return [];

  const { data: attendanceRows, error: attendanceErr } = await admin
    .from('event_attendance')
    .select('player_id')
    .eq('event_id', event.id)
    .in('player_id', rosterPlayerIds);
  if (attendanceErr) throw attendanceErr;

  const answered = new Set((attendanceRows || []).map((row) => row.player_id).filter(Boolean));
  const openPlayerIds = rosterPlayerIds.filter((playerId) => !answered.has(playerId));
  if (!openPlayerIds.length) return [];

  const [{ data: guardianRows, error: guardianErr }, { data: playerUserRows, error: playerUsersErr }] =
    await Promise.all([
      admin.from('player_guardians').select('user_id').in('player_id', openPlayerIds),
      admin.from('player_users').select('user_id').in('player_id', openPlayerIds),
    ]);
  if (guardianErr) throw guardianErr;
  if (playerUsersErr) throw playerUsersErr;

  const recipients = dedupeRecipientUserIds([
    ...(guardianRows || []).map((row) => row.user_id),
    ...(playerUserRows || []).map((row) => row.user_id),
  ]);
  console.log('[reminderPipeline] open RSVP recipients resolved', {
    eventId: event.id,
    rosterCount: rosterPlayerIds.length,
    answeredCount: answered.size,
    openCount: openPlayerIds.length,
    recipientCount: recipients.length,
  });
  return recipients;
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

async function completeJob(admin, jobId) {
  const sentAt = new Date().toISOString();
  const { error } = await admin
    .from('notification_jobs')
    .update({
      status: 'sent',
      sent_at: sentAt,
      last_error: null,
      updated_at: sentAt,
    })
    .eq('id', jobId)
    .eq('status', 'processing');
  if (!error) {
    console.log('[notificationJobsWorker] status → sent', { jobId, sent_at: sentAt });
  }
  return error;
}

/**
 * Nach claim_notification_job ist attempt_count bereits erhöht.
 * Bei Fehler: zurück auf pending solange Versuche < 3, sonst failed.
 */
async function failJobWithRetry(admin, job, err) {
  const lastErr = String(err).slice(0, 2000);
  const ac = job.attempt_count ?? 0;
  if (ac < 3) {
    const { error } = await admin
      .from('notification_jobs')
      .update({
        status: 'pending',
        last_error: lastErr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('status', 'processing');
    if (!error) {
      console.log('[notificationJobsWorker] status → pending (retry)', { jobId: job.id, attempt_count: ac });
    }
  } else {
    const { error } = await admin
      .from('notification_jobs')
      .update({
        status: 'failed',
        last_error: lastErr,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('status', 'processing');
    if (!error) {
      console.log('[notificationJobsWorker] status → failed', { jobId: job.id, attempt_count: ac });
    }
  }
}

function pushIsGoneError(err) {
  const code = Number(err && err.statusCode);
  const status = Number(err && err.status);
  return code === 404 || code === 410 || status === 404 || status === 410;
}

async function countUnreadNotificationsForUser(admin, userId) {
  const { count, error } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count ?? 0;
}

async function sendPushesForUser(admin, userId, title, body, url, appBadgeCount, tag, eventId) {
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
  let path =
    typeof url === 'string' && url.trim()
      ? url.trim().startsWith('/')
        ? url.trim()
        : `/${url.trim()}`
      : '/app/termine';
  if (path === '/termine' || path.startsWith('/termine?') || path.startsWith('/termine#')) {
    path = `/app/termine${path.slice('/termine'.length)}`;
  }
  const pushTag =
    typeof tag === 'string' && tag.trim() ? tag.trim() : `push-${userId}-${Date.now()}`;
  const evId = typeof eventId === 'string' && eventId.trim() ? eventId.trim() : '';
  const payloadObj = {
    title: title && String(title).trim() ? String(title).trim() : 'SpielzeitApp',
    body: body && String(body).trim() ? String(body).trim() : 'Neue Benachrichtigung',
    url: path,
    tag: pushTag,
    requireInteraction: true,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: { url: path, kind: 'reminder', ...(evId ? { event_id: evId } : {}) },
  };
  if (typeof appBadgeCount === 'number' && Number.isFinite(appBadgeCount)) {
    const c = Math.min(99, Math.max(0, Math.floor(appBadgeCount)));
    payloadObj.appBadgeCount = c;
    payloadObj.unread_count = c;
    payloadObj.badge_count = c;
    payloadObj.data = {
      url: path,
      kind: 'reminder',
      unread_count: c,
      badge_count: c,
      ...(evId ? { event_id: evId } : {}),
    };
  }
  const payload = JSON.stringify(payloadObj);
  let sent = 0;
  let removed = 0;
  for (const row of subscriptions) {
    const endpoint = row.endpoint || '';
    const p256dh = row.p256dh || '';
    const auth = row.auth || '';
    if (!endpoint || !p256dh || !auth) continue;
    try {
      await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, payload, { TTL: 86400 });
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
 * Matchday-Auto (`automation: matchday_post`): eigener Text/Link; Status upcoming oder live.
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

  const rawPayload = job.payload && typeof job.payload === 'object' ? job.payload : {};
  const isMatchday = rawPayload.automation === 'matchday_post';
  const isCarpool = rawPayload.automation === 'carpool';

  let title;
  let textBody;
  let url;
  let eventType;
  let pushTagSuffix;

  if (isMatchday || isCarpool) {
    const st = String(event.status || 'upcoming').toLowerCase();
    if (st === 'finished' || st === 'canceled' || st === 'cancelled') {
      console.log('[reminderPipeline] automation skip: event finished/canceled', {
        jobId: job.id,
        eventId: job.event_id,
      });
      await completeJob(admin, job.id);
      return { ok: true, skipped: 'automation_event_done' };
    }
    if (!isCarpool && st !== 'upcoming' && st !== 'live') {
      await completeJob(admin, job.id);
      return { ok: true, skipped: 'matchday_bad_status' };
    }
    title =
      typeof rawPayload.pushTitle === 'string' && rawPayload.pushTitle.trim()
        ? rawPayload.pushTitle.trim()
        : isCarpool
          ? 'Fahrgemeinschaft'
          : 'Matchday';
    textBody = typeof rawPayload.pushBody === 'string' ? rawPayload.pushBody : '';
    url =
      typeof rawPayload.linkPath === 'string' && rawPayload.linkPath.trim()
        ? rawPayload.linkPath.trim()
        : reminderAppDeepLink(job.kind, event);
    if (!url.startsWith('/')) url = `/${url}`;
    eventType = isCarpool ? 'carpool' : 'matchday';
    pushTagSuffix = isCarpool ? 'carpool' : 'matchday';
  } else {
    const payload = parseJobPayload(job.payload);
    if (!payload) {
      const err = new Error('invalid job payload');
      await failJobWithRetry(admin, job, err.message);
      return { ok: false, error: err.message };
    }
    if ((event.status ?? 'upcoming') !== 'upcoming') {
      console.log('[reminderPipeline] skip: event not upcoming', { jobId: job.id, eventId: job.event_id });
      await completeJob(admin, job.id);
      return { ok: true, skipped: 'event_not_upcoming' };
    }
    const built = buildReminderUxCopy(job.kind, event, payload.reminderKey);
    title = built.title;
    textBody = built.message;
    url = reminderAppDeepLink(job.kind, event);
    eventType = 'reminder';
    pushTagSuffix = payload.reminderKey;
  }

  let recipients;
  const targetedRecipients = Array.isArray(rawPayload.recipientUserIds)
    ? rawPayload.recipientUserIds.filter((value) => typeof value === 'string' && value.trim())
    : [];
  if (isCarpool && targetedRecipients.length > 0) {
    recipients = targetedRecipients;
  } else {
    try {
      recipients =
        !isMatchday && !isCarpool
          ? await fetchOpenRsvpRecipientUserIds(admin, event)
          : await fetchReminderRecipientUserIdsForTeamSeason(admin, event.team_season_id);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      await failJobWithRetry(admin, job, msg);
      return { ok: false, error: msg };
    }
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

  const recipientCountBeforeDedupe = recipients.length;
  recipients = dedupeRecipientUserIds(recipients);
  console.log('[notificationsDedup] job recipients', {
    jobId: job.id,
    eventId: job.event_id,
    rawCount: recipientCountBeforeDedupe,
    afterDedupeCount: recipients.length,
  });

  /** Pro Job ein Dispatch-Log pro User; verhindert Doppel-Inserts bei abweichenden Payload-reminder_keys. */
  const dispatchLogReminderKey = `job:${job.id}`;

  let inserted = 0;
  let pushSent = 0;

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
      if (logInsErr.code === '23505') {
        console.log('[notificationsDedup] dispatch_log insert skipped (duplicate)', {
          jobId: job.id,
          userId,
          reminderKey: dispatchLogReminderKey,
        });
        continue;
      }
      throw new Error(logInsErr.message || String(logInsErr));
    }
    const logId = logRow && logRow.id;
    if (!logId) continue;

    const { error: insErr } = await admin.from('notifications').insert({
      team_id: job.team_id,
      user_id: userId,
      event_id: job.event_id,
      title,
      message: textBody,
      type: 'auto',
      event_type: eventType,
      read: false,
      link: url,
      source_notification_job_id: job.id,
    });

    if (insErr) {
      if (insErr.code === '23505') {
        console.log('[notificationsDedup] notification insert skipped (idempotent unique)', {
          jobId: job.id,
          userId,
          fingerprint: reminderNotificationDedupeFingerprint(job.id, userId),
        });
        continue;
      }
      await admin.from('notification_dispatch_log').delete().eq('id', logId);
      throw new Error(insErr.message || String(insErr));
    }
    inserted += 1;
    console.log('[notificationsDedup] notification inserted', { jobId: job.id, userId });
    console.log('[reminderPipeline] notifications row created', { jobId: job.id, userId, eventId: job.event_id });

    const unreadForBadge = await countUnreadNotificationsForUser(admin, userId);
    const rk = String(pushTagSuffix || 'r').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
    const pushTag = isMatchday
      ? `spz-matchday-${job.event_id}`
      : isCarpool
        ? `spz-carpool-${job.id}`
        : `spz-reminder-${job.event_id}-${rk}`;
    const pushRes = await sendPushesForUser(
      admin,
      userId,
      title,
      textBody,
      url,
      unreadForBadge,
      pushTag,
      job.event_id,
    );
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

/**
 * Fällige Jobs: send_at <= now (UTC), status = pending.
 * Claim über DB-RPC claim_notification_job (attempt_count++, Status processing).
 */
async function runNotificationJobsWorker(admin) {
  const reconciliation = await ensureUpcomingReminderJobs(admin);
  const nowIso = new Date().toISOString();

  const { count: pendingTotal, error: countErr } = await admin
    .from('notification_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('send_at', nowIso);

  if (countErr) {
    console.warn('[notificationJobsWorker] pending count query', countErr.message);
  }

  console.log('[notificationJobsWorker] utc now', nowIso, {
    pendingDueOrBeforeNow: pendingTotal ?? null,
    note: 'Spalte send_at (nicht scheduled_for); Vergleich mit UTC-ISO',
  });

  const { data: jobIds, error: qErr } = await admin
    .from('notification_jobs')
    .select('id, send_at, event_id, status')
    .eq('status', 'pending')
    .lte('send_at', nowIso)
    .order('send_at', { ascending: true })
    .limit(JOB_BATCH_LIMIT);

  if (qErr) {
    console.error('[notificationJobsWorker] due query failed', qErr);
    throw new Error(qErr.message || 'due query failed');
  }

  const ids = (jobIds || []).map((r) => r.id).filter(Boolean);
  console.log('[reminderPipeline] due jobs selected', {
    nowIso,
    nowVienna: viennaDateTimeDebug(nowIso),
    dueCount: ids.length,
    ids,
    jobs: (jobIds || []).map((r) => ({
      id: r.id,
      send_at_utc: r.send_at,
      send_at_vienna: viennaDateTimeDebug(r.send_at),
      event_id: r.event_id,
    })),
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const id of ids) {
    const { data: claimedRows, error: claimErr } = await admin.rpc('claim_notification_job', { p_job_id: id });

    if (claimErr) {
      console.error('[notificationJobsWorker] claim rpc failed', { jobId: id, error: claimErr.message });
      failed += 1;
      continue;
    }

    const arr =
      claimedRows == null ? [] : Array.isArray(claimedRows) ? claimedRows : [claimedRows];
    const claimed = arr[0] ?? null;
    if (!claimed) {
      console.log('[notificationJobsWorker] claim skipped (not due, max attempts, or race)', {
        jobId: id,
        nowUtc: nowIso,
      });
      continue;
    }

    console.log('[notificationJobsWorker] status → processing', {
      jobId: claimed.id,
      attempt_count: claimed.attempt_count,
      send_at_utc: claimed.send_at,
    });

    processed += 1;
    const job = claimed;
    const scheduledAt = Date.parse(String(job.send_at || ''));
    if (Number.isFinite(scheduledAt) && Date.now() - scheduledAt > MAX_REMINDER_DELAY_MS) {
      console.warn('[send-reminders] stale job skipped', {
        jobId: job.id,
        send_at_utc: job.send_at,
      });
      await completeJob(admin, job.id);
      continue;
    }
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

  return { processed, sent, failed, errors, reconciliation };
}

module.exports = async (req, res) => {
  console.log('SEND REMINDERS START', { method: req.method });

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const stagingGate = assertStagingSafeToRunOutbound();
    if (stagingGate.blocked) {
      console.warn('[send-reminders] blocked', stagingGate.reason);
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: stagingGate.reason,
        processed: 0,
        sent: 0,
        failed: 0,
      });
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

    const { processed, sent, failed, errors, reconciliation } = await runNotificationJobsWorker(admin);

    return res.status(200).json({
      ok: true,
      message: 'Reminder jobs processed',
      processed,
      sent,
      failed,
      reconciliation,
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
