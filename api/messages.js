/**
 * GET /api/messages?team_id=<uuid>&limit=<n>
 * GET /api/messages?team_id=<uuid>&id=<message_id>
 *
 * In-App Nachrichten (messages table) für die aktive Mannschaft (nur mit Membership).
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'Server configuration error',
      });
    }

    const teamIdRaw = typeof req.query.team_id === 'string' ? req.query.team_id.trim() : '';
    const messageIdRaw =
      typeof req.query.id === 'string' ? req.query.id.trim() : typeof req.query.message_id === 'string' ? req.query.message_id.trim() : '';

    if (!teamIdRaw) {
      return res.status(400).json({ ok: false, error: 'team_id query parameter required' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);
    if (userErr || !user?.id) {
      return res.status(401).json({ ok: false, error: 'Invalid session' });
    }

    // Membership-Teamseasons für team_id
    const { data: seasonRows, error: seasonErr } = await supabase
      .from('team_seasons')
      .select('id')
      .eq('team_id', teamIdRaw);

    if (seasonErr) {
      return res.status(500).json({ ok: false, error: seasonErr.message || String(seasonErr) });
    }

    const seasonIds = (seasonRows || []).map((r) => r.id).filter(Boolean);
    if (seasonIds.length === 0) {
      return res.status(200).json({ ok: true, messages: [], message: null });
    }

    const { data: memRows, error: memErr } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .in('team_season_id', seasonIds)
      .limit(1);

    if (memErr) {
      return res.status(500).json({ ok: false, error: memErr.message || String(memErr) });
    }

    if (!memRows || memRows.length === 0) {
      return res.status(403).json({ ok: false, error: 'Forbidden: no membership for this team' });
    }

    if (messageIdRaw) {
      const { data: msgRow, error: msgErr } = await supabase
        .from('messages')
        .select('id, team_id, title, content, type, related_event_id, created_at')
        .eq('id', messageIdRaw)
        .eq('team_id', teamIdRaw)
        .maybeSingle();

      if (msgErr) {
        return res.status(500).json({ ok: false, error: msgErr.message || String(msgErr) });
      }

      return res.status(200).json({ ok: true, message: msgRow ?? null });
    }

    const limitRaw = typeof req.query.limit === 'string' ? req.query.limit.trim() : '';
    const limit = limitRaw && Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(200, Number(limitRaw))) : 50;

    const { data: rows, error: msgErr } = await supabase
      .from('messages')
      .select('id, team_id, title, content, type, related_event_id, created_at')
      .eq('team_id', teamIdRaw)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (msgErr) {
      return res.status(500).json({ ok: false, error: msgErr.message || String(msgErr) });
    }

    return res.status(200).json({ ok: true, messages: rows ?? [] });
  } catch (err) {
    console.error('[api/messages]', err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

