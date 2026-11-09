import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { USC_CLUB_ID, USC_PARTNER_TEAMS, sortClubSeasons, type ClubSeason } from "./uscClub";
export function useUscClub(userId: string | null) {
  const [result, setResult] = useState<{
    userId: string | null;
    seasons: ClubSeason[];
    error: string | null;
  }>({ userId: null, seasons: [], error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void (async () => {
      const select = "id,team_id,age_group,display_name,status,team:teams!inner(name,club_id),season:seasons(name)";
      const requests = [
        supabase.from("team_seasons").select(select).eq("team.club_id", USC_CLUB_ID).eq("status", "active"),
        ...USC_PARTNER_TEAMS.map((partner) => supabase.from("team_seasons").select(select).eq("team.club_id", partner.clubId).eq("team.name", partner.teamName).eq("status", "active")),
      ];
      const results = await Promise.all(requests);
      const error = results.some((result) => result.error);
      const data = results.flatMap((result) => result.data ?? []);
      if (active)
        setResult({
          userId,
          seasons: error ? [] : sortClubSeasons([...new Map(data.map((row) => [row.id, row])).values()] as unknown as ClubSeason[]),
          error: error ? "Vereinsdaten konnten nicht geladen werden." : null,
        });
    })().catch(() => {
      if (active)
        setResult({
          userId,
          seasons: [],
          error: "Vereinsdaten konnten nicht geladen werden.",
        });
    });
    return () => {
      active = false;
    };
  }, [userId, retry]);
  return {
    seasons: result.userId === userId ? result.seasons : [],
    error: result.userId === userId ? result.error : null,
    loading: Boolean(userId && result.userId !== userId),
    retry: () => {
      setResult({ userId: null, seasons: [], error: null });
      setRetry((n) => n + 1);
    },
  };
}
