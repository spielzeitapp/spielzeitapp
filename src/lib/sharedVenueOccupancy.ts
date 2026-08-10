/**
 * PLATZ.6: Minimale organisationsübergreifende Belegungssicht (ohne private Daten).
 */

import { supabase } from './supabaseClient';
import { normalizeEventKind, type EventKind } from './eventTypeUtils';

/** Felder der RPC list_shared_venue_occupancy — Whitelist, keine notes/players. */
export type SharedVenueOccupancyRow = {
  assignment_id: string;
  event_id: string;
  team_season_id: string;
  team_name: string;
  org_name: string;
  kind: string;
  type: string | null;
  status: string | null;
  starts_at: string;
  ends_at: string;
  venue_id: string;
  field_id: string;
  field_name: string;
  zone_id: string | null;
  zone_name: string | null;
  is_own: boolean;
  can_edit: boolean;
};

const SHARED_DTO_KEYS = [
  'assignment_id',
  'event_id',
  'team_season_id',
  'team_name',
  'org_name',
  'kind',
  'type',
  'status',
  'starts_at',
  'ends_at',
  'venue_id',
  'field_id',
  'field_name',
  'zone_id',
  'zone_name',
  'is_own',
  'can_edit',
] as const;

/** Minimales Assignment-DTO (ohne Import-Zyklus zu eventFieldAssignments). */
export type SharedOccupancyAssignmentLike = {
  id: string;
  club_id: string;
  event_id: string;
  venue_id: string;
  field_id: string;
  zone_id: string | null;
  starts_at: string;
  ends_at: string;
};

export type SharedOccupancyEventLike = {
  id: string;
  team_season_id: string;
  kind: EventKind;
  type: string | null;
  opponent: string | null;
  starts_at: string;
  notes: null;
  location: string | null;
  venue_id: string | null;
  status: string | null;
  team_name: string | null;
  age_group: string | null;
  org_name: string | null;
};

export function pickSharedOccupancyDto(raw: Record<string, unknown>): SharedVenueOccupancyRow {
  return {
    assignment_id: String(raw.assignment_id ?? ''),
    event_id: String(raw.event_id ?? ''),
    team_season_id: String(raw.team_season_id ?? ''),
    team_name: String(raw.team_name ?? 'Mannschaft'),
    org_name: String(raw.org_name ?? 'Organisation'),
    kind: String(raw.kind ?? ''),
    type: (raw.type as string | null) ?? null,
    status: (raw.status as string | null) ?? null,
    starts_at: String(raw.starts_at ?? ''),
    ends_at: String(raw.ends_at ?? ''),
    venue_id: String(raw.venue_id ?? ''),
    field_id: String(raw.field_id ?? ''),
    field_name: String(raw.field_name ?? 'Platz'),
    zone_id: (raw.zone_id as string | null) ?? null,
    zone_name: (raw.zone_name as string | null) ?? null,
    is_own: Boolean(raw.is_own),
    can_edit: Boolean(raw.can_edit),
  };
}

/** Dokumentiert / testbar: Shared-DTO darf keine privaten Felder tragen. */
export function sharedOccupancyDtoFieldWhitelist(): readonly string[] {
  return SHARED_DTO_KEYS;
}

export function assertNoPrivateSharedFields(row: Record<string, unknown>): boolean {
  const forbidden = ['notes', 'players', 'player_ids', 'attendance', 'description', 'created_by'];
  return !forbidden.some((k) => Object.prototype.hasOwnProperty.call(row, k) && row[k] != null);
}

export async function listSharedVenueOccupancy(
  venueId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<{ data: SharedVenueOccupancyRow[]; error: string | null }> {
  if (!venueId || !rangeStartIso || !rangeEndIso) return { data: [], error: null };
  const { data, error } = await supabase.rpc('list_shared_venue_occupancy', {
    p_venue_id: venueId,
    p_range_start: rangeStartIso,
    p_range_end: rangeEndIso,
  });
  if (error) {
    if (/list_shared_venue_occupancy|42883|does not exist|schema cache/i.test(error.message)) {
      return { data: [], error: null };
    }
    return { data: [], error: error.message };
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return {
    data: rows.map(pickSharedOccupancyDto).filter((r) => r.assignment_id && r.event_id),
    error: null,
  };
}

export function occupancyToAssignmentRow(
  row: SharedVenueOccupancyRow,
  clubIdFallback = '',
): SharedOccupancyAssignmentLike {
  return {
    id: row.assignment_id,
    club_id: clubIdFallback,
    event_id: row.event_id,
    venue_id: row.venue_id,
    field_id: row.field_id,
    zone_id: row.zone_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
  };
}

export function occupancyToEventLike(row: SharedVenueOccupancyRow): SharedOccupancyEventLike {
  return {
    id: row.event_id,
    team_season_id: row.team_season_id,
    kind: normalizeEventKind(row.kind || row.type),
    type: row.type,
    opponent: null,
    starts_at: row.starts_at,
    notes: null,
    location: null,
    venue_id: row.venue_id,
    status: row.status,
    team_name: row.team_name,
    age_group: null,
    org_name: row.org_name,
  };
}

/**
 * Merged Club-Assignments/Events mit Shared-Occupancy (Deduplizierung nach Assignment-/Event-ID).
 */
export function mergeSharedOccupancyIntoSchedule(opts: {
  events: SharedOccupancyEventLike[];
  assignments: SharedOccupancyAssignmentLike[];
  occupancy: SharedVenueOccupancyRow[];
  clubId?: string;
}): {
  events: SharedOccupancyEventLike[];
  assignments: SharedOccupancyAssignmentLike[];
  sharedMeta: Map<string, { can_edit: boolean; org_name: string; is_own: boolean }>;
} {
  const eventIds = new Set(opts.events.map((e) => e.id));
  const assignmentIds = new Set(opts.assignments.map((a) => a.id));
  const events = [...opts.events];
  const assignments = [...opts.assignments];
  const sharedMeta = new Map<string, { can_edit: boolean; org_name: string; is_own: boolean }>();

  for (const row of opts.occupancy) {
    sharedMeta.set(row.event_id, {
      can_edit: row.can_edit,
      org_name: row.org_name,
      is_own: row.is_own,
    });
    if (!assignmentIds.has(row.assignment_id)) {
      assignments.push(occupancyToAssignmentRow(row, opts.clubId ?? ''));
      assignmentIds.add(row.assignment_id);
    }
    if (!eventIds.has(row.event_id)) {
      events.push(occupancyToEventLike(row));
      eventIds.add(row.event_id);
    }
  }

  return { events, assignments, sharedMeta };
}
