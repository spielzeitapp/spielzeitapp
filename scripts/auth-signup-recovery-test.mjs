/**
 * Signup vs Recovery: E-Mail-Bestätigung darf kein Passwort-Formular erzwingen.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const authRedirect = fs.readFileSync(path.join(root, 'src/lib/authRedirect.ts'), 'utf8');
assert.ok(authRedirect.includes("export const AUTH_EMAIL_CONFIRM_PATH = '/app'"));
assert.ok(authRedirect.includes("export const AUTH_PASSWORD_RECOVERY_PATH = '/app/set-password'"));
assert.ok(authRedirect.includes('captureAuthCallbackTypeFromUrl'));
assert.ok(authRedirect.includes("type === 'recovery'"));
assert.ok(authRedirect.includes("type === 'signup'"));

const supabaseClient = fs.readFileSync(path.join(root, 'src/lib/supabaseClient.ts'), 'utf8');
assert.ok(supabaseClient.includes('captureAuthCallbackTypeFromUrl()'));

const authProvider = fs.readFileSync(path.join(root, 'src/auth/AuthProvider.tsx'), 'utf8');
assert.ok(authProvider.includes('PASSWORD_RECOVERY'));
assert.ok(authProvider.includes('markPasswordRecoveryFlow'));

const setPwd = fs.readFileSync(path.join(root, 'src/pages/SetPasswordPage.tsx'), 'utf8');
assert.ok(setPwd.includes('isPasswordRecoveryFlow'));
assert.ok(setPwd.includes('isEmailConfirmFlow'));
assert.ok(setPwd.includes('clearPasswordRecoveryFlow'));

const register = fs.readFileSync(path.join(root, 'src/pages/RegisterPage.tsx'), 'utf8');
assert.ok(register.includes('emailRedirectTo: getAuthRedirectUrl(emailRedirectPath)'));
assert.ok(register.includes('AUTH_EMAIL_CONFIRM_PATH'));

const forgot = fs.readFileSync(path.join(root, 'src/pages/ForgotPasswordPage.tsx'), 'utf8');
assert.ok(forgot.includes('AUTH_PASSWORD_RECOVERY_PATH'));

console.log('auth-signup-recovery-test: OK');
