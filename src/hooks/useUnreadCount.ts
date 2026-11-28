import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { syncAppBadge } from '../lib/notifications/appBadge';
import { installedPushSurface, ownsMarketBadge } from '../lib/notifications/marketPushScope';
import {
  INBOX_SYNC_EVENT,
  NOTIFICATIONS_READ_CHANGED_EVENT,
  requestInboxSync,
} from '../lib/notificationsReadState';
import { useNotificationsInboxRealtime } from './useNotificationsInboxRealtime';

/**
 * Count unread notifications for the requested product and club.
 * Only the installed product owning that count may write to its Home Screen badge.
 */
export function useUnreadCount(userId: string | undefined | null, scope: 'inbox' | 'feed' | 'exchange' = 'inbox', scopeClubId?: string): number {
  const ownsBadge = scope === 'exchange' ? ownsMarketBadge(scopeClubId)
    : installedPushSurface !== 'market' && installedPushSurface !== 'market-manager';
  const key=JSON.stringify([userId,scope,scopeClubId]);
  const [state,setState]=useState({key,count:0});
  const currentKey=useRef(key);currentKey.current=key;
  const mounted=useRef(true),request=useRef(0);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++;};},[]);

  const refresh = useCallback(async () => {
    const version=++request.current;
    if (!userId) {
      setState({key,count:0});
      if (ownsBadge) void syncAppBadge(0);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('event_type,link')
        .eq('user_id', userId)
        .eq('read', false);
      if (error) {
        console.warn('[useUnreadCount]', error.message ?? error);
        return;
      }
      if(!mounted.current||currentKey.current!==key||request.current!==version)return;
      const rows = data ?? [];
      const appRows = rows.filter(row => row.event_type !== 'exchange');
      const feedCount = appRows.filter(row => row.event_type === 'feed_post').length;
      const count=scope==='exchange'?rows.filter(row=>{if(row.event_type!=='exchange')return false;if(!scopeClubId)return true;try{return new URL(row.link||'', 'https://app.invalid').searchParams.get('club')===scopeClubId;}catch{return false;}}).length:scope==='feed'?feedCount:appRows.length-feedCount;
      setState({key,count});
      if (ownsBadge) void syncAppBadge(scope === 'exchange' ? count : appRows.length);
    } catch (e) {
      console.warn('[useUnreadCount]', e);
    }
  }, [userId,scope,scopeClubId,key,ownsBadge]);

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
    window.addEventListener('focus', onPageShow);
    // TEST projects may not publish notifications through Realtime.
    const interval=window.setInterval(()=>{if(!document.hidden)void refresh();},15000);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onPageShow);
      window.clearInterval(interval);
    };
  }, [userId,refresh]);

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

  return state.key===key?state.count:0;
}
