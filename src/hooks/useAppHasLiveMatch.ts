import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { subscribeLiveMatchStateChanged } from '../lib/liveMatchBroadcast';

export type AppLiveMatchState = {
  hasLive: boolean;
  liveMatchId: string | null;
};

/**
 * True genau dann, wenn mindestens ein Spiel mit DB-Status `live` existiert (wie LivePage / fetchFirstLiveMatch).
 * Beendet / nicht live → false → keine Nav-Pulse, kein „LIVE JETZT“, normale statische Live-Zelle.
 * Standard: nur unter `/app/*` (BottomNav). Mit `fetchOutsideApp: true` auch z. B. auf Intro/Welcome.
 * Nach Trainer-Anpfiff: Sofort-Refresh per liveMatchBroadcast + kurzer 8s-Burst.
 */
export function useAppLiveMatchState(options?: { fetchOutsideApp?: boolean }): AppLiveMatchState {
  const { pathname } = useLocation();
  const isApp = pathname.startsWith('/app');
  const fetchEnabled = isApp || Boolean(options?.fetchOutsideApp);
  const [state, setState] = useState<AppLiveMatchState>({ hasLive: false, liveMatchId: null });
  const burstUntilRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!fetchEnabled) {
      setState({ hasLive: false, liveMatchId: null });
      return;
    }
    const { data, error } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'live')
      .order('match_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      setState({ hasLive: false, liveMatchId: null });
      return;
    }
    const id = data?.id ? String(data.id).trim() : '';
    setState({ hasLive: Boolean(id), liveMatchId: id || null });
  }, [fetchEnabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!fetchEnabled) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 25000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchEnabled, refresh]);

  // Sofort nach Anpfiff/Ende + kurzer 8s-Poll-Burst (Realtime-Fallback für andere Surfaces).
  useEffect(() => {
    if (!fetchEnabled) return;
    let burstTimer: number | null = null;
    const unsub = subscribeLiveMatchStateChanged((detail) => {
      void refresh();
      if (detail.status === 'live' || detail.status === 'finished') {
        burstUntilRef.current = Date.now() + 24_000;
        if (burstTimer != null) window.clearInterval(burstTimer);
        burstTimer = window.setInterval(() => {
          if (Date.now() > burstUntilRef.current) {
            if (burstTimer != null) window.clearInterval(burstTimer);
            burstTimer = null;
            return;
          }
          void refresh();
        }, 8_000);
      }
    });
    return () => {
      unsub();
      if (burstTimer != null) window.clearInterval(burstTimer);
    };
  }, [fetchEnabled, refresh]);

  return state;
}

export function useAppHasLiveMatch(options?: { fetchOutsideApp?: boolean }): boolean {
  return useAppLiveMatchState(options).hasLive;
}
