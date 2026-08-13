/**
 * POST /api/parent/send-invite
 * - Default: Trainer/Admin creates parent email invite + personal invite mail
 *   (prefer direct accept-URL mail without creating auth.users).
 * - Fallback: Auth OTP only when needed; create_user only for truly missing emails
 *   and only if direct mailer is unavailable.
 * - action=complete_signup: Invite-bound password signup for passwordless stubs
 *   (token + email must match; no open account enumeration).
 * Secrets stay server-side. Invite origin is bound to the Supabase project ref.
 * Client Host/Origin headers are never trusted.
 */
import { createClient } from '@supabase/supabase-js';
import { sendParentInviteEmail } from '../_lib/sendParentInviteEmail.js';

const STAGING_ORIGIN = 'https://app.spielzeitapp.at';
const LIVE_ORIGIN = 'https://spielzeitapp.at';
const STAGING_REF = 'acbaecjzoabafbsjrzvr';
const LIVE_REF = 'shxugattqatahckhspwk';
const MIN_PASSWORD_LENGTH = 6;

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

function isInviteTokenShape(token) {
  return /^[0-9a-f]{48}$/.test(String(token ?? '').trim().toLowerCase());
}

function normalizeConfiguredOrigin(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\/$/, '');
}

function isLiveOrigin(origin) {
  return /^https:\/\/(www\.)?spielzeitapp\.at$/i.test(origin);
}

function isStagingOrigin(origin) {
  return /^https:\/\/app\.spielzeitapp\.at$/i.test(origin);
}

/**
 * Bind invite links to the Supabase project: Live-Ref → spielzeitapp.at,
 * Staging-Ref → app.spielzeitapp.at. Cross pairs and unknown DBs are rejected.
 * Never trust request Host, Origin, or forwarded-host headers.
 */
function resolveInviteOrigin() {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '');
  const isLiveDb = supabaseUrl.includes(`${LIVE_REF}.supabase.co`);
  const isStagingDb = supabaseUrl.includes(`${STAGING_REF}.supabase.co`);
  const configured = normalizeConfiguredOrigin(
    process.env.APP_BASE_URL || process.env.VITE_APP_BASE_URL || '',
  );

  if (isLiveDb && isStagingDb) {
    return { ok: false, error: 'parent_invite_ambiguous_supabase' };
  }

  if (isLiveDb) {
    if (configured && !isLiveOrigin(configured)) {
      return { ok: false, error: 'parent_invite_origin_ref_mismatch' };
    }
    return { ok: true, origin: LIVE_ORIGIN };
  }

  if (isStagingDb) {
    if (configured && !isStagingOrigin(configured)) {
      return { ok: false, error: 'parent_invite_origin_ref_mismatch' };
    }
    return { ok: true, origin: STAGING_ORIGIN };
  }

  return { ok: false, error: 'parent_invite_unknown_supabase' };
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

function asRecord(data) {
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }
  return {};
}

