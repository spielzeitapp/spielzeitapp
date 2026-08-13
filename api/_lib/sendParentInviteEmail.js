/**
 * PARENT-INVITE: Direct transactional invite email (no auth.users creation).
 * Transport priority:
 * 1) World4You SMTP (PARENT_INVITE_SMTP_*)
 * 2) Resend (RESEND_API_KEY)
 * OTP fallback lives in send-invite.js and must NOT run when direct mail is configured.
 * Never logs invite tokens or credentials.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readEnv(name) {
  return String(process.env[name] ?? '').trim();
}

function parseSecureFlag(raw, port) {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return Number(port) === 465;
}

/** @returns {{ host: string, port: number, secure: boolean, user: string, pass: string, from: string, replyTo: string|null } | null} */
export function getWorld4YouSmtpConfig() {
  const host = readEnv('PARENT_INVITE_SMTP_HOST');
  const user = readEnv('PARENT_INVITE_SMTP_USER');
  const pass = readEnv('PARENT_INVITE_SMTP_PASSWORD');
  const from = readEnv('PARENT_INVITE_SMTP_FROM');
  if (!host || !user || !pass || !from) return null;
  const port = Number(readEnv('PARENT_INVITE_SMTP_PORT') || 587);
  if (!Number.isFinite(port) || port <= 0) return null;
  const secure = parseSecureFlag(readEnv('PARENT_INVITE_SMTP_SECURE'), port);
  const replyTo = readEnv('PARENT_INVITE_SMTP_REPLY_TO') || null;
  return { host, port, secure, user, pass, from, replyTo };
}

export function isWorld4YouSmtpConfigured() {
  return getWorld4YouSmtpConfig() != null;
}

export function isResendConfigured() {
  return Boolean(readEnv('RESEND_API_KEY'));
}

/** True when any direct-mail transport is fully configured (OTP must not run). */
export function isDirectMailConfigured() {
  return isWorld4YouSmtpConfigured() || isResendConfigured();
}

export function buildParentInviteEmailText(opts) {
  const acceptUrl = String(opts.acceptUrl || '').trim();
  return [
    'Deine Einladung zu SpielzeitApp',
    '',
    'Du wurdest eingeladen, dich als Elternteil bei SpielzeitApp anzumelden.',
    '',
    'Klicke auf den Link, um fortzufahren. Anschließend kannst du die Einladung annehmen und dein Kind direkt mit deinem Elternkonto verknüpfen.',
    '',
    acceptUrl,
    '',
    'Falls du diese Einladung nicht erwartest, kannst du diese Nachricht ignorieren.',
    '',
    '© SpielzeitApp',
  ].join('\n');
}

export function buildParentInviteEmailHtml(opts) {
  const acceptUrl = String(opts.acceptUrl || '').trim();
  const safeUrl = escapeHtml(acceptUrl);
  return `<div style="margin:0;padding:32px 16px;background:#f4f5f7;font-family:Arial,sans-serif;color:#171717;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e7e7;">
    <div style="background:#171717;padding:28px 24px;text-align:center;">
      <div style="font-size:25px;font-weight:800;color:#ffffff;">
        SPIELZEIT<span style="color:#e30613;">APP</span>
      </div>
      <div style="margin-top:8px;font-size:13px;color:#d1d1d1;">
        Dein Team. Deine Momente. Dein Spiel.
      </div>
    </div>
    <div style="padding:34px 28px;text-align:center;">
      <h1 style="margin:0 0 16px;font-size:24px;color:#171717;">
        Deine Einladung zu SpielzeitApp
      </h1>
      <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#444444;">
        Du wurdest eingeladen, dich als Elternteil bei SpielzeitApp anzumelden.
      </p>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#666666;">
        Klicke auf den Button, um fortzufahren. Anschließend kannst du die Einladung annehmen und dein Kind direkt mit deinem Elternkonto verknüpfen.
      </p>
      <a href="${safeUrl}"
         style="display:inline-block;padding:14px 26px;background:#e30613;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:9px;">
        Einladung öffnen
      </a>
      <p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#888888;">
        Falls du diese Einladung nicht erwartest, kannst du diese Nachricht ignorieren.
      </p>
    </div>
    <div style="padding:18px 24px;background:#f7f7f7;text-align:center;font-size:12px;color:#888888;">
      © SpielzeitApp · Gemeinsam mehr vom Fußball erleben
    </div>
  </div>
</div>`;
}

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   provider: 'world4you_smtp' | 'resend' | null,
 *   error: string | null,
 *   configured: boolean,
 * }>}
 */
export async function sendParentInviteEmail(opts) {
  const to = String(opts.to || '')
    .trim()
    .toLowerCase();
  const acceptUrl = String(opts.acceptUrl || '').trim();
  if (!to || !acceptUrl.startsWith('https://')) {
    return { ok: false, provider: null, error: 'invalid_input', configured: isDirectMailConfigured() };
  }

  const subject = 'Deine Einladung zu SpielzeitApp';
  const html = buildParentInviteEmailHtml({ acceptUrl });
  const text = buildParentInviteEmailText({ acceptUrl });

  const smtp = getWorld4YouSmtpConfig();
  if (smtp) {
    try {
      const nodemailer = await import('nodemailer');
      const createTransport = nodemailer.createTransport || nodemailer.default?.createTransport;
      if (typeof createTransport !== 'function') {
        console.error('[parent-invite-mail] nodemailer unavailable');
        return {
          ok: false,
          provider: 'world4you_smtp',
          error: 'nodemailer_missing',
          configured: true,
        };
      }
      const transporter = createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        requireTLS: !smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        tls: {
          // Do not disable certificate validation.
          minVersion: 'TLSv1.2',
        },
      });
      const mail = {
        from: smtp.from,
        to,
        subject,
        text,
        html,
      };
      if (smtp.replyTo) mail.replyTo = smtp.replyTo;
      await transporter.sendMail(mail);
      return { ok: true, provider: 'world4you_smtp', error: null, configured: true };
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      console.error('[parent-invite-mail] world4you_smtp failed', code || 'error');
      return {
        ok: false,
        provider: 'world4you_smtp',
        error: 'smtp_failed',
        configured: true,
      };
    }
  }

  const resendKey = readEnv('RESEND_API_KEY');
  if (resendKey) {
    const from =
      readEnv('PARENT_INVITE_SMTP_FROM') ||
      readEnv('PARENT_INVITE_FROM_EMAIL') ||
      'SpielzeitApp <noreply@spielzeitapp.at>';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      });
      if (res.ok) {
        return { ok: true, provider: 'resend', error: null, configured: true };
      }
      console.error('[parent-invite-mail] resend failed', res.status);
      return { ok: false, provider: 'resend', error: 'resend_failed', configured: true };
    } catch {
      console.error('[parent-invite-mail] resend error');
      return { ok: false, provider: 'resend', error: 'resend_error', configured: true };
    }
  }

  return { ok: false, provider: null, error: 'no_mailer_configured', configured: false };
}
