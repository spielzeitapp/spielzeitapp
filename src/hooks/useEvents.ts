import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { isInternalChampionshipFixture } from "../lib/championshipVisibility";
import {
  normalizeEventKind,
  normalizeEventTypeField,
  type EventKind,
} from "../lib/eventTypeUtils";

export type { EventKind } from "../lib/eventTypeUtils";
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
  /** Optional: Migration 20260802140000 */
  venue_id?: string | null;
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
  opponent_logo_url?: string | null;
  /** Optional: Migration 20260615120000 */
  official_tournament_url?: string | null;
  /** open/agreed = intern; published = Eltern; NULL = normales Event */
  fixture_status?: 'open' | 'agreed' | 'published' | null;
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
  venue_id?: string | null;
  address?: string | null;
  starts_at: string;
  meeting_at: string | null;
  status: string | null;
  attendance_mode: string | null;
  notes: string | null;
  match_id: string | null;
  series_id?: string | null;
  training_absence_deadline_disabled?: boolean | null;
  opponent_logo_url?: string | null;
  official_tournament_url?: string | null;
  fixture_status?: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/** Vollselect inkl. optionaler Spalten. */
const EVENTS_SELECT_FULL =
  "id, team_season_id, kind, type, match_type, opponent, is_home, location, venue_id, address, starts_at, meeting_at, status, attendance_mode, notes, match_id, series_id, training_absence_deadline_disabled, opponent_logo_url, official_tournament_url, fixture_status, created_by, created_at, updated_at";

/**
 * Staging-tauglich: ohne address/series_id/training_absence_deadline_disabled
 * (fehlen oft), ABER MIT fixture_status — sonst Leak open/agreed.
 */
const EVENTS_SELECT_CORE =
  "id, team_season_id, kind, type, match_type, opponent, is_home, location, venue_id, starts_at, meeting_at, status, attendance_mode, notes, match_id, opponent_logo_url, official_tournament_url, fixture_status, created_by, created_at, updated_at";

/** Minimal mit fixture_status. */
const EVENTS_SELECT_MINIMAL =
  "id, team_season_id, kind, type, match_type, opponent, is_home, location, starts_at, meeting_at, status, attendance_mode, notes, match_id, fixture_status, created_by, created_at, updated_at";

/** Letzter Fallback ohne fixture_status (sehr alte DBs). */
const EVENTS_SELECT_LEGACY =
  "id, team_season_id, kind, type, match_type, opponent, is_home, location, starts_at, meeting_at, status, attendance_mode, notes, match_id, created_by, created_at, updated_at";

const OPTIONAL_COL_ERR =
  /training_absence_deadline_disabled|series_id|address|match_type|official_tournament_url|venue_id|opponent_logo_url|fixture_status|column|schema cache/i;

function mapFixtureStatus(
  raw: string | null | undefined,
): EventRow['fixture_status'] {
  if (raw === 'open' || raw === 'agreed' || raw === 'published') return raw;
  return null;
}

function mapRow(r: EventDbRow): EventRow {
  return {
    id: r.id,
    team_season_id: r.team_season_id,
    kind: normalizeEventKind(r.kind),
    type: normalizeEventTypeField(r.kind, r.type) as EventRow['type'],
    match_type: (() => {
      const s = String(r.match_type ?? "").trim();
      return s === "" ? null : s;
    })(),
    opponent: r.opponent ?? null,
    is_home: r.is_home ?? null,
    location: r.location ?? null,
    venue_id: r.venue_id ?? null,
    address: r.address ?? null,
    starts_at: r.starts_at,
    meeting_at: r.meeting_at ?? null,
    status: normalizeEventStatus(r.status),
    attendance_mode: (r.attendance_mode === "opt_out" ? "opt_out" : "opt_in") as ParticipationMode,
    notes: r.notes ?? null,
    match_id: r.match_id ?? null,
    series_id: r.series_id ?? null,
    training_absence_deadline_disabled: r.training_absence_deadline_disabled ?? null,
    opponent_logo_url: r.opponent_logo_url ?? null,
    official_tournament_url: r.official_tournament_url ?? null,
    fixture_status: mapFixtureStatus(r.fixture_status),
    created_by: r.created_by ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

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

    const run = (select: string) =>
      supabase
        .from("events")
        .select(select)
        .eq("team_season_id", teamSeasonId)
        .order("starts_at", { ascending: true });

    let res = await run(EVENTS_SELECT_FULL);
    if (res.error && OPTIONAL_COL_ERR.test(String(res.error.message ?? ""))) {
      res = await run(EVENTS_SELECT_CORE);
    }
    if (res.error && OPTIONAL_COL_ERR.test(String(res.error.message ?? ""))) {
      res = await run(EVENTS_SELECT_MINIMAL);
    }
    if (res.error && OPTIONAL_COL_ERR.test(String(res.error.message ?? ""))) {
      // Nur wenn fixture_status selbst fehlt — Leak-Risiko; filtert dann nichts championship-intern.
      res = await run(EVENTS_SELECT_LEGACY);
    }

    const { data, error: err } = res;

    if (err) {
      setError(err.message);
      setEvents([]);
    } else {
      const rows = (data ?? []) as unknown as EventDbRow[];
      const mapped: EventRow[] = rows
        .filter((r) => !isInternalChampionshipFixture(r.fixture_status))
        .map((r) => mapRow(r));
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
