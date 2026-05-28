import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type AttendanceStatus = "yes" | "no" | "injured" | "external_training";

export type EventAttendanceData = {
  yes: number;
  no: number;
  injured: number;
  external: number;
  unavailable: number;
  /** Map player_id -> status. Offen = nicht in Map. */
  availabilityByPlayerId: Record<string, AttendanceStatus>;
};

/**
 * Lädt Zu-/Absagen für mehrere Events aus public.event_attendance (event_id = events.id).
 * Eine Quelle für Trainer-Counts und Detail-Listen.
 */
export function useEventsAttendance(eventIds: string[]) {
  const [rows, setRows] = useState<Array<{ event_id: string; player_id: string; status: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (eventIds.length === 0) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    console.log("[useEventsAttendance] Lese event_attendance – dieselben event_ids wie angezeigte Spiele:", eventIds);
    const { data, error: err } = await supabase
      .from("event_attendance")
      .select("event_id, player_id, status")
      .in("event_id", eventIds);

    const list = (data ?? []) as Array<{ event_id: string; player_id: string; status: string }>;
    console.log("[useEventsAttendance] Response nach Refresh:", {
      anzahl_event_ids_abgefragt: eventIds.length,
      anzahl_zeilen: list.length,
      zeilen: list.map((r) => ({ event_id: r.event_id, player_id: r.player_id, status: r.status })),
      fehler: err,
    });

    if (err) {
      console.error("[useEventsAttendance] Fehler beim Lesen:", err);
      setError(err.message);
      setRows([]);
    } else {
      setRows(list);
    }
    setLoading(false);
  }, [eventIds.join(",")]);

  useEffect(() => {
    load();
  }, [load]);

  const byEventId = useMemo(() => {
    const out: Record<string, EventAttendanceData> = {};
    const eventIdToKey: Record<string, string> = {};
    for (const id of eventIds) {
      const key = String(id);
      out[key] = { yes: 0, no: 0, injured: 0, external: 0, unavailable: 0, availabilityByPlayerId: {} };
      eventIdToKey[key.toLowerCase()] = key;
    }
    for (const r of rows) {
      const eidRaw = r.event_id == null ? "" : String(r.event_id);
      const eidKey = eventIdToKey[eidRaw.toLowerCase()];
      if (!eidKey) continue;
      const pid = (r.player_id == null ? "" : String(r.player_id)).toLowerCase();
      const st = String(r.status ?? "").toLowerCase();
      const status =
        st === "yes"
          ? "yes"
          : st === "no" || st === "absent" || st === "declined"
            ? "no"
            : st === "injured"
              ? "injured"
              : st === "external_training"
                ? "external_training"
                : null;
      if (status) {
        out[eidKey].availabilityByPlayerId[pid] = status;
        if (status === "yes") out[eidKey].yes += 1;
        else if (status === "no") out[eidKey].no += 1;
        else if (status === "injured") out[eidKey].injured += 1;
        else out[eidKey].external += 1;
        if (status === "no" || status === "injured" || status === "external_training") {
          out[eidKey].unavailable += 1;
        }
      }
    }
    return out;
  }, [rows, eventIds.join(",")]);

  return {
    byEventId,
    refresh: load,
    loading,
    error,
  };
}
