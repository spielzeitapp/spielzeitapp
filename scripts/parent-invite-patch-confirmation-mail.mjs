/**
 * Patch staging confirmation mail template (invite-safe wording).
 * Requires SUPABASE_ACCESS_TOKEN. Staging only.
 */
const TARGET = 'acbaecjzoabafbsjrzvr';
const LIVE = 'shxugattqatahckhspwk';

const CONFIRM_SUBJECT = 'Bestätige deine E-Mail-Adresse · SpielzeitApp';
const CONFIRM_HTML = `<div style="margin:0;padding:32px 16px;background:#f4f5f7;font-family:Arial,sans-serif;color:#171717;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e7e7;">
    <div style="background:#171717;padding:28px 24px;text-align:center;">
      <div style="font-size:25px;font-weight:800;color:#ffffff;">
        SPIELZEIT<span style="color:#e30613;">APP</span>
      </div>
    </div>
    <div style="padding:34px 28px;text-align:center;">
      <h1 style="margin:0 0 16px;font-size:24px;color:#171717;">E-Mail-Adresse bestätigen</h1>
      <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#444444;">
        Bestätige jetzt deine E-Mail-Adresse, um deine Registrierung abzuschließen.
      </p>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#666666;">
        Danach kannst du die persönliche Einladung annehmen und dein Kind direkt mit deinem Elternkonto verknüpfen.
        Bei einer normalen Registrierung ohne Einladung kannst du danach wie gewohnt fortfahren.
      </p>
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;padding:14px 26px;background:#e30613;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:9px;">
        E-Mail-Adresse bestätigen
      </a>
    </div>
  </div>
</div>`;

async function main() {
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();
  if (!token) {
    console.log(JSON.stringify({ skipped: true, reason: 'missing_SUPABASE_ACCESS_TOKEN' }));
    process.exit(0);
  }
  if (TARGET === LIVE) {
    console.error(JSON.stringify({ error: 'refuse_live' }));
    process.exit(1);
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const proj = await fetch(`https://api.supabase.com/v1/projects/${TARGET}`, { headers }).then((r) =>
    r.json(),
  );
  if (proj.id !== TARGET || !String(proj.name || '').toLowerCase().includes('staging')) {
    console.error(JSON.stringify({ error: 'identity_mismatch', id: proj.id, name: proj.name }));
    process.exit(1);
  }
  const patchRes = await fetch(`https://api.supabase.com/v1/projects/${TARGET}/config/auth`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      mailer_subjects_confirmation: CONFIRM_SUBJECT,
      mailer_templates_confirmation_content: CONFIRM_HTML,
    }),
  });
  const body = await patchRes.json().catch(() => ({}));
  if (!patchRes.ok) {
    console.error(JSON.stringify({ error: 'patch_failed', status: patchRes.status, body }));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, project: TARGET, confirmation_subject: CONFIRM_SUBJECT }));
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e?.message || e) }));
  process.exit(1);
});
