import { useCallback, useEffect, useState, useRef } from "react";
import { listRoster, type RosterListMode, type RosterPlayer } from "../lib/rosterService";

/** Öffentliche Player-Form — kompatibel zu bestehenden Screens. */
export type PlayerItem = RosterPlayer;

/** @deprecated Row-Shape; Screens sollen PlayerItem / listRoster nutzen. */
export type PlayerRow = {
  id: string;
  team_season_id: string;
  first_name?: string | null;
  last_name?: string | null;
  jersey_number?: number | null;
  position?: string | null;
  is_active?: boolean;
  status?: string | null;
  is_laz_player?: boolean | null;
  is_injured?: boolean | null;
  injured_since?: string | null;
  injured_until?: string | null;
  cutout_url?: string | null;
};

type UsePlayersMode = RosterListMode;

type UsePlayersOptions = {
  mode?: UsePlayersMode;
  refreshOnFocus?: boolean;
};

/**
 * Kader-Hook. Liest über zentralen Roster-Service (Join-first / Legacy nur technischer Fallback).
 */
export function usePlayers(teamSeasonId: string | null, options?: UsePlayersOptions) {
  const mode: UsePlayersMode = options?.mode ?? "active";
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const requestVersion = useRef(0);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const scope = `${teamSeasonId ?? ""}:${mode}`;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (background = false) => {
    const request = ++requestVersion.current;
    if (teamSeasonId === null) {
      setLoadedScope(scope);
      setPlayers([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!background) { setLoading(true); setError(null); }
    const { data, error: queryError } = await listRoster(teamSeasonId, mode);
    if (request !== requestVersion.current) return;
    setLoadedScope(scope);
    if (queryError) {
      if (background) { setLoading(false); return; }
      setError(queryError);
      setPlayers([]);
      setLoading(false);
      return;
    }
    setPlayers(data);
    setError(null);
    setLoading(false);
  }, [mode, teamSeasonId, scope]);

  const refetch = useCallback(() => load(), [load]);

  useEffect(() => {
    void refetch();
    return () => { requestVersion.current += 1; };
  }, [refetch]);

  useEffect(() => {
    if (!options?.refreshOnFocus || !teamSeasonId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      timer = setTimeout(() => { void load(true); }, 100);
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load, teamSeasonId, options?.refreshOnFocus]);

  return { players: loadedScope === scope ? players : [], loading: teamSeasonId != null && (loading || loadedScope !== scope), error: loadedScope === scope ? error : null, refetch };
}