async function handleCompleteSignup(req, res, { supabaseUrl, serviceKey, admin }) {
  const body = parseBody(req);
  if (body === null) {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  const token = String(body.token ?? '')
    .trim()
    .toLowerCase();
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? '');
  const firstName = String(body.first_name ?? '').trim();
  const lastName = String(body.last_name ?? '').trim();

  if (!isInviteTokenShape(token) || !isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'invalid_input' });
  }
  if (!firstName || !lastName) {
    return res.status(400).json({ ok: false, error: 'invalid_name' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ ok: false, error: 'weak_password' });
  }

  const { data: peekData, error: peekError } = await admin.rpc('peek_parent_link_invite', {
    p_token: token,
  });
  if (peekError) {
    return res.status(400).json({ ok: false, error: 'invite_check_failed' });
  }
  const peek = asRecord(peekData);
  if (String(peek.status) !== 'ready') {
    return res.status(400).json({
      ok: false,
      error: String(peek.status || 'invalid_token'),
    });
  }
  const recipient = normalizeEmail(peek.recipient_email);
  if (!recipient || recipient !== email) {
    return res.status(403).json({ ok: false, error: 'email_mismatch' });
  }
  if (peek.account_exists === true) {
    return res.status(409).json({ ok: false, error: 'account_exists' });
  }

  const { data: statusData, error: statusError } = await admin.rpc(
    'parent_invite_auth_email_status',
    { p_email: email },
  );
  if (statusError) {
    return res.status(500).json({ ok: false, error: 'auth_status_failed' });
  }
  const status = asRecord(statusData);
  let userId = status.user_id ? String(status.user_id) : null;

  const meta = {
    first_name: firstName,
    last_name: lastName,
    spielzeit_parent_invite: true,
    spielzeit_parent_invite_token: token,
  };

  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: meta,
    });
    if (createErr || !created?.user?.id) {
      return res.status(400).json({ ok: false, error: 'create_user_failed' });
    }
    userId = created.user.id;
  } else if (status.has_password === true) {
    return res.status(409).json({ ok: false, error: 'account_exists' });
  } else {
    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: meta,
    });
    if (updateErr) {
      return res.status(400).json({ ok: false, error: 'update_user_failed' });
    }
  }

  // Confirm-Roundtrip must be self-contained: Mail/in-app browsers often lose
  // localStorage and GoTrue may fall back to Site URL `/login` without query.
  // Land on login with next+email; if a session is established, Login redirects to Accept.
  const originRes = resolveInviteOrigin();
  if (!originRes.ok) {
    return res.status(403).json({ ok: false, error: originRes.error });
  }
  const acceptPath = `/app/parent-invite/${encodeURIComponent(token)}`;
  const confirmQs = new URLSearchParams();
  confirmQs.set('next', acceptPath);
  confirmQs.set('email', email);
  confirmQs.set('invite_confirmed', '1');
  const emailRedirectTo = `${originRes.origin}/login?${confirmQs.toString()}`;

  let confirmSent = false;
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
        create_user: false,
        data: meta,
        email_redirect_to: emailRedirectTo,
      }),
    });
    confirmSent = otpRes.ok;
    if (!otpRes.ok) {
      console.error('[parent/send-invite] confirm mail failed');
    }
  } catch {
    console.error('[parent/send-invite] confirm mail failed');
  }

  return res.status(200).json({
    ok: true,
    status: 'pending_email_confirmation',
    email_confirm_sent: confirmSent,
    accept_path: acceptPath,
    confirm_redirect: emailRedirectTo,
  });
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

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (String(body.action || '') === 'complete_signup') {
      return handleCompleteSignup(req, res, { supabaseUrl, serviceKey, admin });
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

    const originRes = resolveInviteOrigin();
    if (!originRes.ok) {
      return res.status(403).json({ ok: false, error: originRes.error });
    }

    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(accessToken);
    if (userErr || !user?.id) {
      return res.status(401).json({ ok: false, error: 'Invalid session' });
    }

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
    const acceptPath = `/app/parent-invite/${encodeURIComponent(tokenPlain)}`;
    const acceptUrl = `${originRes.origin}${acceptPath}`;

    // Route Auth mail landing: existing password → login; otherwise → register (locked email).
    // Prefer landing on Accept when magic-session is established (token in path survives).
    const { data: authStatusRaw } = await admin.rpc('parent_invite_auth_email_status', {
      p_email: email,
    });
    const authStatus = asRecord(authStatusRaw);
    const hasPassword = authStatus.has_password === true;
    const authExists = authStatus.exists === true;
    const authQs = new URLSearchParams();
    authQs.set('next', acceptPath);
    authQs.set('email', email);
    const loginRedirect = `${originRes.origin}/login?${authQs.toString()}`;
    const registerRedirect = `${originRes.origin}/register?${authQs.toString()}`;

    // 1) Preferred: direct invite mail (World4You SMTP → Resend) — no auth.users row.
    const directMail = await sendParentInviteEmail({
      to: email,
      acceptUrl,
    });

    let emailSent = false;
    let mailBlocker = null;
    let delivery = null;
    let provider = null;
    let authStubCreated = false;
    let trainerMessage = null;

    if (directMail.ok) {
      emailSent = true;
      delivery = 'direct';
      provider = directMail.provider || 'direct';
      authStubCreated = false;
      await userClient.rpc('mark_parent_link_invite_sent', {
        p_invite_id: invite.invite_id,
      });
    } else if (directMail.configured) {
      // Direct mail was configured but failed — do NOT create Auth stubs via OTP.
      mailBlocker =
        directMail.error === 'smtp_failed' || directMail.error === 'nodemailer_missing'
          ? 'smtp_send_failed'
          : directMail.error === 'resend_failed' || directMail.error === 'resend_error'
            ? 'resend_send_failed'
            : 'direct_mail_failed';
      provider = directMail.provider;
      authStubCreated = false;
      trainerMessage =
        'Die Einladung wurde angelegt, aber der E-Mail-Versand ist fehlgeschlagen. Bitte später erneut versuchen oder den Code manuell weitergeben.';
    } else {
      // 2) OTP fallback ONLY when no direct-mail transport is configured.
      const createUser = !authExists;
      const emailRedirectTo = hasPassword ? loginRedirect : registerRedirect;
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
            create_user: createUser,
            data: {
              spielzeit_parent_invite: true,
              spielzeit_parent_invite_token: tokenPlain,
            },
            email_redirect_to: emailRedirectTo,
          }),
        });
        if (!otpRes.ok) {
          otpError = { status: otpRes.status };
          console.error('[parent/send-invite] auth mail failed');
        } else {
          emailSent = true;
          delivery = 'otp_fallback';
          provider = 'supabase';
          authStubCreated = createUser;
          await userClient.rpc('mark_parent_link_invite_sent', {
            p_invite_id: invite.invite_id,
          });
        }
      } catch {
        otpError = { status: 0 };
        console.error('[parent/send-invite] auth mail failed');
      }

      if (!emailSent) {
        mailBlocker = otpError ? 'supabase_auth_mail_failed' : 'no_mailer_configured';
        trainerMessage =
          'E-Mail-Versand nicht möglich. Die Einladung wurde angelegt — bitte den Code manuell weitergeben.';
      }
    }

    const response = {
      ok: true,
      status: 'created',
      invite_id: invite.invite_id,
      expires_at: invite.expires_at ?? null,
      recipient_email_masked: invite.recipient_email_masked || maskEmail(email),
      email_sent: emailSent,
      accept_origin: originRes.origin,
      accept_path: acceptPath,
      auth_route: hasPassword ? 'login' : 'register',
      delivery,
      provider,
      auth_stub_created: authStubCreated,
      mail_blocker: mailBlocker,
      message: trainerMessage,
    };

    if (!emailSent) {
      response.code_fallback = tokenPlain;
    }

    return res.status(200).json(response);
  } catch (e) {
    console.error('[parent/send-invite] unexpected');
    return res.status(500).json({ ok: false, error: 'unexpected_error' });
  }
}
