/**
 * Supabase Auth redirects — immer aktueller Host (Live, Staging, Vercel-Preview).
 * URLs müssen in Supabase unter Authentication → Redirect URLs erlaubt sein.
 *
 * Staging: VITE_APP_BASE_URL=https://test.spielzeitapp.at (oder staging.…),
 * niemals app.spielzeitapp.at. Browser-Origin hat Vorrang vor Env.
 */
export function getAuthRedirectOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  const envBase = import.meta.env.VITE_APP_BASE_URL;
  if (typeof envBase === 'string' && envBase.trim()) {
    return envBase.trim().replace(/\/$/, '');
  }

  return '';
}

export function getAuthRedirectUrl(path = '/'): string {
  const origin = getAuthRedirectOrigin();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!origin) return normalizedPath;
  return `${origin}${normalizedPath}`;
}
