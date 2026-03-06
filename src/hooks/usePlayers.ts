import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type PlayerItem = {
  id: string;
  team_season_id: string;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number | null;
  position: string | null;
  is_active: boolean;
  /** first_name + ' ' + last_name, getrimmt – für Anzeige. */
  display_name: string;
};

/** Row from public.players. */
export type PlayerRow = {
  id: string;
  team_season_id: string;
  first_name?: string | null;
  last_name?: string | null;
  jersey_number?: number | null;
  position?: string | null;
  is_active?: boolean;
};

function toPlayer(row: PlayerRow): PlayerItem {
  const first = row.first_name != null ? String(row.first_name).trim() : "";
  const last = row.last_name != null ? String(row.last_name).trim() : "";
  const display_name = [first, last].join(" ").replace(/\s+/g, " ").trim() || "Spieler";
  return {
    id: row.id,
    team_season_id: row.team_season_id,
    first_name: row.first_name != null ? String(row.first_name) : null,
    last_name: row.last_name != null ? String(row.last_name) : null,
    jersey_number: row.jersey_number != null ? Number(row.jersey_number) : null,
    position: row.position != null ? String(row.position).trim() || null : null,
    is_active: row.is_active !== false,
    display_name,
  };
}

export function usePlayers(teamSeasonId: string | null) {
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (teamSeasonId === null) {
      setPlayers([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("players")
      .select("id, team_season_id, first_name, last_name, jersey_number, position, is_active")
      .eq("team_season_id", teamSeasonId)
      .eq("is_active", true)
      .order("jersey_number", { ascending: true, nullsFirst: false })
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false });

    if (queryError) {
      setError(queryError.message);
      setPlayers([]);
    } else {
      const rows = (data as PlayerRow[]) ?? [];
      setPlayers(rows.map(toPlayer));
    }
    setLoading(false);
  }, [teamSeasonId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { players, loading, error, refetch };
}
