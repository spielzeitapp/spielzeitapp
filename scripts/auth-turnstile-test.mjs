import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [widget, register, login, adminLogin, forgotPassword, authProvider] = await Promise.all([
  read('src/components/auth/TurnstileWidget.tsx'),
  read('src/pages/RegisterPage.tsx'),
  read('src/pages/LoginPage.tsx'),
  read('src/pages/AdminLoginPage.tsx'),
  read('src/pages/ForgotPasswordPage.tsx'),
  read('src/auth/AuthProvider.tsx'),
]);

assert.ok(widget.includes('VITE_TURNSTILE_SITE_KEY'));
assert.ok(widget.includes('expired-callback'));
assert.ok(widget.includes("'error-callback'"));
assert.ok(widget.includes('window.turnstile.reset'));

assert.ok(register.includes('<TurnstileWidget'));
assert.ok(register.includes('captchaToken'));
assert.ok(register.includes('supabase.auth.signUp'));
assert.ok(register.includes('supabase.auth.resend'));

assert.ok(login.includes('<TurnstileWidget'));
assert.ok(login.includes('options: captchaToken ? { captchaToken } : undefined'));

assert.ok(adminLogin.includes('<TurnstileWidget'));
assert.ok(adminLogin.includes('captchaToken ?? undefined'));
assert.ok(authProvider.includes('options: captchaToken ? { captchaToken } : undefined'));

assert.ok(forgotPassword.includes('<TurnstileWidget'));
assert.ok(forgotPassword.includes('resetPasswordForEmail'));
assert.ok(forgotPassword.includes('captchaToken: captchaToken ?? undefined'));

console.log('auth-turnstile-test: OK');
