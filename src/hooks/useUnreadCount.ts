import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { syncAppBadge } from '../lib/notifications/appBadge';
import {
  INBOX_SYNC_EVENT,
  NOTIFICATIONS_READ_CHANGED_EVENT,
  requestInboxSync,
} from '../lib/notificationsReadState';
import { useNotificationsInboxRealtime } from './useNotificationsInboxRealtime';

/**
 * Nur `public.notifications` mit read = false (keine messages-Tabelle).
 * Homescreen-Badge nicht bei Fokus/Visibility/Route wegsyncen — nur bei echtem Count oder Read-Events.
 */
export function useUnreadCount(userId: string | undefined | null, scope: 'inbox' | 'feed' = 'inbox'): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      void syncAppBadge(0);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('event_type')
        .eq('user_id', userId)
        .eq('read', false);
      if (error) {
        console.warn('[useUnreadCount]', error.message ?? error);
        return;
      }
      const rows = data ?? [];
      const feedCount = rows.filter(row => row.event_type === 'feed_post').length;
      setCount(scope === 'feed' ? feedCount : rows.length - feedCount);
      void syncAppBadge(rows.length);
    } catch (e) {
      console.warn('[useUnreadCount]', e);
    }
  }, [userId, scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** PWA wieder sichtbar: Inbox + Homescreen-Badge aus Supabase neu synchronisieren. */
  useEffect(() => {
    if (!userId) return;
    const resync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        requestInboxSync();
      }
    };
    const onPageShow = () => {
      requestInboxSync();
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [userId]);

  useEffect(() => {
    const onReadChanged = () => {
      void refresh();
    };
    const onInboxSync = () => {
      void refresh();
    };
    window.addEventListener(NOTIFICATIONS_READ_CHANGED_EVENT, onReadChanged);
    window.addEventListener(INBOX_SYNC_EVENT, onInboxSync);
    return () => {
      window.removeEventListener(NOTIFICATIONS_READ_CHANGED_EVENT, onReadChanged);
      window.removeEventListener(INBOX_SYNC_EVENT, onInboxSync);
    };
  }, [refresh]);

  useNotificationsInboxRealtime(userId ?? null, refresh, `badge-${scope}`);

  return count;
}
