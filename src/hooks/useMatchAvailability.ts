import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** Nur 'yes' und 'no'. Neutral = null. */
export type AvailabilityStatus = "yes" | "no";

/**
 * Fetches availability rows for a match. Toggle-Logik: Klick auf gleichen Status löscht (neutral).
 * getAvailability(playerId) → 'yes' | 'no' | null.
 */
export function useMatchAvailability(matchId: string | null) {
  const [rows, setRows] = useState<Array<{ player_id: string; status: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!matchId) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("availability")
      .select("player_id, status")
      .eq("match_id", matchId);

    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      const list = (data ?? []) as Array<{ player_id: string; status: string }>;
      setRows(list);
    }
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const availabilityByPlayerId = useMemo(() => {
    const out: Record<string, "yes" | "no" | null> = {};
    for (const r of rows) {
      out[r.player_id] = r.status === "yes" ? "yes" : r.status === "no" ? "no" : null;
    }
    return out;
  }, [rows]);

  const getAvailability = useCallback(
    (playerId: string): "yes" | "no" | null => {
      return availabilityByPlayerId[playerId] ?? null;
    },
    [availabilityByPlayerId]
  );

  const setAvailability = useCallback(
    async (playerId: string, status: AvailabilityStatus) => {
      if (!matchId) return;
      const current = getAvailability(playerId);
      setSaving(true);
      setError(null);
      try {
        if (current === status) {
          const { error: delErr } = await supabase
            .from("availability")
            .delete()
            .eq("match_id", matchId)
            .eq("player_id", playerId);
          if (delErr) throw delErr;
        } else {
          const { error: upsertErr } = await supabase
            .from("availability")
            .upsert(
              { match_id: matchId, player_id: playerId, status },
              { onConflict: "match_id,player_id" }
            );
          if (upsertErr) throw upsertErr;
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      } finally {
        setSaving(false);
      }
    },
    [matchId, load, getAvailability]
  );

  return {
    availabilityByPlayerId,
    getAvailability,
    setAvailability,
    refresh: load,
    loading,
    error,
    saving,
  };
}
