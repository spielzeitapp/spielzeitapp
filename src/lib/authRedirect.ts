/**
 * Supabase Auth redirects — immer aktueller Host (Live, Staging, Vercel-Preview).
 * URLs müssen in Supabase unter Authentication → Redirect URLs erlaubt sein.
 *
 * Staging-Site-URL sollte https://app.spielzeitapp.at sein (nicht localhost).
 * Browser-Origin hat Vorrang vor Env, damit lokale Dev und Staging korrekt bleiben.
 */

const ALLOWED_APP_PATH_PREFIXES = [
  '/',
  '/app',
  '/login',
  '/register',
  '/forgot-password',
] as const;

/** Standard nach „Zur App“ / App-Einstieg ohne Invite oder Deep Link. */
export const POST_AUTH_HOME_PATH = '/app/home';

/** Nur relative App-Pfade; keine externe Open-Redirect. */
export function isSafeAuthRedirectPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  if (trimmed.includes('\\') || trimmed.includes('@')) return false;
  return ALLOWED_APP_PATH_PREFIXES.some(
    (p) => trimmed === p || trimmed.startsWith(`${p}/`) || (p === '/app' && trimmed.startsWith('/app')),
  );
}

export function getAuthRedirectOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, '');
    // Bewusst keine hartcodierte localhost-Produktion: Origin folgt dem Browser.
    return origin;
  }

  const envBase = import.meta.env.VITE_APP_BASE_URL;
  if (typeof envBase === 'string' && envBase.trim()) {
    try {
      const u = new URL(envBase.trim());
      return u.origin.replace(/\/$/, '');
    } catch {
      return envBase.trim().replace(/\/$/, '');
    }
  }

  return '';
}

export function getAuthRedirectUrl(path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const safePath = isSafeAuthRedirectPath(normalizedPath) ? normalizedPath : '/app';
  const origin = getAuthRedirectOrigin();
  if (!origin) return safePath;
  return `${origin}${safePath}`;
}

/**
 * Nach normaler Signup-E-Mail-Bestätigung: App-Einstieg (Rollenwahl/Onboarding-Gate).
 * Nicht /app/set-password — Passwort wurde bei der Registrierung bereits gesetzt.
 */
export const AUTH_EMAIL_CONFIRM_PATH = '/app';

/** Nur für „Passwort vergessen“ / Recovery. */
export const AUTH_PASSWORD_RECOVERY_PATH = '/app/set-password';

const PASSWORD_RECOVERY_FLAG_KEY = 'sz_auth_password_recovery';
const EMAIL_CONFIRM_FLAG_KEY = 'sz_auth_email_confirm';

/** Liest type aus Hash/Query, bevor Supabase die URL konsumiert. */
export function captureAuthCallbackTypeFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const search = window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : window.location.search;
    const params = new URLSearchParams(hash || search);
    const type = (params.get('type') ?? '').trim().toLowerCase();
    if (type === 'recovery') {
      window.sessionStorage.setItem(PASSWORD_RECOVERY_FLAG_KEY, '1');
      window.sessionStorage.removeItem(EMAIL_CONFIRM_FLAG_KEY);
      return;
    }
    if (
      type === 'signup' ||
      type === 'invite' ||
      type === 'magiclink' ||
      type === 'email_change' ||
      type === 'email'
    ) {
      window.sessionStorage.setItem(EMAIL_CONFIRM_FLAG_KEY, '1');
      window.sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG_KEY);
    }
  } catch {
    // ignore storage / URL errors
  }
}

export function markPasswordRecoveryFlow(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PASSWORD_RECOVERY_FLAG_KEY, '1');
    window.sessionStorage.removeItem(EMAIL_CONFIRM_FLAG_KEY);
  } catch {
    // ignore
  }
}

export function clearPasswordRecoveryFlow(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG_KEY);
  } catch {
    // ignore
  }
}

export function clearEmailConfirmFlow(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(EMAIL_CONFIRM_FLAG_KEY);
  } catch {
    // ignore
  }
}

export function isPasswordRecoveryFlow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem(PASSWORD_RECOVERY_FLAG_KEY) === '1') return true;
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const search = window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : window.location.search;
    const params = new URLSearchParams(hash || search);
    return (params.get('type') ?? '').trim().toLowerCase() === 'recovery';
  } catch {
    return false;
  }
}

export function isEmailConfirmFlow(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem(EMAIL_CONFIRM_FLAG_KEY) === '1') return true;
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const search = window.location.search.startsWith('?')
      ? window.location.search.slice(1)
      : window.location.search;
    const params = new URLSearchParams(hash || search);
    const type = (params.get('type') ?? '').trim().toLowerCase();
    return (
      type === 'signup' ||
      type === 'invite' ||
      type === 'magiclink' ||
      type === 'email_change' ||
      type === 'email'
    );
  } catch {
    return false;
  }
}
