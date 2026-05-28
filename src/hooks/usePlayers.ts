import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type PlayerItem = {
  id: string;
  team_season_id: string;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number | null;
  position: string | null;
  /** ISO date `YYYY-MM-DD` from Postgres `date`, or null. */
  birthdate: string | null;
  avatar_url: string | null;
  is_active: boolean;
  status: "active" | "paused" | "archived";
  /** Trainer markiert LAZ-Spieler – Eltern dürfen bei Trainings LAZ wählen. */
  is_laz_player: boolean;
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
  status?: string | null;
  is_laz_player?: boolean | null;
};

type PlayerAvatarRow = {
  player_id: string;
  avatar_url: string | null;
};

type PlayerProfileRow = {
  player_id: string;
  birthdate?: string | null;
};

function normalizeProfileBirthdate(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim().slice(0, 10) || null;
}

function normalizeIsLazPlayer(raw: unknown): boolean {
  return raw === true;
}

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
    birthdate: null,
    avatar_url: null,
    is_active: row.is_active !== false,
    status:
      row.status === "paused"
        ? "paused"
        : row.status === "archived"
          ? "archived"
          : "active",
    is_laz_player: normalizeIsLazPlayer(row.is_laz_player),
    display_name,
  };
}

type UsePlayersMode = "active" | "paused" | "all";

type UsePlayersOptions = {
  mode?: UsePlayersMode;
};

export function usePlayers(teamSeasonId: string | null, options?: UsePlayersOptions) {
  const mode: UsePlayersMode = options?.mode ?? "active";
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
    let query = supabase
      .from("players")
      .select("id, team_season_id, first_name, last_name, jersey_number, position, is_active, status, is_laz_player")
      .eq("team_season_id", teamSeasonId);

    if (mode === "active") {
      query = query.or("status.eq.active,and(status.is.null,is_active.eq.true)");
    } else if (mode === "paused") {
      query = query.eq("status", "paused");
    }

    const { data, error: queryError } = await query
      .order("jersey_number", { ascending: true, nullsFirst: false })
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false });

    if (queryError) {
      setError(queryError.message);
      setPlayers([]);
      setLoading(false);
      return;
    }

    const rows = (data as PlayerRow[]) ?? [];
    const basePlayers = rows.map(toPlayer);
    const playerIds = basePlayers.map((p) => p.id);

    let avatarMap: Record<string, string | null> = {};
    let profileBirthMap: Record<string, string | null> = {};
    if (playerIds.length > 0) {
      const { data: avatarRows, error: avatarError } = await supabase
        .from("player_avatars")
        .select("player_id, avatar_url")
        .in("player_id", playerIds);
      if (avatarError) {
        setError(avatarError.message);
        setPlayers(basePlayers);
        setLoading(false);
        return;
      }
      avatarMap = ((avatarRows as PlayerAvatarRow[]) ?? []).reduce<Record<string, string | null>>(
        (acc, row) => {
          acc[row.player_id] = row.avatar_url != null ? String(row.avatar_url).trim() || null : null;
          return acc;
        },
        {}
      );

      const { data: profileRows, error: profileError } = await supabase
        .from("player_profiles")
        .select("player_id, birthdate")
        .in("player_id", playerIds);
      if (profileError) {
        setError(profileError.message);
        setPlayers(basePlayers);
        setLoading(false);
        return;
      }
      profileBirthMap = ((profileRows as PlayerProfileRow[]) ?? []).reduce<Record<string, string | null>>(
        (acc, row) => {
          acc[row.player_id] = normalizeProfileBirthdate(row.birthdate ?? null);
          return acc;
        },
        {}
      );
    }

    setPlayers(
      basePlayers.map((player) => ({
        ...player,
        birthdate: profileBirthMap[player.id] ?? null,
        avatar_url: avatarMap[player.id] ?? null,
      }))
    );
    setError(null);
    setLoading(false);
  }, [mode, teamSeasonId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { players, loading, error, refetch };
}
