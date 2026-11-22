import { createClient } from '@supabase/supabase-js';
import { sendDirectInviteEmail } from '../../server/lib/sendParentInviteEmail.js';

const clubId = '3db6fce2-a4c1-44a5-a333-19d1d4d62e6a';
const roundId = 'd742211b-e25c-4c5f-9caa-bedc2a5bf619';
const customer = 'office@jb-harmonikas.at';
const manager = 'office@quetschnguru.at';
const shopUrl = `https://app.spielzeitapp.at/vereinsmarkt/${clubId}?view=shop`;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const money = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });

const escape = value => String(value).replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);

async function sendOnce(admin, userId, recordId, action, to, subject, lines) {
  const claim = { club_id: clubId, actor_id: userId, record_id: recordId, action };
  const { data, error } = await admin.from('club_shop_audit').insert(claim).select('id').single();
  if (error?.code === '23505') return 'claimed';
  if (error || !data) return 'failed';
  const text = [...lines, '', shopUrl].join('\n');
  const html = `<div style="font:16px Arial,sans-serif"><h2>${escape(subject)}</h2><p>${escape(text).replaceAll('\n', '<br>')}</p></div>`;
  const mail = await sendDirectInviteEmail({ to, subject, text, html, senderName: 'Vereinsmarkt' });
  if (mail.ok) return 'sent';
  await admin.from('club_shop_audit').delete().eq('id', data.id);
  return 'failed';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode nicht erlaubt.' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || new URL(url).hostname !== 'acbaecjzoabafbsjrzvr.supabase.co') return res.status(404).end();
  const token = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ error: 'Bitte anmelden.' });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Bitte erneut anmelden.' });
  const { action, id } = req.body || {};
  const expectedEmail = action === 'order-mail' ? customer : manager;
  if (user.email?.toLowerCase() !== expectedEmail || !user.email_confirmed_at) return res.status(403).json({ error: 'Dieses Konto ist für den Schritt nicht vorgesehen.' });
  const { data: round } = await admin.from('club_shop_rounds').select('deadline,status,dealer_id,version')
    .eq('id', roundId).eq('club_id', clubId).maybeSingle();
  if (!round) return res.status(404).json({ error: 'Testrunde fehlt.' });

  if (action === 'order-mail' && typeof id === 'string' && uuid.test(id)) {
    const { data: order } = await admin.from('club_shop_orders').select('items,total_cents')
      .eq('id', id).eq('club_id', clubId).eq('round_id', roundId).eq('owner_id', user.id).maybeSingle();
    if (!order) return res.status(404).json({ error: 'Bestellung fehlt.' });
    const [customerMail, managerMail] = await Promise.all([sendOnce(admin, user.id, id, 'test_mail_customer', customer, '[TEST] Bestellbestätigung · Vereinsshop', [
      'Deine Testbestellung ist eingegangen.',
      ...order.items.map(item => `${item.quantity} × ${item.title} · Größe ${item.size}`),
      `Gesamtbetrag im Test ${money.format(order.total_cents / 100)}`,
      `Verwendungszweck SHOP-${id}`,
      'Vorauskassa und Abholung beim Verein werden simuliert. Bitte nichts überweisen.',
      'Deine Bestellung findest du im Shop unter „Meine Bestellungen“.',
    ]), sendOnce(admin, user.id, id, 'test_mail_manager', manager, '[TEST] Neue Bestellung · Vereinsshop', [
      'Eine neue Testbestellung liegt in der Bestellverwaltung.',
      `Bestellreferenz SHOP-${id}`,
      'Der Auftrag ist offen. Den simulierten Zahlungseingang kannst du in der Verwaltung bestätigen.',
    ])]);
    return res.status(200).json({ sent: customerMail !== 'failed' && managerMail !== 'failed' });
  }

  if (round.dealer_id !== user.id) return res.status(403).json({ error: 'Keine Berechtigung für diese Testrunde.' });
  if (action === 'close-intake') {
    const now = new Date().toISOString();
    const { data, error } = await admin.from('club_shop_rounds').update({ deadline: now, version: round.version + 1 })
      .eq('id', roundId).eq('club_id', clubId).eq('status', 'open').eq('version', round.version).gt('deadline', now)
      .select('id').maybeSingle();
    return error || !data ? res.status(502).json({ error: 'Test-Bestellschluss fehlgeschlagen.' }) : res.status(200).json({ ok: true });
  }
  if (action === 'release-mail' && round.status !== 'open') {
    const sent = await sendOnce(admin, user.id, roundId, 'test_mail_dealer', manager, '[TEST] Sammelauftrag freigegeben · Vereinsshop', [
      'Die bezahlten Testbestellungen sind im Händlerportal freigegeben.',
      'Dort findest du die Mengen je Größe und kannst die Lieferbarkeit bestätigen.',
    ]);
    return res.status(200).json({ sent: sent !== 'failed' });
  }
  return res.status(400).json({ error: 'Ungültiger Testschritt.' });
}
