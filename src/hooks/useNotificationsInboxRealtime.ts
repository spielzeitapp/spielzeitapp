import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchTeamIdsForUser } from '../lib/notifications/inboxScope';

/**
 * Realtime für dieselbe Inbox wie Badge + Liste: nur `team_id` (kein `user_id` in Prod-Schema).
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
    let cancelled = false;
    channelsRef.current = [];

    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        onSync();
      }, 200);
    };

    const run = async () => {
      const teamIds = await fetchTeamIdsForUser(supabase, userId);
      if (cancelled) return;

      for (const tid of teamIds) {
        if (cancelled) break;
        const chTeam = supabase
          .channel(`notifications:${scope}:${userId}:team:${tid}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications', filter: `team_id=eq.${tid}` },
            schedule,
          )
          .subscribe();
        channelsRef.current.push(chTeam);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      for (const ch of channelsRef.current) {
        void supabase.removeChannel(ch);
      }
      channelsRef.current = [];
    };
  }, [userId, onSync, scope]);
}
