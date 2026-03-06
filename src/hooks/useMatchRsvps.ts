import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type RsvpStatus = "yes" | "no" | "maybe";

type RsvpRow = {
  match_id: string;
  player_id: string;
  status: string;
  updated_at?: string;
};

export function useMatchRsvps(matchId: string | null) {
  const [rows, setRows] = useState<RsvpRow[]>([]);
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
      .from("match_rsvps")
      .select("match_id, player_id, status, updated_at")
      .eq("match_id", matchId);

    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows((data ?? []) as RsvpRow[]);
    }
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const rsvpByPlayerId: Record<string, RsvpStatus> = useMemo(() => {
    const out: Record<string, RsvpStatus> = {};
    for (const r of rows) {
      if (r.status === "yes" || r.status === "no" || r.status === "maybe") {
        out[r.player_id] = r.status;
      }
    }
    return out;
  }, [rows]);

  const setRsvp = useCallback(
    async (playerId: string, status: RsvpStatus) => {
      if (!matchId) return;
      setSaving(true);
      setError(null);
      const payload = { match_id: matchId, player_id: playerId, status, updated_at: new Date().toISOString() };
      setRows((prev) => {
        const rest = prev.filter((r) => !(r.match_id === matchId && r.player_id === playerId));
        return [...rest, { ...payload, updated_at: payload.updated_at }];
      });
      try {
        const { error: upsertErr } = await supabase
          .from("match_rsvps")
          .upsert(payload, { onConflict: "match_id,player_id" });
        if (upsertErr) throw upsertErr;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
        await load();
      } finally {
        setSaving(false);
      }
    },
    [matchId, load]
  );

  return {
    rsvpByPlayerId,
    setRsvp,
    refresh: load,
    loading,
    error,
    saving,
  };
}
