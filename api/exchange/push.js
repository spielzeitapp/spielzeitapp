const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
const clubIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseMarketLink(link) {
  try {
    const url = new URL(link, 'https://market.invalid');
    const clubId = url.searchParams.get('club');
    const threadId = url.searchParams.get('thread');
    if (url.pathname === '/app/tauschboerse' && clubIdPattern.test(clubId ?? '')) {
      return { clubId, threadId };
    }
  } catch { /* Older queue entries may lack a market route. */ }
  return null;
}

async function subscriptionAction(req, res, db, userId, client) {
  const action = req.query.subscriptionAction;
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { body = null; }
  const clubId = typeof body?.clubId === 'string' ? body.clubId.toLowerCase() : '';
  if (!clubIdPattern.test(clubId) || typeof body?.endpoint !== 'string' || body.endpoint.length > 2048) {
    return res.status(400).json({ ok: false });
  }
  const subscriptions = db.from('market_push_subscriptions');
  if (action === 'status') {
    const { data, error } = await subscriptions.select('endpoint').eq('endpoint', body.endpoint)
      .eq('user_id', userId).eq('club_id', clubId).maybeSingle();
    return error ? res.status(503).json({ ok: false }) : res.status(200).json({ active: Boolean(data) });
  }
  if (action === 'unsubscribe') {
    const { error } = await subscriptions.delete().eq('endpoint', body.endpoint).eq('club_id', clubId).eq('user_id', userId);
    return res.status(error ? 503 : 200).json({ ok: !error });
  }
  if (action !== 'subscribe') return res.status(400).json({ ok: false });

  const { validAudienceSubscription } = await import('../../server/lib/tournamentAudiencePushLogic.js');
  if (!validAudienceSubscription(body)) return res.status(400).json({ ok: false });
  const access = await client.rpc('exchange_access', { p_club_id: clubId });
  if (access.error || access.data !== true) return res.status(403).json({ ok: false });
  const { error } = await subscriptions.upsert({
    endpoint: body.endpoint, club_id: clubId, user_id: userId, p256dh: body.keys.p256dh, auth: body.keys.auth,
  }, { onConflict: 'endpoint' });
  return res.status(error ? 503 : 200).json({ ok: !error });
}

/** Dispatch only server-created queue entries belonging to the verified sender.
 * No recipient, title, URL or message text is accepted from the request body.
 * Entries remain pending on failure; another request retries them with a stable tag.
 */
module.exports = async function handler(req, res) {
  if (req.query?.accountAction === 'delete') return require('../../server/account-delete.cjs')(req, res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST erforderlich' });
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Push derzeit nicht verfügbar' });
  if (!['https://acbaecjzoabafbsjrzvr.supabase.co','https://shxugattqatahckhspwk.supabase.co'].includes(url.replace(/\/$/, ''))) return res.status(403).json({ error: 'Unbekannte Umgebung' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Bitte anmelden' });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return res.status(401).json({ error: 'Bitte anmelden' });
  const caller = createClient(url, process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || key,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  if (req.query?.subscriptionAction) {
    try { return await subscriptionAction(req, res, db, auth.user.id, caller); }
    catch { return res.status(503).json({ ok: false }); }
  }
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
      const market = parseMarketLink(job.link);
      const visible = await caller.from('exchange_messages').select('id').eq('id', job.message_id).maybeSingle();
      if (!market || visible.error || !visible.data) {
        await db.from('exchange_push_queue').update({ status: 'sent' }).eq('message_id', job.message_id);
        continue;
      }
      const { data: subscriptions, error: subError } = await db.from('market_push_subscriptions')
        .select('endpoint,p256dh,auth').eq('user_id', job.recipient_id).eq('club_id', market.clubId);
      let failed = Boolean(subError);
      const unread = await db.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', job.recipient_id).eq('read', false).eq('event_type', 'exchange')
        .like('link', `/app/tauschboerse?club=${market.clubId}&%`);
      if (unread.error) failed = true;
      const badge = !unread.error && Number.isFinite(unread.count) ? { badge_count: Math.min(99, Math.max(0, unread.count)) } : {};
      for (const sub of subscriptions || []) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ ...badge, ...market, tag: `exchange-${job.message_id}`, kind: 'exchange' }), { TTL: 3600 });
          sent++;
        } catch (e) {
          const status = e?.statusCode;
          if (status === 410 || status === 404) {
            await db.from('market_push_subscriptions').delete().eq('user_id', job.recipient_id).eq('club_id', market.clubId).eq('endpoint', sub.endpoint);
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
