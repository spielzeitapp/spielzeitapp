import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** kind in DB: nur 'match' | 'training' | 'event' (events_kind_check). */
export type EventKind = "match" | "training" | "event";
export type EventStatus = "upcoming" | "live" | "finished" | "canceled";
export type ParticipationMode = "opt_in" | "opt_out";

function normalizeEventStatus(s: string | null): EventStatus {
  const v = (s ?? "").trim().toLowerCase();
  if (v === "live") return "live";
  if (v === "finished") return "finished";
  if (v === "canceled") return "canceled";
  return "upcoming";
}

export type EventRow = {
  id: string;
  team_season_id: string;
  kind: EventKind;
  type: 'game' | 'training' | 'event' | 'other';
  /** DB `events.match_type` (Spielart); bei Nicht-Spielen typischerweise null. */
  match_type: string | null;
  opponent: string | null;
  is_home: boolean | null;
  location: string | null;
  /** Optional: ältere DB ohne Spalte */
  address?: string | null;
  starts_at: string;
  meeting_at: string | null;
  status: EventStatus;
  attendance_mode: ParticipationMode;
  notes: string | null;
  match_id: string | null;
  /** Wiederholungsserien (optional) */
  series_id?: string | null;
  /** Optional: Migration 20260315120000 */
  training_absence_deadline_disabled?: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type EventDbRow = {
  id: string;
  team_season_id: string;
  kind: string;
  type?: string | null;
  match_type?: string | null;
  opponent: string | null;
  is_home: boolean | null;
  location: string | null;
  address?: string | null;
  starts_at: string;
  meeting_at: string | null;
  status: string | null;
  attendance_mode: string | null;
  notes: string | null;
  match_id: string | null;
  series_id?: string | null;
  training_absence_deadline_disabled?: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Aktueller events-Select inkl. Serien + optionaler Spalten (Fallback bei alter DB). */
const EVENTS_SELECT =
  "id, team_season_id, kind, type, match_type, opponent, is_home, location, address, starts_at, meeting_at, status, attendance_mode, notes, match_id, series_id, training_absence_deadline_disabled, created_by, created_at, updated_at";

/** Ohne address / series_id / training_absence_deadline_disabled (match_type bleibt drin). */
const EVENTS_SELECT_LEGACY =
  "id, team_season_id, kind, type, match_type, opponent, is_home, location, starts_at, meeting_at, status, attendance_mode, notes, match_id, created_by, created_at, updated_at";

export function useEvents(teamSeasonId: string | null) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamSeasonId) {
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    let res = await supabase
      .from("events")
      .select(EVENTS_SELECT)
      .eq("team_season_id", teamSeasonId)
      .order("starts_at", { ascending: true });

    if (
      res.error &&
      /training_absence_deadline_disabled|series_id|address|match_type|column/i.test(String(res.error.message ?? ""))
    ) {
      res = await supabase
        .from("events")
        .select(EVENTS_SELECT_LEGACY)
        .eq("team_season_id", teamSeasonId)
        .order("starts_at", { ascending: true });
    }

    const { data, error: err } = res;

    if (err) {
      setError(err.message);
      setEvents([]);
    } else {
      const mapped: EventRow[] = (data ?? []).map((r: EventDbRow) => ({
        id: r.id,
        team_season_id: r.team_season_id,
        kind: (r.kind === "match" || r.kind === "training" || r.kind === "event" ? r.kind : "event") as EventKind,
        type: (() => {
          const t = (r.type ?? "").trim().toLowerCase();
          if (t === "game" || t === "training" || t === "event" || t === "other") return t;
          if (r.kind === "match") return "game";
          if (r.kind === "training") return "training";
          if (r.kind === "event") return "event";
          return "other";
        })(),
        match_type: (() => {
          const s = String(r.match_type ?? "").trim();
          return s === "" ? null : s;
        })(),
        opponent: r.opponent ?? null,
        is_home: r.is_home ?? null,
        location: r.location ?? null,
        address: r.address ?? null,
        starts_at: r.starts_at,
        meeting_at: r.meeting_at ?? null,
        status: normalizeEventStatus(r.status),
        attendance_mode: (r.attendance_mode === "opt_out" ? "opt_out" : "opt_in") as ParticipationMode,
        notes: r.notes ?? null,
        match_id: r.match_id ?? null,
        series_id: r.series_id ?? null,
        training_absence_deadline_disabled: r.training_absence_deadline_disabled ?? null,
        created_by: r.created_by ?? null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
      }));
      setEvents(mapped);
    }
    setLoading(false);
  }, [teamSeasonId]);

  useEffect(() => {
    load().catch((e) => {
      setError(e?.message ?? "Unbekannter Fehler");
      setEvents([]);
      setLoading(false);
    });
  }, [load]);

  return { events, loading, error, refetch: load };
}
