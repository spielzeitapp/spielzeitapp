/**
 * Platzzuordnung zu bestehenden Events (keine Termin-Dubletten).
 */

import { supabase } from './supabaseClient';
import { resolveEndAtFromNotes } from '../pages/calendar/calendarUtils';
import type { EventKind } from './eventTypeUtils';
import { normalizeEventKind } from './eventTypeUtils';

export type EventFieldAssignmentRow = {
  id: string;
  club_id: string;
  event_id: string;
  venue_id: string;
  field_id: string;
  zone_id: string | null;
  starts_at: string;
  ends_at: string;
  created_at?: string | null;
};

export type EventFieldAssignmentConflict = {
  assignment_id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  zone_id: string | null;
  reason: string;
};

const ASSIGN_SELECT =
  'id, club_id, event_id, venue_id, field_id, zone_id, starts_at, ends_at, created_at';

function isAssignmentsMigrationPending(message: string): boolean {
  return /event_field_assignments|find_event_field_assignment_conflicts|does not exist|schema cache|42P01|42883/i.test(
    message,
  );
}

export function defaultEventEndsAt(args: {
  startsAtIso: string;
  kind: string | null | undefined;
  type?: string | null;
  notes?: string | null;
}): string {
  const kind = normalizeEventKind(args.kind);
  const calType =
    kind === 'match' ? 'game' : kind === 'training' ? 'training' : kind === 'tournament' ? 'tournament' : 'event';
  const resolved = resolveEndAtFromNotes({
    startsAtIso: args.startsAtIso,
    eventType: calType,
    notes: args.notes ?? null,
  });
  if (resolved) return resolved;
  const start = new Date(args.startsAtIso).getTime();
  const addMin = calType === 'event' ? 60 : 90;
  return new Date(start + addMin * 60 * 1000).toISOString();
}

export async function listAssignmentsInRange(
  clubId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<{ data: EventFieldAssignmentRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('event_field_assignments')
    .select(ASSIGN_SELECT)
    .eq('club_id', clubId)
    .lt('starts_at', rangeEndIso)
    .gt('ends_at', rangeStartIso)
    .order('starts_at', { ascending: true });
  if (error) {
    if (isAssignmentsMigrationPending(error.message)) {
      return {
        data: [],
        error: 'Platzzuordnungs-Tabellen noch nicht migriert (STEP 2 Migration ausstehend).',
      };
    }
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as EventFieldAssignmentRow[], error: null };
}

export async function listAssignmentsForToday(
  clubId: string,
  dayStartIso: string,
  dayEndIso: string,
): Promise<{ data: EventFieldAssignmentRow[]; error: string | null }> {
  return listAssignmentsInRange(clubId, dayStartIso, dayEndIso);
}

export async function getAssignmentForEvent(
  eventId: string,
): Promise<{ data: EventFieldAssignmentRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('event_field_assignments')
    .select(ASSIGN_SELECT)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    if (isAssignmentsMigrationPending(error.message)) {
      return { data: null, error: null };
    }
    return { data: null, error: error.message };
  }
  return { data: (data as EventFieldAssignmentRow | null) ?? null, error: null };
}

export async function findAssignmentConflicts(input: {
  clubId: string;
  fieldId: string;
  zoneId: string | null;
  startsAt: string;
  endsAt: string;
  excludeAssignmentId?: string | null;
}): Promise<{ data: EventFieldAssignmentConflict[]; error: string | null }> {
  const { data, error } = await supabase.rpc('find_event_field_assignment_conflicts', {
    p_club_id: input.clubId,
    p_field_id: input.fieldId,
    p_zone_id: input.zoneId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_exclude_assignment_id: input.excludeAssignmentId ?? null,
  });
  if (error) {
    if (isAssignmentsMigrationPending(error.message)) {
      return { data: [], error: 'Konfliktprüfung noch nicht migriert.' };
    }
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as EventFieldAssignmentConflict[], error: null };
}

