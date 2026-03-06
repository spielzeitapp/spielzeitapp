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

type TeamSeasonRow = {
  role?: string | null;
  team_season?: {
    id: string;
    team?: { name?: string } | { name?: string }[];
    season?: { name?: string } | { name?: string }[];
  } | null;
} | null;

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

      if (authError && alive) {
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
      const row = list[0] ?? null;
      const roleVal = row?.role ?? null;
      const ts = row?.team_season;
      const id = ts?.id ?? null;
      const teamName = ts ? pickName(ts.team) || "Team" : "Team";
      const seasonName = ts ? pickName(ts.season) : "";
      const label =
        seasonName.trim() !== ""
          ? `${teamName} (${seasonName})`
          : teamName;

      const role = (roleVal ?? "").toString().trim().toLowerCase() || null;
      setRole(role);
      setTeamSeasonId(id);
      setTeamLabel(row ? label : null);
      setLoading(false);
    }

    fetchActiveTeamSeason();
    return () => {
      alive = false;
    };
  }, []);

  return { teamLabel, teamSeasonId, role, loading, error };
}
