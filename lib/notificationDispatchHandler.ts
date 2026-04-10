import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { getPendingNotifications, type PendingNotificationItem } from '../src/lib/notifications';
import { processPushAutomations, type PushAutomationResult } from './pushAutomationDispatch';
import { buildWebPushJsonPayload } from './webPushPayload';

function readEnv(key: string): string | undefined {
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.[key];
}

function getSupabaseUrl(): string | undefined {
  return readEnv('SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
}

let vapidConfigured = false;

function ensureWebPushVapid(): void {
  if (vapidConfigured) return;
  const publicKey = readEnv('VAPID_PUBLIC_KEY')?.trim();
  const privateKey = readEnv('VAPID_PRIVATE_KEY')?.trim();
  const subject = readEnv('VAPID_SUBJECT')?.trim();
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY und VAPID_SUBJECT müssen gesetzt sein (Web Push; kein NEXT_PUBLIC_/VITE_ auf dem Server).',
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export function verifyCronAuth(request: Request): boolean {
  const secret =
    readEnv('CRON_SECRET') ||
    readEnv('NOTIFICATION_DISPATCH_SECRET') ||
    readEnv('REMINDER_PROCESS_SECRET');
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  const bearer = auth?.replace(/^Bearer\s+/i, '').trim();
  if (bearer === secret) return true;
  const h = request.headers.get('x-cron-secret');
  return h === secret;
}

export type DispatchResult = {
  ok: boolean;
  dryRun?: boolean;
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
  details: Array<{ userId: string; eventId: string; type: string; status: string }>;
  pushAutomations?: PushAutomationResult;
};

/**
 * Zentrale Reminder-Verarbeitung (Cron / manueller Aufruf).
 */
export async function processDueReminders(
  admin: SupabaseClient,
  now: Date,
  dryRun: boolean,
): Promise<DispatchResult> {
  const result: DispatchResult = {
    ok: true,
    dryRun,
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  let pending: PendingNotificationItem[];
  try {
    pending = await getPendingNotifications(admin, now);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.ok = false;
    result.errors.push(msg);
    return result;
  }

  result.processed = pending.length;

  if (dryRun) {
    for (const p of pending) {
      result.details.push({
        userId: p.userId,
        eventId: p.eventId,
        type: p.reminderKey,
        status: 'dry_run',
      });
    }
    return result;
  }

  for (const item of pending) {
    try {
      const sendResult = await sendPendingNotificationReminder(admin, item);
      result.sent += sendResult.sent;
      result.skipped += sendResult.skipped;
      result.details.push(...sendResult.details);
      if (sendResult.errors.length) result.errors.push(...sendResult.errors);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(msg);
      result.details.push({
        userId: item.userId,
        eventId: item.eventId,
        type: item.reminderKey,
        status: `error: ${msg}`,
      });
    }
  }

  return result;
}

/**
 * POST /api/notifications/dispatch
 * Header: Authorization: Bearer <CRON_SECRET> oder x-cron-secret
 */
export async function handleNotificationDispatch(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  if (!verifyCronAuth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server: Supabase Service Role fehlt' }), { status: 500 });
  }

  let dryRun = false;
  try {
    const body = await request.json().catch(() => ({}));
    dryRun = Boolean((body as { dryRun?: boolean }).dryRun);
  } catch {
    dryRun = false;
  }

  const admin: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const result = await processDueReminders(admin, now, dryRun);

  let pushAutomations: PushAutomationResult = {
    automationsFound: 0,
    messagesSent: 0,
    pushNotificationsSent: 0,
    errors: [],
  };
  try {
    pushAutomations = await processPushAutomations(admin, now, dryRun);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[pushAutomations] processPushAutomations failed', msg);
    pushAutomations.errors.push(msg);
  }

  result.pushAutomations = pushAutomations;

  const status = result.ok ? 200 : 500;
  return new Response(JSON.stringify(result), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Einzelner Reminder (In-App + Push); von Job-Worker und Legacy-Dispatch nutzbar. */
export async function sendPendingNotificationReminder(
  admin: SupabaseClient,
  item: PendingNotificationItem,
): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
  details: DispatchResult['details'];
}> {
  const details: DispatchResult['details'] = [];
  const errors: string[] = [];

  const { data: dupRows, error: dupErr } = await admin
    .from('notification_dispatch_log')
    .select('id')
    .eq('user_id', item.userId)
    .eq('event_id', item.eventId)
    .eq('reminder_key', item.reminderKey)
    .eq('channel', 'in_app')
    .limit(1);
  if (dupErr) throw dupErr;
  if (dupRows && dupRows.length > 0) {
    details.push({
      userId: item.userId,
      eventId: item.eventId,
      type: item.reminderKey,
      status: 'skipped_duplicate_dispatch',
    });
    return { sent: 0, skipped: 1, errors, details };
  }

  const { error: nErr } = await admin.from('notifications').insert({
    team_id: item.teamId,
    user_id: item.userId,
    title: item.title,
    message: item.body,
    type: 'auto',
    event_type: 'reminder',
    read: false,
    event_id: item.eventId,
    link: '/app/termine',
  });

  if (nErr) {
    const code = (nErr as { code?: string }).code;
    if (code !== '23505') {
      console.warn('[notificationDispatch] notifications.insert failed', nErr.message || nErr);
      throw nErr;
    }
  } else {
    const { error: dispErr } = await admin.from('notification_dispatch_log').insert({
      user_id: item.userId,
      event_id: item.eventId,
      reminder_key: item.reminderKey,
      channel: 'in_app',
    });

    if (dispErr) {
      const code = (dispErr as { code?: string }).code;
      if (code !== '23505') {
        console.warn('[notificationDispatch] notification_dispatch_log in_app failed', dispErr.message || dispErr);
      }
    }
  }

  const { data: subs, error: subErr } = await admin
    .from('notification_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', item.userId)
    .eq('is_active', true);

  if (subErr) {
    console.warn('[notificationDispatch] subscriptions query', subErr.message || subErr);
    details.push({
      userId: item.userId,
      eventId: item.eventId,
      type: item.reminderKey,
      status: 'in_app_ok_no_sub_query',
    });
    return { sent: 0, skipped: 0, errors, details };
  }

  if (!subs?.length) {
    details.push({
      userId: item.userId,
      eventId: item.eventId,
      type: item.reminderKey,
      status: 'in_app_ok_no_subscription',
    });
    return { sent: 0, skipped: 0, errors, details };
  }

  try {
    ensureWebPushVapid();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`vapid: ${msg}`);
    details.push({
      userId: item.userId,
      eventId: item.eventId,
      type: item.reminderKey,
      status: 'in_app_ok_push_skipped_vapid',
    });
    return { sent: 0, skipped: 0, errors, details };
  }

  const unreadForBadge = await countUnreadNotificationsForUser(admin, item.userId);
  const payload = buildWebPushJsonPayload({
    title: 'SpielzeitApp Erinnerung',
    body: item.pushBody,
    url: item.url,
    tag: `spz-reminder-${item.eventId}-${String(item.reminderKey || 'r').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`,
    appBadgeCount: unreadForBadge,
    requireInteraction: true,
    kind: 'reminder',
    eventId: item.eventId,
  });

  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint as string,
          keys: {
            p256dh: s.p256dh as string,
            auth: s.auth as string,
          },
        },
        payload,
        { TTL: 86400 },
      );
      sent += 1;
      await admin
        .from('notification_subscriptions')
        .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', s.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${item.userId}: ${msg}`);
    }
  }

  if (sent > 0) {
    const { error: pushLogErr } = await admin.from('notification_dispatch_log').insert({
      user_id: item.userId,
      event_id: item.eventId,
      reminder_key: item.reminderKey,
      channel: 'push',
    });
    if (pushLogErr) {
      const code = (pushLogErr as { code?: string }).code;
      if (code !== '23505') {
        console.warn('[notificationDispatch] notification_dispatch_log push failed', pushLogErr.message || pushLogErr);
      }
    }
  }

  details.push({
    userId: item.userId,
    eventId: item.eventId,
    type: item.reminderKey,
    status: sent > 0 ? `push_sent_${sent}` : 'push_all_failed',
  });

  return { sent, skipped: 0, errors, details };
}

