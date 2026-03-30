import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { syncAppIconBadgeFromUnreadCount } from '../lib/appBadge';
import {
  fetchTeamIdsForUser,
  notificationsInboxOrFilter,
} from '../lib/notifications/inboxScope';
import { NOTIFICATIONS_READ_CHANGED_EVENT } from '../lib/notificationsReadState';
import { useNotificationsInboxRealtime } from './useNotificationsInboxRealtime';

/**
 * Ungelesene Benachrichtigungen (`notifications.read = false`).
 * Gleiche Sicht wie RLS: user-spezifische Zeilen + teamweite (`user_id` NULL) für die Mannschaften des Users.
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
      const teamIds = await fetchTeamIdsForUser(supabase, userId);
      const inboxOr = notificationsInboxOrFilter(userId, teamIds);
      const { count: n, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .or(inboxOr)
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

  useNotificationsInboxRealtime(userId ?? null, refresh, 'badge');

  useEffect(() => {
    syncAppIconBadgeFromUnreadCount(count);
  }, [count]);

  return count;
}
