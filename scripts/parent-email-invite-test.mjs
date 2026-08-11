/**
 * Statische Checks für Eltern-E-Mail-Einladungen.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const mig = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260811180000_parent_link_email_invites.sql'),
  'utf8',
);
const api = fs.readFileSync(path.join(root, 'api/parent/send-invite.js'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'src/components/team/PlayerGuardiansPanel.tsx'), 'utf8');
const accept = fs.readFileSync(path.join(root, 'src/pages/ParentInviteAcceptPage.tsx'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8');
const register = fs.readFileSync(path.join(root, 'src/pages/RegisterPage.tsx'), 'utf8');
const authRedirect = fs.readFileSync(path.join(root, 'src/lib/authRedirect.ts'), 'utf8');
const parentLib = fs.readFileSync(path.join(root, 'src/lib/parentChildLink.ts'), 'utf8');
const inviteLib = fs.readFileSync(path.join(root, 'src/lib/parentLinkInvites.ts'), 'utf8');

assert.ok(mig.includes('recipient_email'));
assert.ok(mig.includes('preview_parent_link_invite'));
assert.ok(mig.includes('mark_parent_link_invite_sent'));
assert.ok(mig.includes('email_mismatch'));
assert.ok(mig.includes('email_confirmed_at'));
assert.ok(mig.includes('SET search_path = public'));
assert.ok(mig.includes('REVOKE ALL ON FUNCTION public.preview_parent_link_invite(text) FROM anon'));

assert.ok(api.includes('signInWithOtp') || api.includes('/auth/v1/otp'));
assert.ok(api.includes('email_redirect_to') || api.includes('emailRedirectTo'));
assert.ok(api.includes('https://app.spielzeitapp.at'));
assert.ok(api.includes('parent_invite_refuses_live_domain'));
assert.ok(api.includes('shxugattqatahckhspwk'));
assert.ok(api.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(!api.includes('VITE_SUPABASE_SERVICE'));
assert.ok(api.includes('code_fallback'));
assert.ok(api.includes('localhost'));
assert.ok(api.includes("origin: STAGING_ORIGIN"));
assert.ok(api.includes('/app/parent-invite'));
assert.ok(api.includes('resolveInviteOrigin'));
assert.ok(api.includes('parent_invite_refuses_live_supabase'));
assert.ok(!api.includes('req.headers.origin'));
assert.ok(!api.includes('x-forwarded-host'));
assert.ok(api.includes('email_redirect_to'));
assert.ok(api.includes('/auth/v1/otp'));

assert.ok(panel.includes('Einladung per E-Mail senden'));
assert.ok(panel.includes('Einladungscode erstellen'));
assert.ok(panel.includes('Verknüpfung aufheben'));
assert.ok(panel.includes('sendParentEmailInvite'));

assert.ok(accept.includes('stashParentInviteToken'));
assert.ok(accept.includes("navigate('/app/parent-invite', { replace: true })"));
assert.ok(accept.includes('email_mismatch'));
assert.ok(accept.includes('Verknüpfung bestätigen'));
assert.ok(app.includes('parent-invite'));
assert.ok(app.includes('ParentInviteAcceptPage'));

assert.ok(login.includes('searchParams.get(\'next\')') || login.includes('searchParams.get("next")'));
assert.ok(login.includes('isSafeAuthRedirectPath'));
assert.ok(register.includes('emailRedirectPath'));
assert.ok(authRedirect.includes('isSafeAuthRedirectPath'));

assert.ok(parentLib.includes('email_mismatch'));
assert.ok(inviteLib.includes('sendParentEmailInvite'));
assert.ok(inviteLib.includes('/api/parent/send-invite'));

// Token shape still 48 hex; player codes not accepted
assert.ok(parentLib.includes('^[0-9a-f]{48}$') || parentLib.includes('/^[0-9a-f]{48}$/'));

console.log('parent-email-invite-test: OK');
