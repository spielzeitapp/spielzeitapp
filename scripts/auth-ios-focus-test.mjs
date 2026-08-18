/**
 * AUTH.IOS-FOCUS — no automatic keyboard focus on auth/invite pages.
 * Run: node scripts/auth-ios-focus-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const login = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8');
const register = fs.readFileSync(path.join(root, 'src/pages/RegisterPage.tsx'), 'utf8');
const forgot = fs.readFileSync(path.join(root, 'src/pages/ForgotPasswordPage.tsx'), 'utf8');
const accept = fs.readFileSync(path.join(root, 'src/pages/ParentInviteAcceptPage.tsx'), 'utf8');

for (const [name, src] of [
  ['login', login],
  ['register', register],
  ['forgot', forgot],
  ['accept', accept],
]) {
  assert.ok(!/\bautoFocus\b/.test(src), `${name}: no autoFocus prop`);
  assert.ok(!/\.focus\(/i.test(src), `${name}: no programmatic focus()`);
  assert.ok(!/requestAnimationFrame[\s\S]{0,80}focus/i.test(src), `${name}: no rAF focus`);
  assert.ok(!/setTimeout[\s\S]{0,80}focus/i.test(src), `${name}: no delayed focus`);
}

assert.ok(!login.includes('IOS_DEFER_KEYBOARD_INPUT_PROPS'), 'login no readOnly defer trick');
assert.ok(!register.includes('IOS_DEFER_KEYBOARD_INPUT_PROPS'), 'register no readOnly defer trick');
assert.ok(!forgot.includes('IOS_DEFER_KEYBOARD_INPUT_PROPS'), 'forgot no readOnly defer trick');

assert.ok(login.includes('login-email-display'), 'login locked email is static');
assert.ok(login.includes('lockedEmailDisplayClass'), 'login locked email styling');
assert.ok(login.includes('select-none'), 'login locked email not selectable');
assert.ok(!login.includes('readOnly={inviteEmailLocked}'), 'login locked email not readOnly input');

assert.ok(register.includes('reg-email-display'), 'register locked email is static');
assert.ok(!register.includes('readOnly={inviteEmailLocked}'), 'register locked email not readOnly input');

assert.ok(login.includes('stashParentInviteEmail'), 'login invite email still stashed');
assert.ok(register.includes('stashParentInviteEmail'), 'register invite email still stashed');
assert.ok(login.includes('lockedInviteEmail'), 'login email binding preserved');
assert.ok(register.includes('inviteEmailLocked'), 'register email binding preserved');

assert.ok(login.includes('redeem_parent_link_invite') === false, 'login unchanged redeem');
assert.ok(accept.includes('redeemParentLinkInvite'), 'invite redeem unchanged');
assert.ok(accept.includes('peekParentLinkInvite'), 'invite peek unchanged');

console.log('auth-ios-focus-test: OK');
