import { useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { PENDING_PROFILE_KEY, type PendingProfile } from '../lib/pendingProfile';

/**
 * After magic-link login from registration: if localStorage has pending profile
 * for this user's email, upsert profile (first_name, last_name) and clear storage.
 */
export function useSyncPendingProfile(user: User | null): void {
  const synced = useRef(false);

  useEffect(() => {
    if (!user?.email) return;
    if (synced.current) return;

    const raw = localStorage.getItem(PENDING_PROFILE_KEY);
    if (!raw) return;

    let payload: PendingProfile;
    try {
      payload = JSON.parse(raw) as PendingProfile;
    } catch {
      localStorage.removeItem(PENDING_PROFILE_KEY);
      return;
    }

    const email = (user.email ?? '').trim().toLowerCase();
    const pendingEmail = (payload.email ?? '').trim().toLowerCase();
    if (pendingEmail !== email) return;

    synced.current = true;

    (async () => {
      const first_name = (payload.first_name ?? '').trim() || null;
      const last_name = (payload.last_name ?? '').trim() || null;
      await supabase
        .from('profiles')
        .upsert(
          { id: user.id, first_name, last_name, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      localStorage.removeItem(PENDING_PROFILE_KEY);
    })();
  }, [user?.id, user?.email]);
}
