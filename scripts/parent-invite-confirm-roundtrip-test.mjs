/**
 * PARENT-INVITE.CONFIRM-ROUNDTRIP-FIX — static assertions.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const api = read('api/parent/send-invite.js');
const login = read('src/pages/LoginPage.tsx');
const register = read('src/pages/RegisterPage.tsx');
const accept = read('src/pages/ParentInviteAcceptPage.tsx');
const postAuth = read('src/lib/postAuthDestination.ts');
const authRedirect = read('src/lib/authRedirect.ts');

// Confirm redirect must be self-contained (login + next + email), not bare accept-only.
assert.ok(api.includes("confirmQs.set('next', acceptPath)"));
assert.ok(api.includes("confirmQs.set('email', email)"));
assert.ok(api.includes("confirmQs.set('invite_confirmed', '1')"));
assert.ok(api.includes('`${originRes.origin}/login?${confirmQs.toString()}`'));
assert.ok(api.includes('complete_signup'));
assert.ok(api.includes('spielzeit_parent_invite_token'));

// Login recovers invite after confirm
assert.ok(login.includes('invite_confirmed'));
assert.ok(login.includes('E-Mail bestätigt. Melde dich jetzt an, um die Einladung anzunehmen.'));
assert.ok(login.includes('isEmailConfirmFlow'));
assert.ok(login.includes('resolvePendingParentInvitePath(user)'));
assert.ok(login.includes('readParentInviteTokenFromUserMetadata'));
assert.ok(login.includes("autoComplete={inviteEmailLocked ? 'off' : 'username'}"));
assert.ok(login.includes('autoComplete="current-password"'));
assert.ok(login.includes('parentInviteFlowHint: true'));
assert.ok(login.includes('consciousLogin: false') || login.includes('consciousLogin: !isParentInviteFlow'));

// No splash for invite: invite checked before branded_entry
assert.ok(postAuth.indexOf('resolvePendingParentInvitePath') < postAuth.indexOf('branded_entry'));
assert.ok(postAuth.indexOf("kind: 'parent_invite'") < postAuth.indexOf("kind: 'branded_entry'"));

// Normal registration unchanged path
assert.ok(register.includes('supabase.auth.signUp'));
assert.ok(register.includes('AUTH_EMAIL_CONFIRM_PATH') || register.includes("'/app'"));
assert.ok(register.includes('complete_signup'));

assert.ok(accept.includes('invite_confirmed'));
assert.ok(authRedirect.includes('isEmailConfirmFlow'));

console.log('parent-invite-confirm-roundtrip-test: OK');
