/**
 * MANAGER-PLATZ.7: Event + Platzassignment anlegen (sequentiell, Rollback bei Assignment-Fehler).
 * Keine zweite Architektur — gleiche Bausteine wie CreateEventModal.
 */

import { supabase } from './supabaseClient';
import { assertTeamSeasonWritable } from './seasonTransition';
import { eventKindFromFormType, type EventKind } from './eventTypeUtils';
import {
  findAssignmentConflicts,
  upsertEventFieldAssignment,
  type EventFieldAssignmentConflict,
  type EventFieldAssignmentRow,
} from './eventFieldAssignments';
import { locationTextFromVenue, type VenueRow } from './venues';
import {
  listAllowedVenueRowsForPurpose,
  type VenuePurpose,
} from './teamSeasonTrainingVenues';

export type OccupancyKindForm = 'training' | 'match' | 'tournament' | 'event';

export function occupancyPurposeForKind(kind: OccupancyKindForm): VenuePurpose {
  return kind === 'match' ? 'home_match' : 'training';
}

export function formKindToEventKind(kind: OccupancyKindForm): EventKind {
  if (kind === 'match') return eventKindFromFormType('game');
  if (kind === 'training') return eventKindFromFormType('training');
  if (kind === 'tournament') return eventKindFromFormType('tournament');
  return eventKindFromFormType('event');
}

/** Venues: Club-eigene aktiv + Grant für purpose (z. B. USC → Rohrbach). */
export async function listVenuesForOccupancyCreate(opts: {
  clubId: string;
  teamSeasonId: string;
  purpose: VenuePurpose;
  clubVenues: readonly VenueRow[];
}): Promise<VenueRow[]> {
  const allowed = await listAllowedVenueRowsForPurpose(opts.teamSeasonId, opts.purpose);
  const byId = new Map<string, VenueRow>();
  for (const v of opts.clubVenues) {
    if (v.is_active !== false && v.club_id === opts.clubId) byId.set(v.id, v);
  }
  for (const v of allowed.data) {
    if (v.is_active !== false) byId.set(v.id, v);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function checkOccupancyConflicts(input: {
  clubId: string;
  fieldId: string;
  zoneId: string | null;
  startsAt: string;
  endsAt: string;
  excludeAssignmentId?: string | null;
}): Promise<{ conflicts: EventFieldAssignmentConflict[]; error: string | null }> {
  const res = await findAssignmentConflicts(input);
  if (res.error && !/noch nicht migriert/i.test(res.error)) {
    return { conflicts: [], error: res.error };
  }
  return { conflicts: res.data, error: null };
}

export type CreateFacilityOccupancyInput = {
  clubId: string;
  teamSeasonId: string;
  kind: OccupancyKindForm;
  title: string;
  startsAtIso: string;
  endsAtIso: string;
  venue: VenueRow;
  fieldId: string;
  zoneId: string | null;
  createdByUserId: string | null;
  /** Optional org-internal note (stored after title line in notes). */
  note?: string | null;
};

export type CreateFacilityOccupancyResult =
  | {
      ok: true;
      eventId: string;
      assignment: EventFieldAssignmentRow;
    }
  | {
      ok: false;
      error: string;
      conflicts?: EventFieldAssignmentConflict[];
      /** True when event was rolled back after assignment failure */
      rolledBack?: boolean;
    };

function buildNotes(title: string, note?: string | null): string | null {
  const t = title.trim();
  const n = (note ?? '').trim();
  if (!t && !n) return null;
  if (t && n) return `${t}\n${n}`;
  return t || n || null;
}

/**
 * Erstellt Event, dann Assignment. Bei Assignment-Fehler: Event löschen (kein Orphan).
 */
export async function createFacilityOccupancy(
  input: CreateFacilityOccupancyInput,
): Promise<CreateFacilityOccupancyResult> {
  if (new Date(input.endsAtIso).getTime() <= new Date(input.startsAtIso).getTime()) {
    return { ok: false, error: 'Ende muss nach Beginn liegen.' };
  }
  if (!input.fieldId || !input.venue?.id) {
    return { ok: false, error: 'Sportanlage und Platz sind Pflicht.' };
  }

  const writable = await assertTeamSeasonWritable(input.teamSeasonId);
  if (!writable.ok) {
    return { ok: false, error: writable.message ?? 'Saison ist nicht beschreibbar.' };
  }

  const conflictCheck = await checkOccupancyConflicts({
    clubId: input.clubId,
    fieldId: input.fieldId,
    zoneId: input.zoneId,
    startsAt: input.startsAtIso,
    endsAt: input.endsAtIso,
  });
  if (conflictCheck.error) return { ok: false, error: conflictCheck.error };
  if (conflictCheck.conflicts.length > 0) {
    return {
      ok: false,
      error: conflictCheck.conflicts[0]?.reason ?? 'Platzkonflikt',
      conflicts: conflictCheck.conflicts,
    };
  }

  const eventKind = formKindToEventKind(input.kind);
  const title = input.title.trim();
  const notes = buildNotes(title, input.note);
  const location = locationTextFromVenue(input.venue) || input.venue.name;

  const payload: Record<string, unknown> = {
    team_season_id: input.teamSeasonId,
    kind: eventKind,
    type:
      eventKind === 'match'
        ? 'game'
        : eventKind === 'training'
          ? 'training'
          : eventKind === 'tournament'
            ? 'tournament'
            : 'event',
    opponent: eventKind === 'match' ? title || null : null,
    is_home: eventKind === 'match' ? true : null,
    location,
    venue_id: input.venue.id,
    starts_at: input.startsAtIso,
    meeting_at: null,
    status: 'upcoming',
    attendance_mode: 'optional',
    created_by: input.createdByUserId,
  };
  if (notes) payload.notes = notes;
  if (eventKind !== 'match' && !notes && title) payload.notes = title;

  const { data: inserted, error: insertErr } = await supabase
    .from('events')
    .insert(payload)
    .select('id')
    .maybeSingle();

  if (insertErr || !inserted?.id) {
    return { ok: false, error: insertErr?.message ?? 'Termin konnte nicht angelegt werden.' };
  }

  const eventId = String(inserted.id);
  const assignRes = await upsertEventFieldAssignment({
    clubId: input.clubId,
    eventId,
    venueId: input.venue.id,
    fieldId: input.fieldId,
    zoneId: input.zoneId,
    startsAt: input.startsAtIso,
    endsAt: input.endsAtIso,
  });

  if (assignRes.error || !assignRes.data) {
    await supabase.from('events').delete().eq('id', eventId);
    return {
      ok: false,
      error: assignRes.error ?? 'Platzzuordnung fehlgeschlagen.',
      conflicts: assignRes.conflicts,
      rolledBack: true,
    };
  }

  return { ok: true, eventId, assignment: assignRes.data };
}
