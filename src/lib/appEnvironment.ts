/**
 * App-Umgebung (Production / Staging / local).
 * Gesetzt über VITE_APP_ENV auf Vercel; lokal oft unset → development.
 */
export type AppDeployEnv = 'production' | 'staging' | 'development';

/** Live-Supabase (spielzeitapp-nsg) — Staging darf diese Host-ID nie nutzen. */
export const LIVE_SUPABASE_PROJECT_REF = 'shxugattqatahckhspwk';

/** Staging-Supabase (spielzeitapp-staging). */
export const STAGING_SUPABASE_PROJECT_REF = 'acbaecjzoabafbsjrzvr';

export function getAppDeployEnv(): AppDeployEnv {
  const raw = String(import.meta.env.VITE_APP_ENV ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'staging' || raw === 'test') return 'staging';
  if (raw === 'production' || raw === 'prod') return 'production';
  if (import.meta.env.PROD && raw === '') return 'production';
  return 'development';
}

export function isStagingApp(): boolean {
  return getAppDeployEnv() === 'staging';
}

export function isProductionApp(): boolean {
  return getAppDeployEnv() === 'production';
}

/** true, wenn die konfigurierte Supabase-URL zum Live-Projekt gehört. */
export function supabaseUrlLooksLikeLive(url: string | undefined | null): boolean {
  const u = String(url ?? '').toLowerCase();
  return u.includes(`${LIVE_SUPABASE_PROJECT_REF}.supabase.co`);
}

/** true, wenn die URL zum Staging-Projekt gehört. */
export function supabaseUrlLooksLikeStaging(url: string | undefined | null): boolean {
  const u = String(url ?? '').toLowerCase();
  return u.includes(`${STAGING_SUPABASE_PROJECT_REF}.supabase.co`);
}
