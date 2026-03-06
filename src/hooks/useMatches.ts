import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** DB status auf upcoming | live | finished mappen (Tabs). */
function normalizeMatchStatus(s: string | null): "upcoming" | "live" | "finished" {
  const v = (s ?? "").trim().toLowerCase();
  if (v === "live") return "live";
  if (v === "finished") return "finished";
  return "upcoming";
}

/** Raw row from public.matches (DB columns). */
type MatchDbRow = {
  id: string;
  team_season_id: string;
  match_date: string | null;
  opponent: string | null;
  status: string | null;
  location?: string | null;
  created_at?: string | null;
  motm_open_until?: string | null;
  motm_enabled?: boolean | null;
};

export type MatchRow = {
  id: string;
  team_season_id: string;
  starts_at: string | null;
  match_date: string | null;
  opponent: string | null;
  status: string | null;
  created_at?: string | null;
  motm_open_until?: string | null;
  motm_enabled?: boolean | null;
  /** Optional, e.g. for TablePage; public.matches may not have this column. */
  location?: string | null;
};

export function useMatches(teamSeasonId: string | null) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamSeasonId) {
      setMatches([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("matches")
      .select("id, team_season_id, opponent, match_date, status, location, created_at, motm_open_until, motm_enabled")
      .eq("team_season_id", teamSeasonId)
      .order("match_date", { ascending: true });

    if (err) {
      setError(err.message);
      setMatches([]);
    } else {
      const mapped: MatchRow[] = (data ?? []).map((r: MatchDbRow) => ({
        id: r.id,
        team_season_id: r.team_season_id,
        starts_at: r.match_date,
        match_date: r.match_date,
        opponent: r.opponent,
        status: normalizeMatchStatus(r.status),
        created_at: r.created_at ?? undefined,
        motm_open_until: r.motm_open_until ?? undefined,
        motm_enabled: r.motm_enabled ?? undefined,
        location: r.location ?? null,
      }));
      setMatches(mapped);
    }
    setLoading(false);
  }, [teamSeasonId]);

  useEffect(() => {
    load().catch((e) => {
      setError(e?.message ?? "Unbekannter Fehler");
      setMatches([]);
      setLoading(false);
    });
  }, [load]);

  return { matches, loading, error, refetch: load };
}
