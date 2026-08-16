/**
 * Static check: auth pages must not vertically center (Safari clip) and
 * confirmation-mail patch script must stay neutral for shared signup template.
 * Run: node scripts/parent-invite-ux-polish-test.mjs
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const register = read('src/pages/RegisterPage.tsx');
const login = read('src/pages/LoginPage.tsx');
const forgot = read('src/pages/ForgotPasswordPage.tsx');
const accept = read('src/pages/ParentInviteAcceptPage.tsx');
const app = read('src/app/App.tsx');
const layout = read('src/app/layout/AuthMinimalLayout.tsx');
const mailScript = read('scripts/parent-invite-patch-confirmation-mail.mjs');
const indexHtml = read('index.html');

assert.ok(layout.includes('safe-area-inset-top'));
assert.ok(layout.includes('overflow-y-auto'));
assert.ok(!layout.includes('justify-center'));
const shell = read('src/app/layout/authPageShell.ts');
assert.ok(shell.includes('AUTH_PAGE_SHELL_CLASS'));
assert.ok(shell.includes('AUTH_PAGE_CARD_CLASS'));

for (const [name, src] of [
  ['register', register],
  ['login', login],
  ['forgot', forgot],
]) {
  assert.ok(src.includes('AUTH_PAGE_SHELL_CLASS'), `${name} uses shell`);
  assert.ok(!src.includes('justify-center'), `${name} must not vertical-center`);
  assert.ok(!src.includes('min-h-[50vh]'), `${name} must not use min-h-[50vh]`);
}

assert.ok(register.includes('Registrieren'));
assert.ok(register.includes('E-Mail bestätigen'));
assert.ok(login.includes('Anmelden'));
assert.ok(accept.includes('safe-area-inset-bottom') || accept.includes('AuthMinimalLayout'));

assert.ok(app.includes('AuthMinimalLayout'));
assert.ok(/path="register"[\s\S]*AuthMinimalLayout|AuthMinimalLayout[\s\S]*path="register"/.test(app));
assert.ok(app.includes('path="login"'));
assert.ok(app.includes('path="app/parent-invite'));

assert.ok(indexHtml.includes('viewport-fit=cover'));

const confirmHtmlMatch = mailScript.match(/const CONFIRM_HTML = `([\s\S]*?)`;/);
assert.ok(confirmHtmlMatch, 'CONFIRM_HTML template present');
const confirmHtml = confirmHtmlMatch[1];
assert.ok(confirmHtml.includes('Danach kannst du mit SpielzeitApp fortfahren.'));
assert.ok(confirmHtml.includes('Bestätige jetzt deine E-Mail-Adresse, um deine Registrierung abzuschließen.'));
assert.ok(!confirmHtml.includes('Team auswählen'));
assert.ok(!confirmHtml.includes('Kind verknüpfen'));
assert.ok(mailScript.includes('ALLOW_LIVE_CONFIRM_MAIL_PATCH'));

console.log('parent-invite-ux-polish-test: OK');
