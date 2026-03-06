import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { FieldSlotId } from "../types/match";

type LineupRow = {
  match_id: string;
  slot: FieldSlotId;
  player_id: string | null;
};

type BenchRow = {
  match_id: string;
  player_id: string;
};

type SlotsState = Partial<Record<FieldSlotId, string | null>>;

export function useMatchLineup(matchId: string | null) {
  const [slots, setSlots] = useState<SlotsState>({});
  const [benchIds, setBenchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!matchId) {
      setSlots({});
      setBenchIds([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [lineupRes, benchRes] = await Promise.all([
        supabase
          .from("match_lineup")
          .select("slot, player_id")
          .eq("match_id", matchId),
        supabase
          .from("match_bench")
          .select("player_id")
          .eq("match_id", matchId),
      ]);

      if (lineupRes.error) throw lineupRes.error;
      if (benchRes.error) throw benchRes.error;

      const lineupRows = (lineupRes.data ?? []) as Array<{
        slot: FieldSlotId;
        player_id: string | null;
      }>;
      const benchRows = (benchRes.data ?? []) as BenchRow[];

      const nextSlots: SlotsState = {};
      for (const r of lineupRows) {
        nextSlots[r.slot] = r.player_id;
      }
      setSlots(nextSlots);
      setBenchIds(benchRows.map((r) => r.player_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen – bitte erneut versuchen.");
      setSlots({});
      setBenchIds([]);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const benchIdSet = useMemo(() => new Set(benchIds), [benchIds]);

  const setSlot = useCallback(
    async (slot: FieldSlotId, playerId: string | null) => {
      if (!matchId) return;
      setSaving(true);
      setError(null);

      // Optimistic: Spieler nur in einem Slot zulassen
      setSlots((prev) => {
        const next: SlotsState = { ...prev };
        if (playerId != null) {
          (Object.keys(next) as FieldSlotId[]).forEach((key) => {
            if (next[key] === playerId && key !== slot) {
              next[key] = null;
            }
          });
          next[slot] = playerId;
        } else {
          next[slot] = null;
        }
        return next;
      });

      try {
        if (playerId != null) {
          // Entferne Spieler aus allen anderen Slots in der DB
          const { error: delErr } = await supabase
            .from("match_lineup")
            .delete()
            .eq("match_id", matchId)
            .eq("player_id", playerId);
          if (delErr) throw delErr;

          // Slot neu setzen
          const { error: upsertErr } = await supabase
            .from("match_lineup")
            .upsert(
              { match_id: matchId, slot, player_id: playerId },
              { onConflict: "match_id,slot" }
            );
          if (upsertErr) throw upsertErr;
        } else {
          // Slot leeren: player_id = null setzen
          const { error: upsertErr } = await supabase
            .from("match_lineup")
            .upsert(
              { match_id: matchId, slot, player_id: null },
              { onConflict: "match_id,slot" }
            );
          if (upsertErr) throw upsertErr;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen – bitte erneut versuchen.");
        await load();
      } finally {
        setSaving(false);
      }
    },
    [matchId, load]
  );

  const toggleBench = useCallback(
    async (playerId: string) => {
      if (!matchId) return;
      const isOnBench = benchIdSet.has(playerId);
      setSaving(true);
      setError(null);

      // Optimistic update
      setBenchIds((prev) =>
        isOnBench ? prev.filter((id) => id !== playerId) : [...prev, playerId]
      );

      try {
        if (isOnBench) {
          const { error: delErr } = await supabase
            .from("match_bench")
            .delete()
            .eq("match_id", matchId)
            .eq("player_id", playerId);
          if (delErr) throw delErr;
        } else {
          const { error: insErr } = await supabase
            .from("match_bench")
            .upsert({ match_id: matchId, player_id: playerId }, { onConflict: "match_id,player_id" });
          if (insErr) throw insErr;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen – bitte erneut versuchen.");
        await load();
      } finally {
        setSaving(false);
      }
    },
    [matchId, benchIdSet, load]
  );

  const clearPlayerEverywhere = useCallback(
    async (playerId: string) => {
      if (!matchId) return;
      setSaving(true);
      setError(null);

      // Optimistisch: aus Slots und Bench entfernen
      setSlots((prev) => {
        const next: SlotsState = { ...prev };
        (Object.keys(next) as FieldSlotId[]).forEach((key) => {
          if (next[key] === playerId) next[key] = null;
        });
        return next;
      });
      setBenchIds((prev) => prev.filter((id) => id !== playerId));

      try {
        const [{ error: delSlotsErr }, { error: delBenchErr }] = await Promise.all([
          supabase
            .from("match_lineup")
            .delete()
            .eq("match_id", matchId)
            .eq("player_id", playerId),
          supabase
            .from("match_bench")
            .delete()
            .eq("match_id", matchId)
            .eq("player_id", playerId),
        ]);
        if (delSlotsErr) throw delSlotsErr;
        if (delBenchErr) throw delBenchErr;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen – bitte erneut versuchen.");
        await load();
      } finally {
        setSaving(false);
      }
    },
    [matchId, load]
  );

  return {
    slots,
    benchIds,
    setSlot,
    toggleBench,
    clearPlayerEverywhere,
    loading,
    error,
    saving,
  };
}

