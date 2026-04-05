import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** Supabase kann bei Joins Objekt oder 1-Element-Array liefern. */
function pickName(
  v: { name?: string } | { name?: string }[] | null | undefined,
): string {
  if (!v) return "";
  const one = Array.isArray(v) ? v[0] : v;
  return one?.name ?? "";
}

type TeamSeasonEmbed = {
  id?: string;
  team?: { name?: string } | { name?: string }[];
  season?: { name?: string } | { name?: string }[];
};

type TeamSeasonRow = {
  role?: string | null;
  team_season?: TeamSeasonEmbed | TeamSeasonEmbed[] | null;
} | null;

/** Join kann Objekt oder 1-Element-Array sein; liefert erstes embed mit gültiger id. */
function firstValidTeamSeason(
  row: TeamSeasonRow,
): { id: string; team?: TeamSeasonEmbed["team"]; season?: TeamSeasonEmbed["season"] } | null {
  const raw = row?.team_season;
  if (raw == null) return null;
  const candidates = Array.isArray(raw) ? raw : [raw];
  for (const ts of candidates) {
    if (!ts || typeof ts !== "object") continue;
    const id = ts.id != null ? String(ts.id).trim() : "";
    if (id !== "") return { id, team: ts.team, season: ts.season };
  }
  return null;
}

export function useActiveTeamSeason() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [teamSeasonId, setTeamSeasonId] = useState<string | null>(null);
  const [teamLabel, setTeamLabel] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function fetchActiveTeamSeason() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      // "Auth session missing!" = kein eingeloggter User – kein Fehler, nur Fallback auf public
      const isSessionMissing =
        authError &&
        (authError.message === "Auth session missing!" ||
          (authError as { name?: string }).name === "AuthSessionMissingError");

      if (authError && !isSessionMissing && alive) {
        setError(authError.message);
        setRole(null);
        setTeamSeasonId(null);
        setTeamLabel(null);
        setLoading(false);
        console.error("[useActiveTeamSeason] auth:", authError.message);
        return;
      }

      if (!user) {
        if (alive) {
          setRole(null);
          setTeamSeasonId(null);
          setTeamLabel(null);
          setLoading(false);
        }
        return;
      }

      const { data: rows, error: queryError } = await supabase
        .from("memberships")
        .select(
          `
          role,
          team_season:team_seasons (
            id,
            team:teams ( name ),
            season:seasons ( name )
          )
        `,
        )
        .eq("user_id", user.id)
        .order("id", { ascending: true });

      if (!alive) return;

      if (queryError) {
        setError(queryError.message);
        console.error("[useActiveTeamSeason] query:", queryError.message);
        setRole(null);
        setTeamSeasonId(null);
        setTeamLabel(null);
        setLoading(false);
        return;
      }

      const list = (rows ?? []) as TeamSeasonRow[];

      let chosen: { row: NonNullable<TeamSeasonRow>; ts: NonNullable<ReturnType<typeof firstValidTeamSeason>> } | null =
        null;
      for (const r of list) {
        if (!r) continue;
        const ts = firstValidTeamSeason(r);
        if (ts) {
          chosen = { row: r, ts };
          break;
        }
      }

      if (chosen) {
        const roleVal = chosen.row.role ?? null;
        const teamName = pickName(chosen.ts.team) || "Team";
        const seasonName = pickName(chosen.ts.season);
        const label =
          seasonName.trim() !== "" ? `${teamName} (${seasonName})` : teamName;
        const roleNorm = (roleVal ?? "").toString().trim().toLowerCase() || null;
        setRole(roleNorm);
        setTeamSeasonId(chosen.ts.id);
        setTeamLabel(label);
      } else {
        setRole(null);
        setTeamSeasonId(null);
        setTeamLabel(null);
      }
      setLoading(false);
    }

    fetchActiveTeamSeason();
    return () => {
      alive = false;
    };
  }, []);

  return { teamLabel, teamSeasonId, role, loading, error };
}
