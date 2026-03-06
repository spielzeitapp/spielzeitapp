import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type AvailabilityStatus = "yes" | "no" | "maybe";

export function useAvailabilityActions(matchId: string) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data?.user) throw new Error("Nicht eingeloggt");
    return data.user;
  }

  async function setStatus(playerId: string, status: AvailabilityStatus) {
    setSaving(true);
    setError(null);
    try {
      const user = await requireUser();

      const payload = {
        match_id: matchId,
        player_id: playerId,
        status,
      };

      const { error: upsertErr } = await supabase
        .from("availability")
        .upsert(payload, { onConflict: "match_id,player_id" });

      if (upsertErr) throw upsertErr;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function setComment(playerId: string, comment: string | null) {
    setSaving(true);
    setError(null);
    try {
      const user = await requireUser();

      const payload = {
        match_id: matchId,
        player_id: playerId,
        note: comment,
      };

      const { error: upsertErr } = await supabase
        .from("availability")
        .upsert(payload, { onConflict: "match_id,player_id" });

      if (upsertErr) throw upsertErr;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function clear(playerId: string) {
    setSaving(true);
    setError(null);
    try {
      await requireUser(); // nur um sicherzustellen: authenticated

      const { error: delErr } = await supabase
        .from("availability")
        .delete()
        .eq("match_id", matchId)
        .eq("player_id", playerId);

      if (delErr) throw delErr;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  return { setStatus, setComment, clear, saving, error };
}
