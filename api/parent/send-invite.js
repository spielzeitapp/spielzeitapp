/**
 * POST /api/parent/send-invite
 * Trainer/Admin: create parent email invite + send Supabase Auth magic-link/OTP email.
 * Secrets stay server-side. Invite link forced to Staging origin for this develop flow.
 */
import { createClient } from '@supabase/supabase-js';

const STAGING_ORIGIN = 'https://app.spielzeitapp.at';
const LIVE_ORIGIN_RE = /^https:\/\/(www\.)?spielzeitapp\.at$/i;
const LIVE_REF = 'shxugattqatahckhspwk';

function parseBody(req) {
  try {
    if (typeof req.body === 'string') {
      return req.body ? JSON.parse(req.body) : {};
    }
    if (req.body && typeof req.body === 'object') return req.body;
  } catch {
    return null;
  }
  return {};
}

function normalizeEmail(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length >= 5 && email.length <= 254;
}

function maskEmail(email) {
  const v = normalizeEmail(email);
  const at = v.indexOf('@');
  if (at <= 0) return null;
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  if (local.length <= 1) return `*@${domain}`;
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Parent invite links: always canonical Staging origin for this develop flow.
 * Never trust client Origin headers. Never emit localhost or Live.
 * Supabase Auth Site URL + Redirect Allowlist must also allow this origin
 * (otherwise GoTrue falls back to Site URL, e.g. localhost).
 */
function resolveInviteOrigin() {
  const configured = String(
    process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL || '',
  )
    .trim()
    .replace(/\/$/, '');

  if (LIVE_ORIGIN_RE.test(configured)) {
    return { ok: false, error: 'parent_invite_refuses_live_domain' };
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '');
  if (supabaseUrl.includes(`${LIVE_REF}.supabase.co`)) {
    return { ok: false, error: 'parent_invite_refuses_live_supabase' };
  }

  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(configured)) {
    // Misconfigured env must not poison invite emails.
    return { ok: true, origin: STAGING_ORIGIN };
  }

  // Canonical Staging invite target (serverseitig fix, nicht aus Request-Headern).
  return { ok: true, origin: STAGING_ORIGIN };
}

function normalizeMembershipRole(roleStr) {
  const s = String(roleStr ?? '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === 'administrator' || s === 'admin' || s === 'club_admin') return 'admin';
  if (
    s === 'head_coach' ||
    s === 'headcoach' ||
    s === 'coach' ||
    s === 'co_trainer' ||
    s === 'co-trainer' ||
    s === 'cotrainer' ||
    s === 'assistant' ||
    s === 'trainer' ||
    s === 'staff'
  ) {
    return 'trainer';
  }
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const body = parseBody(req);
    if (body === null) {
      return res.status(400).json({ ok: false, error: 'Invalid JSON' });
    }

    const teamSeasonId =
      typeof body.team_season_id === 'string' ? body.team_season_id.trim() : '';
    const playerId = typeof body.player_id === 'string' ? body.player_id.trim() : '';
    const email = normalizeEmail(body.email);
    const expiresHours = Number.isFinite(Number(body.expires_hours))
      ? Number(body.expires_hours)
      : 72;

    if (!teamSeasonId || !playerId || !isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: 'team_season_id, player_id and valid email required',
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return res.status(500).json({
        ok: false,
        error: 'Server misconfigured',
        mail_blocker: 'missing_supabase_env',
      });
    }

    if (String(supabaseUrl).includes(`${LIVE_REF}.supabase.co`)) {
      return res.status(403).json({
        ok: false,
        error: 'parent_invite_refuses_live_supabase',
      });
    }

    const originRes = resolveInviteOrigin();
    if (!originRes.ok) {
      return res.status(403).json({ ok: false, error: originRes.error });
    }

    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(accessToken);
    if (userErr || !user?.id) {
      return res.status(401).json({ ok: false, error: 'Invalid session' });
    }

    // Defense-in-depth staff check (RPC also enforces can_manage_team_staff)
    const { data: globalRoleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    let canSend = normalizeMembershipRole(globalRoleRow?.role) === 'admin';
    if (!canSend) {
      const { data: senderMem } = await admin
        .from('memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('team_season_id', teamSeasonId)
        .maybeSingle();
      canSend = normalizeMembershipRole(senderMem?.role) === 'trainer';
    }
    if (!canSend) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: inviteData, error: inviteError } = await userClient.rpc(
      'create_parent_link_invite',
      {
        p_team_season_id: teamSeasonId,
        p_player_id: playerId,
        p_expires_hours: expiresHours,
        p_recipient_email: email,
      },
    );

    if (inviteError) {
      return res.status(400).json({
        ok: false,
        error: 'invite_create_failed',
      });
    }

    const invite = inviteData && typeof inviteData === 'object' ? inviteData : {};
    if (String(invite.status) !== 'created' || !invite.token_plain || !invite.invite_id) {
      return res.status(400).json({
        ok: false,
        error: String(invite.status || 'invite_create_failed'),
      });
    }

    const tokenPlain = String(invite.token_plain);
    // Path-based accept URL — GoTrue often strips ?query from redirect_to.
    const acceptPath = `/app/parent-invite/${encodeURIComponent(tokenPlain)}`;
    const emailRedirectTo = `${originRes.origin}${acceptPath}`;

    // Raw Auth OTP API (top-level email_redirect_to). Avoid admin.generateLink
    // options.redirect_to quirks that silently fall back to Site URL.
    let otpError = null;
    try {
      const otpRes = await fetch(`${String(supabaseUrl).replace(/\/$/, '')}/auth/v1/otp`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          create_user: true,
          data: {
            spielzeit_parent_invite: true,
            // Backup if redirect loses the path token — cleared after redeem.
            spielzeit_parent_invite_token: tokenPlain,
          },
          email_redirect_to: emailRedirectTo,
        }),
      });
      if (!otpRes.ok) {
        otpError = { status: otpRes.status };
        console.error('[parent/send-invite] auth mail failed');
      }
    } catch {
      otpError = { status: 0 };
      console.error('[parent/send-invite] auth mail failed');
    }

    let emailSent = !otpError;
    let mailBlocker = null;
    if (otpError) {
      mailBlocker = 'supabase_auth_mail_failed';
    } else {
      await userClient.rpc('mark_parent_link_invite_sent', {
        p_invite_id: invite.invite_id,
      });
    }

    const response = {
      ok: true,
      status: 'created',
      invite_id: invite.invite_id,
      expires_at: invite.expires_at ?? null,
      recipient_email_masked: invite.recipient_email_masked || maskEmail(email),
      email_sent: emailSent,
      accept_origin: originRes.origin,
      mail_blocker: mailBlocker,
    };

    // Only expose one-time code when Auth mail did not send — WhatsApp / handoff fallback
    if (!emailSent) {
      response.code_fallback = tokenPlain;
    }

    return res.status(200).json(response);
  } catch (e) {
    console.error('[parent/send-invite] unexpected');
    return res.status(500).json({ ok: false, error: 'unexpected_error' });
  }
}
