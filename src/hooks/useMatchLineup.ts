import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { lineupRowsToSlotMap } from "../lib/liveMatchService";
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

function nid(id: string): string {
  return id.trim().toLowerCase();
}

export function useMatchLineup(matchId: string | null) {
  const [slots, setSlots] = useState<SlotsState>({});
  const [benchIds, setBenchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!matchId) {
      setSlots({});
      setBenchIds([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!silent) setLoading(true);
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

      setSlots(lineupRowsToSlotMap(lineupRows));
      setBenchIds(
        benchRows
          .map((r) => String(r.player_id ?? "").trim().toLowerCase())
          .filter((x) => x.length > 0),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen – bitte erneut versuchen.");
      setSlots({});
      setBenchIds([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const benchIdSet = useMemo(() => new Set(benchIds), [benchIds]);

  const setSlot = useCallback(
    async (slot: FieldSlotId, playerId: string | null) => {
      if (!matchId) return;
      const pid = playerId != null ? nid(playerId) : null;
      setSaving(true);
      setError(null);

      // Optimistic: Spieler nur in einem Slot zulassen
      setSlots((prev) => {
        const next: SlotsState = { ...prev };
        if (pid != null) {
          (Object.keys(next) as FieldSlotId[]).forEach((key) => {
            const v = next[key];
            if (v != null && nid(String(v)) === pid && key !== slot) {
              next[key] = null;
            }
          });
          next[slot] = pid;
        } else {
          next[slot] = null;
        }
        return next;
      });

      try {
        if (pid != null) {
          // Entferne Spieler aus allen anderen Slots in der DB
          const { error: delErr } = await supabase
            .from("match_lineup")
            .delete()
            .eq("match_id", matchId)
            .eq("player_id", pid);
          if (delErr) throw delErr;

          // Slot neu setzen
          const { error: upsertErr } = await supabase
            .from("match_lineup")
            .upsert(
              { match_id: matchId, slot, player_id: pid },
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
      const id = nid(playerId);
      const isOnBench = benchIdSet.has(id);
      setSaving(true);
      setError(null);

      // Optimistic update
      setBenchIds((prev) =>
        isOnBench ? prev.filter((x) => x !== id) : [...prev, id]
      );

      try {
        if (isOnBench) {
          const { error: delErr } = await supabase
            .from("match_bench")
            .delete()
            .eq("match_id", matchId)
            .eq("player_id", id);
          if (delErr) throw delErr;
        } else {
          const { error: insErr } = await supabase
            .from("match_bench")
            .upsert({ match_id: matchId, player_id: id }, { onConflict: "match_id,player_id" });
          if (insErr) throw insErr;
        }
        await load({ silent: true });
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
      const id = nid(playerId);
      setSaving(true);
      setError(null);

      // Optimistisch: aus Slots und Bench entfernen
      setSlots((prev) => {
        const next: SlotsState = { ...prev };
        (Object.keys(next) as FieldSlotId[]).forEach((key) => {
          const v = next[key];
          if (v != null && nid(String(v)) === id) next[key] = null;
        });
        return next;
      });
      setBenchIds((prev) => prev.filter((x) => x !== id));

      try {
        const [{ error: delSlotsErr }, { error: delBenchErr }] = await Promise.all([
          supabase
            .from("match_lineup")
            .delete()
            .eq("match_id", matchId)
            .eq("player_id", id),
          supabase
            .from("match_bench")
            .delete()
            .eq("match_id", matchId)
            .eq("player_id", id),
        ]);
        if (delSlotsErr) throw delSlotsErr;
        if (delBenchErr) throw delBenchErr;
        await load({ silent: true });
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
    reloadLineup: load,
    loading,
    error,
    saving,
  };
}

