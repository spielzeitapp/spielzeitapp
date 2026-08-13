/**
 * PARENT-INVITE.NEW-ACCOUNT-FIX — static assertions.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const mig = read(
  'supabase/migrations/20260812210000_parent_invite_peek_account_exists.sql',
);
const inviteLib = read('src/lib/parentLinkInvites.ts');
const accept = read('src/pages/ParentInviteAcceptPage.tsx');
const register = read('src/pages/RegisterPage.tsx');
const login = read('src/pages/LoginPage.tsx');
const api = read('api/parent/send-invite.js');

assert.ok(mig.includes('account_exists'));
assert.ok(mig.includes('encrypted_password'));
assert.ok(mig.includes('parent_invite_auth_email_status'));
assert.ok(mig.includes('GRANT EXECUTE ON FUNCTION public.parent_invite_auth_email_status(text) TO service_role'));
assert.ok(!mig.includes('GRANT EXECUTE ON FUNCTION public.parent_invite_auth_email_status(text) TO anon'));
assert.ok(!mig.includes('shxugattqatahckhspwk'));

assert.ok(inviteLib.includes('accountExists'));
assert.ok(inviteLib.includes('account_exists'));
assert.ok(inviteLib.includes('buildParentInviteAuthQuery'));

assert.ok(accept.includes('buildParentInviteAuthQuery'));
assert.ok(accept.includes('peek.accountExists'));
assert.ok(accept.includes('`/login?${qs}') || accept.includes('/login?'));
assert.ok(accept.includes('`/register?${qs}') || accept.includes('/register?'));
assert.ok(accept.includes('Weiter zur Registrierung'));
assert.ok(accept.includes('Weiter zur Anmeldung'));

assert.ok(register.includes('complete_signup'));
assert.ok(register.includes('inviteEmailLocked'));
assert.ok(register.includes('hasInviteSession'));
assert.ok(register.includes('eingeladene E-Mail-Adresse'));
assert.ok(register.includes("if (inviteEmailLocked) return"));

assert.ok(login.includes('buildParentInviteAuthQuery'));
assert.ok(login.includes('stashParentInviteEmail'));
assert.ok(login.includes('parentInviteFlowHint: true'));
assert.ok(login.includes("if (inviteEmailLocked) return"));

assert.ok(api.includes("action === 'complete_signup'") || api.includes('complete_signup'));
assert.ok(api.includes('parent_invite_auth_email_status'));
assert.ok(api.includes("auth_route: hasPassword ? 'login' : 'register'"));
assert.ok(api.includes('create_user: createUser') || api.includes('create_user: !authExists'));
assert.ok(api.includes('const createUser = !authExists') || api.includes('create_user: !authExists'));
assert.ok(api.includes('sendParentInviteEmail') || api.includes('auth_stub_created'));
assert.ok(api.includes('/register?'));
assert.ok(api.includes('/login?'));
assert.ok(api.includes('invite_confirmed'));
assert.ok(api.includes('email_mismatch'));
assert.ok(api.includes('account_exists'));
assert.ok(!api.includes('shxugattqatahckhspwk') || api.includes('LIVE_REF'));

// Normal registration without invite still uses signUp
assert.ok(register.includes('supabase.auth.signUp'));
assert.ok(register.includes('isParentInviteFlow'));

console.log('parent-invite-new-account-fix-test: OK');
