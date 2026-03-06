import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type AvailabilityRow = {
  id: string;
  match_id: string;
  player_id: string;
  status: string;
  note: string | null;
  updated_at: string;
};

/** Nur 'yes' und 'no'. Neutral = kein Eintrag (null). */
export type AvailabilityStatus = "yes" | "no";

export function useAvailability(matchId: string | null) {
  const [rows, setRows] = useState<AvailabilityRow[]>([]);
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
      .select("id, match_id, player_id, status, note, updated_at")
      .eq("match_id", matchId);

    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows((data ?? []) as AvailabilityRow[]);
    }
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const mapByPlayerId: Record<string, AvailabilityRow> = useMemo(() => {
    const out: Record<string, AvailabilityRow> = {};
    for (const r of rows) {
      out[r.player_id] = r;
    }
    return out;
  }, [rows]);

  /** Aktueller Status pro (match_id, player_id): 'yes' | 'no' | null. 'maybe' wird als null gewertet. */
  const getAvailability = useCallback(
    (playerId: string): "yes" | "no" | null => {
      const row = mapByPlayerId[playerId];
      if (!row || row.status === "maybe") return null;
      if (row.status === "yes") return "yes";
      if (row.status === "no") return "no";
      return null;
    },
    [mapByPlayerId]
  );

  /**
   * Toggle-Logik: pro (match_id, player_id) 0 oder 1 Eintrag mit status 'yes' | 'no'.
   * Klick auf gleichen Status wie aktuell → Eintrag löschen (neutral).
   * Klick auf anderen Status → upsert.
   */
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

  const clearAvailability = useCallback(
    async (playerId: string) => {
      if (!matchId) return;
      setSaving(true);
      setError(null);
      try {
        const { error: delErr } = await supabase
          .from("availability")
          .delete()
          .eq("match_id", matchId)
          .eq("player_id", playerId);
        if (delErr) throw delErr;
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      } finally {
        setSaving(false);
      }
    },
    [matchId, load]
  );

  return {
    mapByPlayerId,
    getAvailability,
    setAvailability,
    clearAvailability,
    refresh: load,
    loading,
    error,
    saving,
  };
}
