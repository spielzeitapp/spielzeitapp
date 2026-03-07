import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Lädt die erste Team-Saison für den öffentlichen Spielplan (ohne Login).
 * Wird genutzt, wenn useActiveTeamSeason kein teamSeasonId liefert.
 *
 * 1. Versuch: team_seasons mit Join (kann durch RLS für anon blockiert sein).
 * 2. Fallback: team_season_id aus events holen (events oft öffentlich lesbar),
 *    damit der Spielplan auch ohne team_seasons-Leserecht Spiele anzeigt.
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

      if (!error && data) {
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
        return;
      }

      // Fallback: team_season_id aus events (öffentlich oft lesbar, auch wenn team_seasons RLS blockiert)
      const fallback = await supabase
        .from("events")
        .select("team_season_id")
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;

      if (fallback.error || !fallback.data) {
        setTeamSeasonId(null);
        setTeamLabel(null);
        setLoading(false);
        return;
      }

      const id = (fallback.data as { team_season_id: string }).team_season_id;
      if (id) {
        setTeamSeasonId(id);
        setTeamLabel("Spielplan");
      } else {
        setTeamSeasonId(null);
        setTeamLabel(null);
      }
      setLoading(false);
    }

    fetch();
    return () => {
      alive = false;
    };
  }, []);

  return { teamSeasonId, teamLabel, loading };
}
