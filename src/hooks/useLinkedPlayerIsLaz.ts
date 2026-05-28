import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Lädt is_laz_player für den verknüpften Spieler (Eltern/Spieler).
 * Unabhängig vom Kader-Filter in usePlayers – verhindert fehlenden LAZ-Button in der Elternansicht.
 */
export function useLinkedPlayerIsLaz(playerId: string | null) {
  const [isLazPlayer, setIsLazPlayer] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!playerId) {
        setIsLazPlayer(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("players")
        .select("is_laz_player")
        .eq("id", playerId)
        .maybeSingle();

      if (!alive) return;
      setIsLazPlayer(!error && data?.is_laz_player === true);
      setLoading(false);
    }

    void load();
    return () => {
      alive = false;
    };
  }, [playerId]);

  return { isLazPlayer, loading };
}
