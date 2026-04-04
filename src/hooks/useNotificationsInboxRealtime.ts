import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Realtime für dieselbe Inbox wie Badge + Liste: nur Zeilen mit user_id = aktueller User.
 */
export function useNotificationsInboxRealtime(
  userId: string | null | undefined,
  onSync: () => void,
  scope: string,
) {
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    channelsRef.current = [];

    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        onSync();
      }, 200);
    };

    const ch = supabase
      .channel(`notifications:${scope}:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        schedule,
      )
      .subscribe();
    channelsRef.current.push(ch);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      for (const c of channelsRef.current) {
        void supabase.removeChannel(c);
      }
      channelsRef.current = [];
    };
  }, [userId, onSync, scope]);
}
