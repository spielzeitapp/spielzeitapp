import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { syncAppIconBadgeFromUnreadCount } from '../lib/appBadge';
import { NOTIFICATIONS_READ_CHANGED_EVENT } from '../lib/notificationsReadState';

/**
 * Ungelesene Benachrichtigungen (notifications.read = false) für den User.
 */
export function useUnreadCount(userId: string | undefined | null): number {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    try {
      const { count: n, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);
      if (error) {
        console.warn('[useUnreadCount]', error.message ?? error);
        setCount(0);
        return;
      }
      setCount(n ?? 0);
    } catch (e) {
      console.warn('[useUnreadCount]', e);
      setCount(0);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onReadChanged = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(NOTIFICATIONS_READ_CHANGED_EVENT, onReadChanged);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(NOTIFICATIONS_READ_CHANGED_EVENT, onReadChanged);
    };
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:unread:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  useEffect(() => {
    syncAppIconBadgeFromUnreadCount(count);
  }, [count]);

  return count;
}
