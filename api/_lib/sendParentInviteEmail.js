/**
 * PARENT-INVITE: Transactional invite email without creating auth.users.
 * Prefer RESEND_API_KEY (optional). Falls back to SMTP_* if configured.
 * Never logs the invite token.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
        Die Einladung ist an deine E-Mail-Adresse gebunden und 72 Stunden gültig.
        Öffne den Link, melde dich an oder registriere dich, und nimm die Einladung an —
        dein Kind wird direkt mit deinem Elternkonto verknüpft.
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
 * @returns {{ ok: boolean, provider: string|null, error: string|null }}
 */
export async function sendParentInviteEmail(opts) {
  const to = String(opts.to || '')
    .trim()
    .toLowerCase();
  const acceptUrl = String(opts.acceptUrl || '').trim();
  if (!to || !acceptUrl.startsWith('https://')) {
    return { ok: false, provider: null, error: 'invalid_input' };
  }

  const subject = 'Deine Einladung zu SpielzeitApp';
  const html = buildParentInviteEmailHtml({ acceptUrl });
  const from =
    String(process.env.PARENT_INVITE_FROM_EMAIL || process.env.SMTP_FROM || '').trim() ||
    'SpielzeitApp <noreply@spielzeitapp.at>';

  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      if (res.ok) return { ok: true, provider: 'resend', error: null };
      console.error('[parent-invite-mail] resend failed', res.status);
      return { ok: false, provider: 'resend', error: 'resend_failed' };
    } catch {
      console.error('[parent-invite-mail] resend error');
      return { ok: false, provider: 'resend', error: 'resend_error' };
    }
  }

  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  if (smtpHost && smtpUser && smtpPass) {
    // Optional nodemailer — only if dependency present at runtime.
    try {
      const nodemailer = await import('nodemailer').catch(() => null);
      if (!nodemailer?.createTransport) {
        return { ok: false, provider: 'smtp', error: 'nodemailer_missing' };
      }
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({ from, to, subject, html });
      return { ok: true, provider: 'smtp', error: null };
    } catch {
      console.error('[parent-invite-mail] smtp error');
      return { ok: false, provider: 'smtp', error: 'smtp_failed' };
    }
  }

  return { ok: false, provider: null, error: 'no_mailer_configured' };
}
