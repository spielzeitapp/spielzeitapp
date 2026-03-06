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
  match_type: string | null;
  opponent: string | null;
  is_home: boolean | null;
  location: string | null;
  starts_at: string;
  meetup_at: string | null;
  status: EventStatus;
  participation_mode: ParticipationMode;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Optional DB: bevorzugt für Logo-Pfad /logos/<slug>.png */
  opponent_slug?: string | null;
  /** Optional DB: nur public/Storage-URL verwenden */
  opponent_logo_url?: string | null;
};

type EventDbRow = {
  id: string;
  team_season_id: string;
  kind: string;
  match_type: string | null;
  opponent: string | null;
  is_home: boolean | null;
  location: string | null;
  starts_at: string;
  meetup_at: string | null;
  status: string | null;
  participation_mode: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  opponent_slug?: string | null;
  opponent_logo_url?: string | null;
};

/** Spalten in events. match_type nullable – Spalte in DB ggf. per Migration ergänzen. */
const EVENTS_SELECT =
  "id, team_season_id, kind, match_type, opponent, is_home, location, starts_at, meetup_at, status, participation_mode, notes, created_by, created_at, updated_at";

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
    const { data, error: err } = await supabase
      .from("events")
      .select(EVENTS_SELECT)
      .eq("team_season_id", teamSeasonId)
      .order("starts_at", { ascending: true });

    if (err) {
      setError(err.message);
      setEvents([]);
    } else {
      const mapped: EventRow[] = (data ?? []).map((r: EventDbRow) => ({
        id: r.id,
        team_season_id: r.team_season_id,
        kind: (r.kind === "match" || r.kind === "training" || r.kind === "event" ? r.kind : "event") as EventKind,
        match_type: r.match_type ?? null,
        opponent: r.opponent ?? null,
        is_home: r.is_home ?? null,
        location: r.location ?? null,
        starts_at: r.starts_at,
        meetup_at: r.meetup_at ?? null,
        status: normalizeEventStatus(r.status),
        participation_mode: (r.participation_mode === "opt_out" ? "opt_out" : "opt_in") as ParticipationMode,
        notes: r.notes ?? null,
        created_by: r.created_by ?? null,
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
        opponent_slug: r.opponent_slug ?? null,
        opponent_logo_url: r.opponent_logo_url ?? null,
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
