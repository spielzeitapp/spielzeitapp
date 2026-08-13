/**
 * PARENT-INVITE.W4Y-SMTP — static + unit-style guards (no secrets, no network).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const require = createRequire(import.meta.url);

const mailLib = read('api/_lib/sendParentInviteEmail.js');
const sendInvite = read('api/parent/send-invite.js');
const envExample = read('.env.example');
const pkg = JSON.parse(read('package.json'));

assert.ok(pkg.dependencies?.nodemailer, 'nodemailer must be a dependency');
assert.ok(require.resolve('nodemailer'));

// Env var names (exact)
for (const key of [
  'PARENT_INVITE_SMTP_HOST',
  'PARENT_INVITE_SMTP_PORT',
  'PARENT_INVITE_SMTP_SECURE',
  'PARENT_INVITE_SMTP_USER',
  'PARENT_INVITE_SMTP_PASSWORD',
  'PARENT_INVITE_SMTP_FROM',
  'PARENT_INVITE_SMTP_REPLY_TO',
]) {
  assert.ok(mailLib.includes(key), `mail lib must read ${key}`);
  assert.ok(envExample.includes(key), `.env.example must document ${key}`);
}
assert.ok(envExample.includes('smtp.world4you.com'));
assert.ok(envExample.includes('PARENT_INVITE_SMTP_SECURE=false'));
assert.ok(!envExample.includes('VITE_PARENT_INVITE_SMTP'));

// Transport priority markers
assert.ok(mailLib.includes('getWorld4YouSmtpConfig'));
assert.ok(mailLib.includes('isDirectMailConfigured'));
assert.ok(mailLib.includes("provider: 'world4you_smtp'") || mailLib.includes("'world4you_smtp'"));
assert.ok(mailLib.includes('requireTLS'));
assert.ok(mailLib.includes('connectionTimeout'));
assert.ok(!mailLib.includes('rejectUnauthorized: false'));

// Mail content
assert.ok(mailLib.includes('Deine Einladung zu SpielzeitApp'));
assert.ok(mailLib.includes('Einladung öffnen'));
assert.ok(mailLib.includes('buildParentInviteEmailText'));
assert.ok(mailLib.includes('buildParentInviteEmailHtml'));
assert.ok(mailLib.includes('dein Kind direkt mit deinem Elternkonto verknüpfen'));

// API response contract
assert.ok(sendInvite.includes("delivery = 'direct'"));
assert.ok(sendInvite.includes("delivery = 'otp_fallback'"));
assert.ok(sendInvite.includes("provider = 'supabase'"));
assert.ok(sendInvite.includes('auth_stub_created'));
assert.ok(sendInvite.includes('directMail.configured'));
assert.ok(sendInvite.includes('smtp_send_failed'));
// OTP only when direct mail NOT configured
assert.ok(sendInvite.includes('} else {'));
assert.ok(sendInvite.includes('otp_fallback'));

// No secrets in source
assert.ok(!/PASSWORD\s*=\s*['"][^'"]+['"]/.test(mailLib));
assert.ok(!sendInvite.includes('console.log(token'));
assert.ok(!mailLib.includes('console.log(smtp.pass'));

// Import real helpers with env isolation
const {
  buildParentInviteEmailHtml,
  buildParentInviteEmailText,
  getWorld4YouSmtpConfig,
  isDirectMailConfigured,
  isWorld4YouSmtpConfigured,
  isResendConfigured,
} = await import('../api/_lib/sendParentInviteEmail.js');

const acceptUrl = 'https://app.spielzeitapp.at/app/parent-invite/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const html = buildParentInviteEmailHtml({ acceptUrl });
const text = buildParentInviteEmailText({ acceptUrl });
assert.ok(html.includes(acceptUrl));
assert.ok(html.includes('Einladung öffnen'));
assert.ok(html.includes('&lt;') === false || !html.includes('<script'));
assert.ok(text.includes(acceptUrl));
assert.ok(text.includes('Elternteil'));

// Config detection without leaking: unset → not configured
const saved = { ...process.env };
for (const k of Object.keys(process.env)) {
  if (k.startsWith('PARENT_INVITE_SMTP_') || k === 'RESEND_API_KEY') delete process.env[k];
}
assert.equal(isWorld4YouSmtpConfigured(), false);
assert.equal(isResendConfigured(), false);
assert.equal(isDirectMailConfigured(), false);
assert.equal(getWorld4YouSmtpConfig(), null);

process.env.PARENT_INVITE_SMTP_HOST = 'smtp.world4you.com';
process.env.PARENT_INVITE_SMTP_PORT = '587';
process.env.PARENT_INVITE_SMTP_SECURE = 'false';
process.env.PARENT_INVITE_SMTP_USER = 'user@example.com';
process.env.PARENT_INVITE_SMTP_PASSWORD = 'secret-not-logged';
process.env.PARENT_INVITE_SMTP_FROM = 'SpielzeitApp <login@spielzeitapp.at>';
assert.equal(isWorld4YouSmtpConfigured(), true);
assert.equal(isDirectMailConfigured(), true);
const cfg = getWorld4YouSmtpConfig();
assert.equal(cfg.host, 'smtp.world4you.com');
assert.equal(cfg.port, 587);
assert.equal(cfg.secure, false);

// Restore env
for (const k of Object.keys(process.env)) {
  if (!(k in saved)) delete process.env[k];
}
Object.assign(process.env, saved);

console.log('parent-invite-w4y-smtp-test: OK');
