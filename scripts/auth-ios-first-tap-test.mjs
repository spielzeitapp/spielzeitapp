/**
 * AUTH.IOS-FIRST-TAP — restore immediate keyboard on first tap for auth inputs.
 * Run: node scripts/auth-ios-first-tap-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const login = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8');
const register = fs.readFileSync(path.join(root, 'src/pages/RegisterPage.tsx'), 'utf8');
const forgot = fs.readFileSync(path.join(root, 'src/pages/ForgotPasswordPage.tsx'), 'utf8');

for (const [name, src] of [
  ['login', login],
  ['register', register],
  ['forgot', forgot],
]) {
  assert.ok(!src.includes('IOS_DEFER_KEYBOARD_INPUT_PROPS'), `${name}: no iOS defer props`);
  assert.ok(!src.includes('unlockIosInput'), `${name}: no readOnly unlock helper`);
  assert.ok(!/\breadOnly:\s*true\b/.test(src), `${name}: no initial readOnly`);
  assert.ok(!/\bonTouchStart:\s*unlockIosInput\b/.test(src), `${name}: no touch unlock`);
  assert.ok(!/\bautoFocus\b/.test(src), `${name}: no autoFocus`);
  assert.ok(!/\.focus\(/i.test(src), `${name}: no programmatic focus()`);
}

assert.ok(login.includes('autoComplete="email"'), 'login email autocomplete');
assert.ok(login.includes('inputMode="email"'), 'login email inputMode');
assert.ok(login.includes('autoComplete="current-password"'), 'login password autocomplete');
assert.ok(!login.includes('autoComplete={isParentInviteFlow ? \'off\' : \'on\'}'), 'login form autocomplete not forced off');

assert.ok(login.includes('login-email-display'), 'invite login email is static text');
assert.ok(login.includes('lockedEmailDisplayClass'), 'invite login email styling');
assert.ok(!login.includes('readOnly={inviteEmailLocked}'), 'invite login email not readOnly input');
assert.ok(login.includes('autoComplete="current-password"'), 'invite login password remains editable input');

assert.ok(register.includes('reg-email-display'), 'invite register email is static text');
assert.ok(register.includes('autoComplete="given-name"'), 'register first name autocomplete');
assert.ok(register.includes('autoComplete="family-name"'), 'register last name autocomplete');
assert.ok(register.includes('autoComplete="email"'), 'register email autocomplete');
assert.ok(register.includes('autoComplete="new-password"'), 'register password autocomplete');
assert.ok(!register.includes('autoComplete={isParentInviteFlow ? \'off\' : \'on\'}'), 'register form autocomplete not forced off');

assert.ok(forgot.includes('autoComplete="email"'), 'forgot email autocomplete');
assert.ok(forgot.includes('inputMode="email"'), 'forgot email inputMode');

assert.ok(login.includes('stashParentInviteEmail'), 'login invite email state preserved');
assert.ok(register.includes('stashParentInviteEmail'), 'register invite email state preserved');
assert.ok(login.includes('lockedInviteEmail'), 'login invite email binding preserved');
assert.ok(register.includes('inviteEmailLocked'), 'register invite email binding preserved');
assert.ok(login.includes('resolvePostAuthDestination'), 'login auth redirect preserved');
assert.ok(register.includes('resolvePostAuthDestination'), 'register auth redirect preserved');

console.log('auth-ios-first-tap-test: OK');