/** Ungelesene Zeilen in public.notifications für genau diesen User (Homescreen-Badge). */
export async function countUnreadNotificationsForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count ?? 0;
}

/** Nur Web Push (kein messages-/notifications-Insert). Für Reminder-Jobs über notification_jobs. */
export async function sendWebPushForUser(
  admin: SupabaseClient,
  opts: {
    userId: string;
    title: string;
    body: string;
    url: string;
    tag: string;
    /** Optional: iOS/PWA Homescreen-Badge sofort im SW (ohne App öffnen). */
    appBadgeCount?: number;
    requireInteraction?: boolean;
    kind?: string;
    eventId?: string;
  },
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  const { data, error: subErr } = await admin
    .from('notification_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', opts.userId)
    .eq('is_active', true);

  if (subErr) {
    errors.push(subErr.message);
    return { sent: 0, errors };
  }

  const raw: unknown = data ?? [];
  const subs = Array.isArray(raw) ? (raw as { id: string; endpoint: string; p256dh: string; auth: string }[]) : [];

  if (subs.length === 0) {
    return { sent: 0, errors };
  }

  try {
    ensureWebPushVapid();
  } catch (e: unknown) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { sent: 0, errors };
  }

  const payload = buildWebPushJsonPayload({
    title: opts.title,
    body: opts.body,
    url: opts.url,
    tag: opts.tag,
    appBadgeCount: opts.appBadgeCount,
    requireInteraction: opts.requireInteraction,
    kind: opts.kind,
    eventId: opts.eventId,
  });

  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 86400 },
      );
      sent += 1;
      await admin
        .from('notification_subscriptions')
        .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', s.id);
    } catch (e: unknown) {
      errors.push(`${opts.userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { sent, errors };
}
