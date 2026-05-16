import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export type AppLiveMatchState = {
  hasLive: boolean;
  liveMatchId: string | null;
};

/**
 * True genau dann, wenn mindestens ein Spiel mit DB-Status `live` existiert (wie LivePage / fetchFirstLiveMatch).
 * Beendet / nicht live → false → keine Nav-Pulse, kein „LIVE JETZT“, normale statische Live-Zelle.
 * Standard: nur unter `/app/*` (BottomNav). Mit `fetchOutsideApp: true` auch z. B. auf Intro/Welcome.
 */
export function useAppLiveMatchState(options?: { fetchOutsideApp?: boolean }): AppLiveMatchState {
  const { pathname } = useLocation();
  const isApp = pathname.startsWith('/app');
  const fetchEnabled = isApp || Boolean(options?.fetchOutsideApp);
  const [state, setState] = useState<AppLiveMatchState>({ hasLive: false, liveMatchId: null });

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

  return state;
}

export function useAppHasLiveMatch(options?: { fetchOutsideApp?: boolean }): boolean {
  return useAppLiveMatchState(options).hasLive;
}
