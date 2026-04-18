import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/**
 * True, wenn mindestens ein Spiel mit DB-Status `live` existiert (wie LivePage / fetchFirstLiveMatch).
 * Nur unter `/app/*` aktiv; sonst false ohne Request.
 */
export function useAppHasLiveMatch(): boolean {
  const { pathname } = useLocation();
  const isApp = pathname.startsWith('/app');
  const [hasLive, setHasLive] = useState(false);

  const refresh = useCallback(async () => {
    if (!isApp) {
      setHasLive(false);
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
      setHasLive(false);
      return;
    }
    setHasLive(Boolean(data?.id));
  }, [isApp]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isApp) return;
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
  }, [isApp, refresh]);

  return hasLive;
}