export async function upsertEventFieldAssignment(input: {
  clubId: string;
  eventId: string;
  venueId: string;
  fieldId: string;
  zoneId: string | null;
  startsAt: string;
  endsAt: string;
  existingId?: string | null;
}): Promise<{ data: EventFieldAssignmentRow | null; error: string | null; conflicts?: EventFieldAssignmentConflict[] }> {
  if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
    return { data: null, error: 'Ende muss nach Beginn liegen.' };
  }

  const conflictRes = await findAssignmentConflicts({
    clubId: input.clubId,
    fieldId: input.fieldId,
    zoneId: input.zoneId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    excludeAssignmentId: input.existingId ?? null,
  });
  if (conflictRes.error && !/noch nicht migriert/i.test(conflictRes.error)) {
    return { data: null, error: conflictRes.error };
  }
  if (conflictRes.data.length > 0) {
    return {
      data: null,
      error: conflictRes.data[0]?.reason ?? 'Platzkonflikt',
      conflicts: conflictRes.data,
    };
  }

  const payload = {
    club_id: input.clubId,
    event_id: input.eventId,
    venue_id: input.venueId,
    field_id: input.fieldId,
    zone_id: input.zoneId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
  };

  if (input.existingId) {
    const { data, error } = await supabase
      .from('event_field_assignments')
      .update(payload)
      .eq('id', input.existingId)
      .select(ASSIGN_SELECT)
      .maybeSingle();
    if (error) return { data: null, error: humanizeAssignError(error.message) };
    return { data: data as EventFieldAssignmentRow, error: null };
  }

  const { data, error } = await supabase
    .from('event_field_assignments')
    .insert(payload)
    .select(ASSIGN_SELECT)
    .maybeSingle();
  if (error) return { data: null, error: humanizeAssignError(error.message) };
  return { data: data as EventFieldAssignmentRow, error: null };
}

export async function deleteEventFieldAssignment(
  assignmentId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.from('event_field_assignments').delete().eq('id', assignmentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

function humanizeAssignError(message: string): string {
  if (/Platzkonflikt|check_violation/i.test(message)) {
    return message.replace(/^.*Platzkonflikt:\s*/i, 'Platzkonflikt: ') || 'Platzkonflikt';
  }
  if (/duplicate|unique/i.test(message)) {
    return 'Für diesen Termin existiert bereits eine Platzzuordnung.';
  }
  return message;
}

/** Events des Clubs im Zeitraum (über alle Team-Saisons, die der User lesen darf). */
export async function listClubEventsInRange(
  clubId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<{
  data: Array<{
    id: string;
    team_season_id: string;
    kind: EventKind;
    type: string | null;
    opponent: string | null;
    starts_at: string;
    notes: string | null;
    location: string | null;
    venue_id: string | null;
    status: string | null;
    team_name: string | null;
    age_group: string | null;
  }>;
  error: string | null;
}> {
  const { data: teams, error: tErr } = await supabase
    .from('teams')
    .select('id, name, age_group')
    .eq('club_id', clubId);
  if (tErr) return { data: [], error: tErr.message };
  const teamIds = (teams ?? []).map((t) => String((t as { id: string }).id)).filter(Boolean);
  if (teamIds.length === 0) return { data: [], error: null };

  const teamById = new Map(
    (teams ?? []).map((t) => {
      const row = t as { id: string; name?: string | null; age_group?: string | null };
      return [row.id, row] as const;
    }),
  );

  const { data: seasons, error: sErr } = await supabase
    .from('team_seasons')
    .select('id, team_id, status')
    .in('team_id', teamIds)
    .in('status', ['active', 'draft']);
  if (sErr) return { data: [], error: sErr.message };
  const seasonIds = (seasons ?? []).map((s) => String((s as { id: string }).id)).filter(Boolean);
  if (seasonIds.length === 0) return { data: [], error: null };

  const seasonTeam = new Map(
    (seasons ?? []).map((s) => {
      const row = s as { id: string; team_id: string };
      return [row.id, row.team_id] as const;
    }),
  );

  const { data: events, error: eErr } = await supabase
    .from('events')
    .select('id, team_season_id, kind, type, opponent, starts_at, notes, location, venue_id, status')
    .in('team_season_id', seasonIds)
    .gte('starts_at', rangeStartIso)
    .lt('starts_at', rangeEndIso)
    .neq('status', 'canceled')
    .order('starts_at', { ascending: true });
  if (eErr) return { data: [], error: eErr.message };

  return {
    data: (events ?? []).map((raw) => {
      const e = raw as {
        id: string;
        team_season_id: string;
        kind: string;
        type: string | null;
        opponent: string | null;
        starts_at: string;
        notes: string | null;
        location: string | null;
        venue_id: string | null;
        status: string | null;
      };
      const teamId = seasonTeam.get(e.team_season_id);
      const team = teamId ? teamById.get(teamId) : null;
      return {
        id: e.id,
        team_season_id: e.team_season_id,
        kind: normalizeEventKind(e.kind),
        type: e.type,
        opponent: e.opponent,
        starts_at: e.starts_at,
        notes: e.notes,
        location: e.location,
        venue_id: e.venue_id,
        status: e.status,
        team_name: team?.name ?? null,
        age_group: team?.age_group ?? null,
      };
    }),
    error: null,
  };
}
