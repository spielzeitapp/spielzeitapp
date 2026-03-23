import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/** Keine Spalte `profiles.is_admin` – Admin nur über `user_roles` / `memberships` (useSession). */
function friendlyProfileFetchError(raw: string): string {
  const m = raw.toLowerCase();
  if (
    m.includes('is_admin') ||
    m.includes('does not exist') ||
    m.includes('42703') ||
    (m.includes('column') && m.includes('profiles'))
  ) {
    return 'Profilnamen konnten nicht geladen werden. Bitte später erneut versuchen oder Support informieren.';
  }
  return raw;
}

/** Nur Anzeigedaten aus `profiles` (Vor-/Nachname). Globales Admin: `user_roles` / useSession, nicht profiles. */
export interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  display_name: string | null;
}

/**
 * Load current user's profile (first_name, last_name, full_name, display_name). Returns null until loaded or if no user.
 */
export function useProfile(userId: string | undefined | null): {
  profile: ProfileRow | null;
  loading: boolean;
  error: string | null;
} {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const { data, error: err } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, full_name, display_name')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        setLoading(false);
        if (err) {
          setError(friendlyProfileFetchError(err.message ?? 'Unbekannter Fehler'));
          setProfile(null);
          return;
        }
        setProfile((data as ProfileRow) ?? null);
      } catch (e: unknown) {
        if (cancelled) return;
        console.error('[useProfile] profile fetch failed', e);
        setLoading(false);
        setError(friendlyProfileFetchError(e instanceof Error ? e.message : String(e)));
        setProfile(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Profil blockiert keine Shell: nach 3s UI trotzdem bedienbar */
  useEffect(() => {
    if (!userId || !loading) return;
    console.info('[startup] profile fetch start');
    const t = window.setTimeout(() => {
      console.warn('[startup] profile load timeout — unlock UI');
      setLoading(false);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [userId, loading]);

  return { profile, loading, error };
}

/** Hauptzeile Profil: Vor-/Nachname, sonst full_name, sonst display_name, sonst E-Mail. */
export function profileHeadingLine(profile: ProfileRow | null, email: string): string {
  if (!profile) return email || '–';
  const first = (profile.first_name ?? '').trim();
  const last = (profile.last_name ?? '').trim();
  const combined = [first, last].filter(Boolean).join(' ').trim();
  if (combined) return combined;
  const full = (profile.full_name ?? '').trim();
  if (full) return full;
  const dn = (profile.display_name ?? '').trim();
  if (dn) return dn;
  return email || '–';
}

/** Home-Begrüßung: nur first_name → erstes Wort full_name → display_name (keine E-Mail). */
export function welcomeGreetingFromProfile(profile: ProfileRow | null): string {
  if (!profile) return '';
  const fn = (profile.first_name ?? '').trim();
  if (fn) return fn;
  const full = (profile.full_name ?? '').trim();
  if (full) {
    const w = full.split(/\s+/)[0]?.trim();
    if (w) return w;
  }
  const dn = (profile.display_name ?? '').trim();
  return dn || '';
}

/** @deprecated Nutze profileHeadingLine */
export function displayName(profile: ProfileRow | null, email: string | undefined): string {
  const e = (email ?? '').trim();
  return profileHeadingLine(profile, e || '–');
}
