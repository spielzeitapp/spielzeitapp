/**
 * PARENT-INVITE.1: patch only Magic Link subject+HTML on staging.
 * Does NOT touch confirmation/recovery templates.
 * Requires SUPABASE_ACCESS_TOKEN or CredMan Supabase CLI:supabase.
 */
const TARGET = 'acbaecjzoabafbsjrzvr';
const LIVE = 'shxugattqatahckhspwk';

const MAGIC_SUBJECT = 'Deine Einladung zu SpielzeitApp';
const MAGIC_HTML = `<div style="margin:0;padding:32px 16px;background:#f4f5f7;font-family:Arial,sans-serif;color:#171717;">
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
        Klicke auf den Button, um fortzufahren. Anschließend kannst du die Einladung annehmen und dein Kind sehen.
      </p>
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;padding:14px 26px;background:#e30613;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:9px;">
        Bei SpielzeitApp anmelden
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

async function main() {
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();
  if (!token) {
    console.error(JSON.stringify({ error: 'missing_SUPABASE_ACCESS_TOKEN' }));
    process.exit(2);
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
  if (proj.id !== TARGET || !String(proj.name || '').includes('staging')) {
    console.error(JSON.stringify({ error: 'identity_mismatch', id: proj.id, name: proj.name }));
    process.exit(1);
  }

  const before = await fetch(`https://api.supabase.com/v1/projects/${TARGET}/config/auth`, {
    headers,
  }).then((r) => r.json());

  const beforeOut = {
    project: { id: proj.id, name: proj.name },
    before: {
      magic_subject: before.mailer_subjects_magic_link,
      magic_len: String(before.mailer_templates_magic_link_content || '').length,
      magic_default: /Your sign-in link|Follow the link/i.test(
        String(before.mailer_templates_magic_link_content || ''),
      ),
      confirmation_subject: before.mailer_subjects_confirmation,
      recovery_subject: before.mailer_subjects_recovery,
    },
  };

  const patchRes = await fetch(`https://api.supabase.com/v1/projects/${TARGET}/config/auth`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      mailer_subjects_magic_link: MAGIC_SUBJECT,
      mailer_templates_magic_link_content: MAGIC_HTML,
    }),
  });
  const patchBody = await patchRes.json().catch(() => ({}));
  if (!patchRes.ok) {
    console.error(
      JSON.stringify({
        error: 'patch_failed',
        status: patchRes.status,
        msg: String(patchBody.message || patchBody.error || '').slice(0, 200),
        before: beforeOut.before,
      }),
    );
    process.exit(1);
  }

  const after = await fetch(`https://api.supabase.com/v1/projects/${TARGET}/config/auth`, {
    headers,
  }).then((r) => r.json());

  console.log(
    JSON.stringify(
      {
        ...beforeOut,
        after: {
          magic_subject: after.mailer_subjects_magic_link,
          magic_len: String(after.mailer_templates_magic_link_content || '').length,
          magic_has_spielzeit: /SpielzeitApp/i.test(
            String(after.mailer_templates_magic_link_content || ''),
          ),
          magic_has_placeholder: String(after.mailer_templates_magic_link_content || '').includes(
            '{{ .ConfirmationURL }}',
          ),
          confirmation_subject_unchanged:
            after.mailer_subjects_confirmation === before.mailer_subjects_confirmation,
          recovery_subject_unchanged:
            after.mailer_subjects_recovery === before.mailer_subjects_recovery,
          confirmation_len_unchanged:
            String(after.mailer_templates_confirmation_content || '').length ===
            String(before.mailer_templates_confirmation_content || '').length,
          recovery_len_unchanged:
            String(after.mailer_templates_recovery_content || '').length ===
            String(before.mailer_templates_recovery_content || '').length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e?.message || e) }));
  process.exit(1);
});
