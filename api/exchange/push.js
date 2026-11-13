const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
// Self-contained CommonJS entry: avoid Vercel's extensionless TS/ESM import resolution.
function buildWebPushJsonPayload(parts) {
  return JSON.stringify({ ...parts, icon: '/icon-192.png', badge: '/badge-72.png',
    vibrate: [200,100,200], requireInteraction: false,
    data: { url: parts.url, kind: parts.kind } });
}

/** Dispatch only server-created queue entries belonging to the verified sender.
 * No recipient, title, URL or message text is accepted from the request body.
 * Entries remain pending on failure; another request retries them with a stable tag.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST erforderlich' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Push derzeit nicht verfügbar' });
  // This preparation must never operate on LIVE, even if an env is misconfigured.
  if (url.replace(/\/$/, '') !== 'https://acbaecjzoabafbsjrzvr.supabase.co') return res.status(403).json({ error: 'Nur TEST' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Bitte anmelden' });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return res.status(401).json({ error: 'Bitte anmelden' });
  if (String(process.env.STAGING_DISABLE_OUTBOUND).toLowerCase() === 'true') return res.status(200).json({ disabled: true, sent: 0 });
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!vapidPublic || !vapidPrivate || !subject) return res.status(503).json({ error: 'Push ist noch nicht eingerichtet' });
  try {
    webpush.setVapidDetails(subject, vapidPublic, vapidPrivate);
    const stale = new Date(Date.now() - 120_000).toISOString();
    await db.from('exchange_push_queue').update({ status: 'pending' })
      .eq('sender_id', auth.user.id).eq('status', 'processing').lt('attempted_at', stale);
    const { data: jobs, error } = await db.from('exchange_push_queue').select('*')
      .eq('sender_id', auth.user.id).eq('status', 'pending').lt('attempts', 5)
      .order('created_at').limit(10);
    if (error) throw error;
    let sent = 0;
    let pending = 0;
    for (const job of jobs || []) {
      const { data: claim, error: claimError } = await db.from('exchange_push_queue')
        .update({ status: 'processing', attempted_at: new Date().toISOString(), attempts: job.attempts + 1 })
        .eq('message_id', job.message_id).eq('status', 'pending').select('message_id').maybeSingle();
      if (claimError) throw claimError;
      if (!claim) continue;
      // Recheck current authorization through the same RLS used by the app:
      // revoked memberships or deleted listings must not deliver private activity.
      const caller = createClient(url, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || key,
        { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
      const visible = await caller.from('exchange_messages').select('id').eq('id', job.message_id).maybeSingle();
      if (visible.error || !visible.data) {
        await db.from('exchange_push_queue').update({ status: 'sent' }).eq('message_id', job.message_id);
        continue;
      }
      const { data: subscriptions, error: subError } = await db.from('notification_subscriptions')
        .select('id,endpoint,p256dh,auth').eq('user_id', job.recipient_id).eq('is_active', true);
      let failed = Boolean(subError);
      for (const sub of subscriptions || []) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            buildWebPushJsonPayload({ title: 'Tauschbörse', body: 'Neue Anfrage oder Nachricht zu einem Inserat.',
              url: job.link, tag: `exchange-${job.message_id}`, kind: 'exchange' }), { TTL: 3600 });
          sent++;
        } catch (e) {
          const status = e?.statusCode;
          if (status === 410 || status === 404) {
            await db.from('notification_subscriptions').update({ is_active: false }).eq('id', sub.id);
          } else failed = true;
        }
      }
      await db.from('exchange_push_queue').update({ status: failed ? 'pending' : 'sent' }).eq('message_id', job.message_id);
      if (failed) pending++;
    }
    return res.status(200).json({ sent, pending });
  } catch {
    return res.status(503).json({ error: 'Push wird beim nächsten Öffnen erneut versucht' });
  }
}
