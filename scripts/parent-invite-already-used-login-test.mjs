/**
 * PARENT-INVITE.ALREADY-USED-LOGIN — logged-out already_used shows login escape hatch.
 * Run: node scripts/parent-invite-already-used-login-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const accept = fs.readFileSync(path.join(root, 'src/pages/ParentInviteAcceptPage.tsx'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8');
const invites = fs.readFileSync(path.join(root, 'src/lib/parentLinkInvites.ts'), 'utf8');

// Logged-out already_used: message + login CTA with invite next
assert.ok(
  accept.includes("!user &&\n            preview?.status === 'already_used'") ||
    accept.includes('!user &&\r\n            preview?.status === \'already_used\''),
  'logged-out already_used branch',
);
assert.ok(accept.includes('Zur Anmeldung'), 'login button label');
assert.ok(accept.includes('`/login?${authQuery}`'), 'login link uses authQuery with next+email');

// authQuery built from invite path + email
assert.ok(accept.includes('buildParentInviteAuthQuery({ next: authNext, email: inviteEmail })'));
assert.ok(accept.includes('buildParentInviteAuthNext(token)'));

// Email stash on peek terminal (when available)
assert.ok(accept.includes('peek.recipientEmail'), 'stash peek recipient email');
assert.ok(accept.includes('stashParentInviteEmail(peek.recipientEmail)'));

// Logged-in already_used: optional Zur App, no login detour
assert.ok(accept.includes("user && preview?.status === 'already_used'"), 'logged-in already_used branch');
assert.ok(
  accept.includes("['invalid_token', 'expired', 'revoked', 'error'].includes(preview.status)"),
  'generic terminal block excludes already_used',
);
assert.ok(!accept.includes("'already_used', 'error'"), 'already_used removed from generic terminal list');

// Login page supports locked invite email from query/stash
assert.ok(login.includes('inviteEmailLocked'), 'login email lock');
assert.ok(login.includes('buildParentInviteAuthQuery'), 'login invite query helper');
assert.ok(login.includes('ensureParentInviteContextFromNext'), 'login restores invite token from next');

// Post-login return path unchanged
assert.ok(invites.includes('buildParentInviteAuthNext'));
assert.ok(invites.includes('preview_parent_link_invite'));

console.log('parent-invite-already-used-login-test: OK');
