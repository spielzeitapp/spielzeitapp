import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/** Nur Anzeigedaten aus `profiles` (Vor-/Nachname). Globales Admin: `user_roles` / useSession, nicht profiles. */
export interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

/**
 * Load current user's profile (first_name, last_name). Returns null until loaded or if no user.
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
          .select('id, first_name, last_name')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        setLoading(false);
        if (err) {
          setError(err.message);
          setProfile(null);
          return;
        }
        setProfile((data as ProfileRow) ?? null);
      } catch (e: unknown) {
        if (cancelled) return;
        console.error('[useProfile] profile fetch failed', e);
        setLoading(false);
        setError(e instanceof Error ? e.message : String(e));
        setProfile(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { profile, loading, error };
}

/** Format display name from profile or fallback to email. */
export function displayName(profile: ProfileRow | null, email: string | undefined): string {
  if (!profile) return email ?? '–';
  const first = (profile.first_name ?? '').trim();
  const last = (profile.last_name ?? '').trim();
  const name = `${first} ${last}`.trim();
  return name || email || '–';
}
