import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import { LIVE_REF, LIVE_ORIGIN } from '../server/lib/authEmailHook.js';

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Missing Supabase access token');

async function management(path, options = {}) {
  const response = await fetch('https://api.supabase.com/v1/projects/' + LIVE_REF + path, {
    ...options,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Supabase management request failed: ' + response.status);
  return response.json();
}

const project = await management('');
if (project.id !== LIVE_REF || project.name !== 'spielzeitapp-nsg') {
  throw new Error('Unexpected LIVE project');
}

const version = '20261120101500';
const migrationPath = 'supabase/migrations/' + version + '_auth_signup_mail_outbox.sql';
const migration = await readFile(new URL('../' + migrationPath, import.meta.url), 'utf8');
const plan = JSON.parse(await readFile(new URL('../release/live-plan.json', import.meta.url), 'utf8'));
const blobHash = createHash('sha1').update('blob ' + Buffer.byteLength(migration) + '\0').update(migration).digest('hex');
if (plan.migrations[migrationPath] !== blobHash) throw new Error('Unreviewed signup mail migration');

const query = (sql) => management('/database/query', { method: 'POST', body: JSON.stringify({ query: sql }) });
const [{ applied }] = await query(
  "select exists(select 1 from supabase_migrations.schema_migrations where version='" + version + "') as applied",
);
if (!applied) {
  await query('begin;\n' + migration + "\ninsert into supabase_migrations.schema_migrations(version,name) values ('"
    + version + "','auth_signup_mail_outbox');\ncommit;");
}

const [{ scheduled, available }] = await query(`
  select exists(select 1 from cron.job where jobname = 'auth-signup-mail' and active) as scheduled,
    to_regprocedure('public.enqueue_auth_signup_mail(text,uuid,text,jsonb)') is not null as available
`);
if (!available) throw new Error('LIVE signup mail RPC is unavailable');
if (!scheduled) {
  await query("select cron.schedule('auth-signup-mail','* * * * *',$job$select auth_signup_mail.tick('"
    + LIVE_ORIGIN + "');$job$)");
}
const [{ active }] = await query("select exists(select 1 from cron.job where jobname = 'auth-signup-mail' and active) as active");
if (!active) throw new Error('LIVE signup mail scheduler is inactive');

const path = '/config/auth';
const before = await management(path);
const currentHook = LIVE_ORIGIN + '/api/parent/send-invite?auth_email_hook=1';
if (before.hook_send_email_enabled && before.hook_send_email_uri !== currentHook) {
  throw new Error('Unexpected LIVE email hook');
}
if (before.hook_send_email_enabled) {
  console.log('LIVE auth email hook is configured; signup delivery uses the durable outbox.');
  process.exit(0);
}
if (before.external_email_enabled !== true || before.mailer_autoconfirm !== false) {
  throw new Error('LIVE email signup or confirmation settings are unexpected');
}

const port = Number(before.smtp_port);
if (!before.smtp_host || !before.smtp_user || !before.smtp_pass || !before.smtp_admin_email
  || ![465, 587, 2465, 2525].includes(port)) {
  throw new Error('LIVE custom SMTP settings are incomplete');
}

const transport = nodemailer.createTransport({
  host: before.smtp_host,
  port,
  secure: port === 465 || port === 2465,
  requireTLS: port !== 465 && port !== 2465,
  auth: { user: before.smtp_user, pass: before.smtp_pass },
  connectionTimeout: 7000,
  greetingTimeout: 7000,
  socketTimeout: 7000,
  tls: { minVersion: 'TLSv1.2' },
});
try {
  await transport.verify();
} catch (error) {
  const code = String(error?.code ?? '');
  throw new Error('LIVE SMTP connection or authentication failed' + (/^[A-Z0-9_]+$/.test(code) ? ': ' + code : ''));
} finally {
  transport.close();
}

const template = await readFile(new URL('../supabase/templates/confirmation.html', import.meta.url), 'utf8');
const changes = {
  hook_send_email_enabled: false,
  mailer_templates_confirmation_content: template,
};
if (Object.entries(changes).some(([key, value]) => before[key] !== value)) {
  await management(path, { method: 'PATCH', body: JSON.stringify(changes) });
}

const after = await management(path);
for (const [key, value] of Object.entries(changes)) {
  if (after[key] !== value) throw new Error('LIVE auth configuration readback failed for ' + key);
}
for (const key of ['external_email_enabled', 'mailer_autoconfirm', 'site_url', 'uri_allow_list',
  'hook_send_email_uri', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_admin_email', 'smtp_sender_name']) {
  if (after[key] !== before[key]) throw new Error('Unexpected LIVE auth setting change: ' + key);
}
console.log('LIVE uses verified custom SMTP. Email confirmation and redirect settings are intact.');
