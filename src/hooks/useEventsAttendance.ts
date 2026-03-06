import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type AttendanceStatus = "yes" | "no";

export type EventAttendanceData = {
  yes: number;
  no: number;
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
    const { data, error: err } = await supabase
      .from("event_attendance")
      .select("event_id, player_id, status")
      .in("event_id", eventIds);

    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      const list = (data ?? []) as Array<{ event_id: string; player_id: string; status: string }>;
      setRows(list);
    }
    setLoading(false);
  }, [eventIds.join(",")]);

  useEffect(() => {
    load();
  }, [load]);

  const byEventId = useMemo(() => {
    const out: Record<string, EventAttendanceData> = {};
    for (const id of eventIds) {
      out[id] = { yes: 0, no: 0, availabilityByPlayerId: {} };
    }
    for (const r of rows) {
      if (!out[r.event_id]) continue;
      const status = r.status === "yes" ? "yes" : r.status === "no" ? "no" : null;
      if (status) {
        out[r.event_id].availabilityByPlayerId[r.player_id] = status;
        if (status === "yes") out[r.event_id].yes += 1;
        else out[r.event_id].no += 1;
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
