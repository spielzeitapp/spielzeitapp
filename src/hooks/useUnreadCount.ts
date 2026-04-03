import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { syncAppIconBadgeFromUnreadCount } from '../lib/appBadge';
import { fetchTeamIdsForUser } from '../lib/notifications/inboxScope';
import { readNotificationReadSet } from '../lib/notificationsInAppRead';
import { NOTIFICATIONS_READ_CHANGED_EVENT } from '../lib/notificationsReadState';
import { useNotificationsInboxRealtime } from './useNotificationsInboxRealtime';

/**
 * Ungelesene Benachrichtigungen: gleiche team_id-Sicht wie Liste, „gelesen“ per localStorage
 * (kompatibel ohne DB-Spalten `user_id` / `read`).
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
      if (teamIds.length === 0) {
        setCount(0);
        return;
      }
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .in('team_id', teamIds);
      if (error) {
        console.warn('[useUnreadCount]', error.message ?? error);
        setCount(0);
        return;
      }
      const readSet = readNotificationReadSet(userId);
      const rows = data ?? [];
      const unread = rows.filter((r) => !readSet.has((r as { id: string }).id)).length;
      setCount(unread);
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
