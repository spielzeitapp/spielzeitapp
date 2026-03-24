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

const PROFILE_SELECT = 'id, first_name, last_name, full_name, display_name';

export const APP_NAME_PLACEHOLDER = /^spielzeitapp$/i;

function isPlaceholderToken(s: string): boolean {
  const t = s.trim();
  return t.length === 0 || APP_NAME_PLACEHOLDER.test(t);
}

/** Anzeige-Vorname: first_name → erstes Wort full_name → display_name. Keine E-Mail. */
export function getDisplayFirstName(profile: ProfileRow | null): string | null {
  if (!profile) return null;
  const fn = (profile.first_name ?? '').trim();
  if (fn && !isPlaceholderToken(fn)) return fn;
  const full = (profile.full_name ?? '').trim();
  if (full) {
    const w = full.split(/\s+/)[0]?.trim();
    if (w && !isPlaceholderToken(w)) return w;
  }
  const dn = (profile.display_name ?? '').trim();
  if (dn && !isPlaceholderToken(dn)) return dn;
  return null;
}

/** Profil Zeile 1 (ohne E-Mail): first+last, sonst full_name, sonst display_name. */
export function profileDisplayName(profile: ProfileRow | null): string | null {
  if (!profile) return null;
  const first = (profile.first_name ?? '').trim();
  const last = (profile.last_name ?? '').trim();
  const combined = [first, last].filter(Boolean).join(' ').trim();
  if (combined && !isPlaceholderToken(combined)) return combined;
  const full = (profile.full_name ?? '').trim();
  if (full && !APP_NAME_PLACEHOLDER.test(full)) return full;
  const dn = (profile.display_name ?? '').trim();
  if (dn && !APP_NAME_PLACEHOLDER.test(dn)) return dn;
  return null;
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
        const fetchRow = async (): Promise<{ data: ProfileRow | null; error: { message?: string; code?: string } | null }> => {
          const res = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).maybeSingle();
          return { data: (res.data as ProfileRow) ?? null, error: res.error };
        };

        let { data, error: err } = await fetchRow();
        if (cancelled) return;

        if (err) {
          setLoading(false);
          setError(friendlyProfileFetchError(err.message ?? 'Unbekannter Fehler'));
          setProfile(null);
          return;
        }

        if (!data) {
          const { data: authRes } = await supabase.auth.getUser();
          if (cancelled) return;
          if (authRes?.user?.id !== userId) {
            setLoading(false);
            setProfile(null);
            setError(null);
            return;
          }
          const ins = await supabase.from('profiles').insert({ id: userId });
          if (ins.error) {
            const code = (ins.error as { code?: string }).code;
            if (code !== '23505') {
              console.warn('[useProfile] ensure profile row', ins.error.message ?? ins.error);
            }
          }
          const second = await fetchRow();
          if (cancelled) return;
          data = second.data;
          err = second.error;
          if (err) {
            setLoading(false);
            setError(null);
            setProfile(null);
            return;
          }
        }

        setLoading(false);
        setError(null);
        setProfile(data);
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
  const name = profileDisplayName(profile);
  if (name) return name;
  return email || '–';
}

/** Home: Vorname-Anzeige (keine E-Mail). */
export function welcomeGreetingFromProfile(profile: ProfileRow | null): string {
  return getDisplayFirstName(profile) ?? '';
}

/** @deprecated Nutze profileHeadingLine */
export function displayName(profile: ProfileRow | null, email: string | undefined): string {
  const e = (email ?? '').trim();
  return profileHeadingLine(profile, e || '–');
}
