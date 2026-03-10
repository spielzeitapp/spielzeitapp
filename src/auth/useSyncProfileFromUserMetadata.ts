import { useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

/**
 * After signUp with options.data { first_name, last_name }: sync user_metadata to profiles
 * so the app shows the correct name. Runs once per user when metadata is present.
 */
export function useSyncProfileFromUserMetadata(user: User | null): void {
  const synced = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    if (synced.current) return;

    const first = user.user_metadata?.first_name;
    const last = user.user_metadata?.last_name;
    if (first == null && last == null) return;

    synced.current = true;

    const first_name = typeof first === 'string' ? first.trim() || null : null;
    const last_name = typeof last === 'string' ? last.trim() || null : null;

    supabase
      .from('profiles')
      .upsert(
        { id: user.id, first_name, last_name, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .then(() => {});
  }, [user?.id, user?.user_metadata?.first_name, user?.user_metadata?.last_name]);
}
