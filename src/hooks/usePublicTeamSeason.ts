import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Lädt die erste Team-Saison für den öffentlichen Spielplan (ohne Login).
 * Wird genutzt, wenn useActiveTeamSeason kein teamSeasonId liefert.
 */
export function usePublicTeamSeason() {
  const [teamSeasonId, setTeamSeasonId] = useState<string | null>(null);
  const [teamLabel, setTeamLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function fetch() {
      const { data, error } = await supabase
        .from("team_seasons")
        .select(
          `
          id,
          team:teams ( name ),
          season:seasons ( name )
        `
        )
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!alive) return;

      if (error || !data) {
        setTeamSeasonId(null);
        setTeamLabel(null);
        setLoading(false);
        return;
      }

      const row = data as {
        id: string;
        team?: { name?: string } | { name?: string }[];
        season?: { name?: string } | { name?: string }[];
      };
      const team = Array.isArray(row.team) ? row.team[0] : row.team;
      const season = Array.isArray(row.season) ? row.season[0] : row.season;
      const teamName = team?.name ?? "Team";
      const seasonName = season?.name ?? "";
      const label =
        seasonName.trim() !== ""
          ? `${teamName} (${seasonName})`
          : teamName;

      setTeamSeasonId(row.id);
      setTeamLabel(label);
      setLoading(false);
    }

    fetch();
    return () => {
      alive = false;
    };
  }, []);

  return { teamSeasonId, teamLabel, loading };
}
