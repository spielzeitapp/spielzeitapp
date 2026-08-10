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

/** Empfohlenes Ziel nach E-Mail-Bestätigung (Passwort setzen / App-Einstieg). */
export const AUTH_EMAIL_CONFIRM_PATH = '/app/set-password';
