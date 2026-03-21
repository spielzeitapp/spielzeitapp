import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import {
  getNotificationConfig,
  getPendingNotifications,
  type PendingNotificationItem,
} from '../src/lib/notifications';

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
  const publicKey =
    readEnv('VAPID_PUBLIC_KEY') ||
    readEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY') ||
    readEnv('VITE_VAPID_PUBLIC_KEY');
  const privateKey = readEnv('VAPID_PRIVATE_KEY');
  const subject = readEnv('VAPID_CONTACT_EMAIL') || 'mailto:team@spielzeitapp.at';
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY und VAPID_PRIVATE_KEY müssen gesetzt sein (Web Push).');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

function verifyCronAuth(request: Request): boolean {
  const secret = readEnv('CRON_SECRET') || readEnv('NOTIFICATION_DISPATCH_SECRET');
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
};

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

  const cfg = getNotificationConfig();
  let pending: PendingNotificationItem[];
  try {
    pending = await getPendingNotifications(admin, new Date(), cfg);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }

  const result: DispatchResult = {
    ok: true,
    dryRun,
    processed: pending.length,
    sent: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  if (dryRun) {
    for (const p of pending) {
      result.details.push({
        userId: p.userId,
        eventId: p.eventId,
        type: p.notificationType,
        status: 'dry_run',
      });
    }
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    ensureWebPushVapid();
  } catch (e: unknown) {
    result.ok = false;
    result.errors.push(e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify(result), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  for (const item of pending) {
    try {
      const sendResult = await sendOneReminder(admin, item);
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
        type: item.notificationType,
        status: `error: ${msg}`,
      });
    }
  }

  return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function sendOneReminder(
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

  const { data: subs, error: subErr } = await admin
    .from('notification_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', item.userId)
    .eq('is_active', true);

  if (subErr) throw subErr;
  if (!subs?.length) {
    details.push({ userId: item.userId, eventId: item.eventId, type: item.notificationType, status: 'skipped_no_subscription' });
    return { sent: 0, skipped: 1, errors, details };
  }

  const { error: insErr } = await admin.from('notification_log').insert({
    user_id: item.userId,
    event_id: item.eventId,
    notification_type: item.notificationType,
  });

  if (insErr) {
    const code = (insErr as { code?: string }).code;
    if (code === '23505') {
      details.push({ userId: item.userId, eventId: item.eventId, type: item.notificationType, status: 'skipped_duplicate' });
      return { sent: 0, skipped: 1, errors, details };
    }
    throw insErr;
  }

  const payload = JSON.stringify({
    title: item.title,
    body: item.body,
    url: item.url,
    tag: `${item.notificationType}-${item.eventId}`,
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
        { TTL: 3600 },
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

  if (sent === 0) {
    await admin
      .from('notification_log')
      .delete()
      .eq('user_id', item.userId)
      .eq('event_id', item.eventId)
      .eq('notification_type', item.notificationType);
    details.push({ userId: item.userId, eventId: item.eventId, type: item.notificationType, status: 'failed_all_subscriptions' });
    return { sent: 0, skipped: 0, errors, details };
  }

  details.push({ userId: item.userId, eventId: item.eventId, type: item.notificationType, status: `sent_${sent}` });
  return { sent, skipped: 0, errors, details };
}
