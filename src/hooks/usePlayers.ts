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

  const refetch = useCallback(async () => {
    const request = ++requestVersion.current;
    if (teamSeasonId === null) {
      setLoadedScope(scope);
      setPlayers([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await listRoster(teamSeasonId, mode);
    if (request !== requestVersion.current) return;
    setLoadedScope(scope);
    if (queryError) {
      setError(queryError);
      setPlayers([]);
      setLoading(false);
      return;
    }
    setPlayers(data);
    setError(null);
    setLoading(false);
  }, [mode, teamSeasonId, scope]);

  useEffect(() => {
    void refetch();
    return () => { requestVersion.current += 1; };
  }, [refetch]);

  return { players: loadedScope === scope ? players : [], loading: teamSeasonId != null && (loading || loadedScope !== scope), error: loadedScope === scope ? error : null, refetch };
}
