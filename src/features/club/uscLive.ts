import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { subscribeLiveMatchStateChanged } from "../../lib/liveMatchBroadcast";
import type { LiveMatchRow } from "../../lib/liveMatchService";
import type { ClubSeason } from "./uscClub";

export const USC_KM_LIGAPORTAL = "https://ticker.ligaportal.at/spielplan/94/gebietsliga-west";
export const USC_LIVE_COLUMNS = "id,team_season_id,opponent,match_date,location,status,score_home,score_away,live_started_at,live_elapsed_seconds,live_is_running,live_period";
export function viennaDay(iso: string | number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
/** Same matches/status/clock as SpielzeitApp, scoped to permitted club teams. No writes. */
export function useUscLiveMatches(userId: string | null, seasons: ClubSeason[]) {
  const scope = seasons.map((s) => s.id).sort().join(",");
  const key = `${userId ?? ""}:${scope}`;
  const ids = useMemo(() => scope ? scope.split(",") : [], [scope]);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; rows: LiveMatchRow[]; loading: boolean; error: boolean }>({ key: "", rows: [], loading: true, error: false });
  useEffect(() => {
    if (!userId || !ids.length) return;
    let active = true, serial = 0;
    const refresh = async () => {
      const request = ++serial;
      try {
        const { data, error } = await supabase.from("matches").select(USC_LIVE_COLUMNS).in("team_season_id", ids).eq("status", "live").order("match_date", { ascending: true });
        if (!active || request !== serial) return;
        setState({ key, rows: error ? [] : ((data ?? []) as LiveMatchRow[]).filter((m) => ids.includes(m.team_season_id) && m.status === "live"), loading: false, error: Boolean(error) });
      } catch { if (active && request === serial) setState({ key, rows: [], loading: false, error: true }); }
    };
    void refresh();
    const visibleRefresh = () => { if (document.visibilityState !== "hidden") void refresh(); };
    const timer = window.setInterval(visibleRefresh, 25000);
    document.addEventListener("visibilitychange", visibleRefresh);
    const unsubscribe = subscribeLiveMatchStateChanged((detail) => { if (!detail.teamSeasonId || ids.includes(detail.teamSeasonId)) void refresh(); });
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", visibleRefresh); unsubscribe(); };
  }, [userId, ids, key, retry]);
  const refetch = useCallback(() => setRetry((n) => n + 1), []);
  return { ...(state.key === key && userId && ids.length ? state : { rows: [], loading: Boolean(userId && ids.length), error: false }), refetch };
}
