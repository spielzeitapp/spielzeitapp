import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type PlayerItem = {
  id: string;
  team_season_id: string;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number | null;
  position: string | null;
  avatar_url: string | null;
  /** YYYY-MM-DD aus public.player_profiles.birthdate (via player_id) */
  birthdate: string | null;
  is_active: boolean;
  /** first_name + ' ' + last_name, getrimmt – für Anzeige. */
  display_name: string;
};

/** Row from public.players (ohne Geburtsdatum). */
export type PlayerRow = {
  id: string;
  team_season_id: string;
  first_name?: string | null;
  last_name?: string | null;
  jersey_number?: number | null;
  position?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
};

function normalizeProfileBirthdate(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}

async function fetchBirthdatesByPlayerIds(playerIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(playerIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from("player_profiles")
    .select("player_id, birthdate")
    .in("player_id", unique);

  if (error) {
    console.warn("[usePlayers] player_profiles:", error.message);
    return new Map();
  }

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const r = row as { player_id?: string; birthdate?: unknown };
    const pid = r.player_id != null ? String(r.player_id).trim() : "";
    const bd = normalizeProfileBirthdate(r.birthdate);
    if (pid && bd) map.set(pid, bd);
  }
  return map;
}

function toPlayer(row: PlayerRow, birthdateFromProfile: string | null): PlayerItem {
  const first = row.first_name != null ? String(row.first_name).trim() : "";
  const last = row.last_name != null ? String(row.last_name).trim() : "";
  const display_name = [first, last].join(" ").replace(/\s+/g, " ").trim() || "Spieler";
  const birthRaw = birthdateFromProfile != null ? String(birthdateFromProfile).trim() : "";
  return {
    id: row.id,
    team_season_id: row.team_season_id,
    first_name: row.first_name != null ? String(row.first_name) : null,
    last_name: row.last_name != null ? String(row.last_name) : null,
    jersey_number: row.jersey_number != null ? Number(row.jersey_number) : null,
    position: row.position != null ? String(row.position).trim() || null : null,
    avatar_url: row.avatar_url != null ? String(row.avatar_url).trim() || null : null,
    birthdate: birthRaw.length > 0 ? birthRaw : null,
    is_active: row.is_active !== false,
    display_name,
  };
}

async function mapRowsToPlayers(rows: PlayerRow[]): Promise<PlayerItem[]> {
  const birthMap = await fetchBirthdatesByPlayerIds(rows.map((r) => r.id));
  return rows.map((r) => toPlayer(r, birthMap.get(r.id) ?? null));
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
      .select("id, team_season_id, first_name, last_name, jersey_number, position, avatar_url, is_active")
      .eq("team_season_id", teamSeasonId)
      .eq("is_active", true)
      .order("jersey_number", { ascending: true, nullsFirst: false })
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false });

    if (queryError) {
      if (queryError.message.includes("avatar_url")) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("players")
          .select("id, team_season_id, first_name, last_name, jersey_number, position, is_active")
          .eq("team_season_id", teamSeasonId)
          .eq("is_active", true)
          .order("jersey_number", { ascending: true, nullsFirst: false })
          .order("last_name", { ascending: true, nullsFirst: false })
          .order("first_name", { ascending: true, nullsFirst: false });
        if (fallbackError) {
          setError(fallbackError.message);
          setPlayers([]);
        } else {
          const rows = (fallbackData as PlayerRow[]) ?? [];
          setPlayers(await mapRowsToPlayers(rows));
          setError(null);
        }
      } else {
        setError(queryError.message);
        setPlayers([]);
      }
    } else {
      const rows = (data as PlayerRow[]) ?? [];
      setPlayers(await mapRowsToPlayers(rows));
    }
    setLoading(false);
  }, [teamSeasonId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { players, loading, error, refetch };
}
