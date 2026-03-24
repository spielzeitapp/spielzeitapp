import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { syncAppIconBadgeFromUnreadCount } from '../lib/appBadge';
import { MESSAGES_READ_CHANGED_EVENT, MESSAGES_READ_STORAGE_KEY } from '../lib/messagesReadState';

/**
 * Ungelesene Nachrichten (messages.read = false) für den angegebenen User.
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
        .from('messages')
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
    const onRead = () => {
      void refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === MESSAGES_READ_STORAGE_KEY) void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(MESSAGES_READ_CHANGED_EVENT, onRead);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(MESSAGES_READ_CHANGED_EVENT, onRead);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  useEffect(() => {
    syncAppIconBadgeFromUnreadCount(count);
  }, [count]);

  return count;
}
