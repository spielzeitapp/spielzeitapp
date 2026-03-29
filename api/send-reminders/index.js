/**
 * Vercel Serverless: POST /api/send-reminders (CommonJS)
 * Scan: Spiele (match/game), bei denen „24h vor Treff/Anpfiff“ aktuell im Fenster liegt.
 */
const { createClient } = require('@supabase/supabase-js');

const REMINDER_MS = 24 * 60 * 60 * 1000;
const DUE_WINDOW_MS = 10 * 60 * 1000;

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

/** Entspricht RawEventRow / buildReminderJobs: Spiel → Treff → Kickoff → Start */
function getBaseTimeIso(row) {
  const meet = nonEmptyIso(row.meetup_at) ?? nonEmptyIso(row.meeting_at);
  const kickoff = nonEmptyIso(row.kickoff_at);
  const start = nonEmptyIso(row.starts_at) ?? '';
  if (meet) return meet;
  if (kickoff) return kickoff;
  return start;
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

    return res.status(200).json({
      ok: true,
      message: 'Match reminder scan complete',
      processed: dueMatches.length,
      scanned: matches.length,
      matches: dueMatches,
    });
  } catch (err) {
    console.error('SEND REMINDERS ERROR', err);
    return res.status(500).json({
      ok: false,
      error: (err && err.message) || 'Unknown error',
    });
  }
};
