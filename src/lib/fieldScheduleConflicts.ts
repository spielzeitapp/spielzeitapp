/**
 * Zeitliche und räumliche Platzkonflikte (halb-offen [start, end)).
 * Berührung an der Grenze (Ende = Beginn) ist kein Konflikt.
 * PLATZ.4: räumliche Rect-Overlaps ergänzen die Legacy-Zonen-ID-Logik.
 */

import {
  zonesSpatiallyConflict,
  type NormalizedRect,
  type ZoneGeometry,
} from './fieldZoneGeometry';

export type FieldConflictCandidate = {
  id: string;
  fieldId: string;
  zoneId: string | null;
  /** true wenn zone_id null oder Zone.blocks_entire_field */
  blocksEntireField: boolean;
  startsAtMs: number;
  endsAtMs: number;
  eventId?: string;
  label?: string;
  /** optional: Geometrie für räumliche Konflikte */
  zone?: ZoneGeometry | null;
};

export function intervalsOverlapHalfOpen(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Legacy: nur IDs / blocks_entire (ohne Geometrie). */
export function zonesConflict(
  a: { zoneId: string | null; blocksEntireField: boolean },
  b: { zoneId: string | null; blocksEntireField: boolean },
): boolean {
  if (a.blocksEntireField || b.blocksEntireField) return true;
  if (a.zoneId == null || b.zoneId == null) return true;
  return a.zoneId === b.zoneId;
}

function candidateZoneGeom(c: FieldConflictCandidate): ZoneGeometry | null {
  if (c.zone) return c.zone;
  if (c.blocksEntireField || c.zoneId == null) {
    return {
      id: c.zoneId ?? undefined,
      name: 'Ganzer Platz',
      layoutKind: 'entire',
      blocksEntireField: true,
      rect: { x: 0, y: 0, w: 1, h: 1 },
    };
  }
  return {
    id: c.zoneId,
    name: c.label ?? c.zoneId,
    layoutKind: 'named',
    blocksEntireField: false,
    rect: null,
  };
}

export function findLocalFieldConflicts(
  candidate: FieldConflictCandidate,
  existing: readonly FieldConflictCandidate[],
): FieldConflictCandidate[] {
  return existing.filter((row) => {
    if (row.id && candidate.id && row.id === candidate.id) return false;
    if (row.fieldId !== candidate.fieldId) return false;
    if (!intervalsOverlapHalfOpen(candidate.startsAtMs, candidate.endsAtMs, row.startsAtMs, row.endsAtMs)) {
      return false;
    }
    return zonesSpatiallyConflict(candidateZoneGeom(candidate), candidateZoneGeom(row));
  });
}

export type ZoneMeta = {
  id: string;
  name: string;
  blocksEntireField: boolean;
  isActive?: boolean;
  zone?: ZoneGeometry;
  layoutKind?: ZoneGeometry['layoutKind'];
  rect?: NormalizedRect | null;
};

function zoneMetaToGeom(z: ZoneMeta): ZoneGeometry {
  if (z.zone) return z.zone;
  return {
    id: z.id,
    name: z.name,
    layoutKind: z.layoutKind ?? (z.blocksEntireField ? 'entire' : 'named'),
    blocksEntireField: z.blocksEntireField,
    rect: z.rect ?? null,
  };
}

/**
 * Freie Teilflächen für denselben Zeitraum (ohne blockierende Gesamtflächen).
 * Gesamter Platz (null) gilt nur als frei, wenn keine Überlappung existiert.
 */
export function suggestFreeZones(opts: {
  fieldId: string;
  startsAtMs: number;
  endsAtMs: number;
  zones: readonly ZoneMeta[];
  existing: readonly FieldConflictCandidate[];
  excludeAssignmentId?: string | null;
}): { entireFieldFree: boolean; freeZones: ZoneMeta[] } {
  const existing = opts.existing.filter(
    (e) =>
      e.fieldId === opts.fieldId &&
      (!opts.excludeAssignmentId || e.id !== opts.excludeAssignmentId),
  );

  const entireCandidate: FieldConflictCandidate = {
    id: 'candidate-entire',
    fieldId: opts.fieldId,
    zoneId: null,
    blocksEntireField: true,
    startsAtMs: opts.startsAtMs,
    endsAtMs: opts.endsAtMs,
  };
  const entireFieldFree = findLocalFieldConflicts(entireCandidate, existing).length === 0;

  const freeZones = opts.zones
    .filter((z) => z.isActive !== false && !z.blocksEntireField)
    .filter((z) => {
      const geom = zoneMetaToGeom(z);
      const candidate: FieldConflictCandidate = {
        id: `candidate-${z.id}`,
        fieldId: opts.fieldId,
        zoneId: z.id,
        blocksEntireField: false,
        startsAtMs: opts.startsAtMs,
        endsAtMs: opts.endsAtMs,
        zone: geom,
      };
      return findLocalFieldConflicts(candidate, existing).length === 0;
    });

  return { entireFieldFree, freeZones };
}

/**
 * Freie alternative Plätze derselben Sportanlage (andere field_id).
 */
export function suggestFreeSiblingFields(opts: {
  venueId: string;
  fieldId: string;
  startsAtMs: number;
  endsAtMs: number;
  fields: readonly { id: string; venue_id: string; name: string; is_active?: boolean }[];
  existing: readonly FieldConflictCandidate[];
  excludeAssignmentId?: string | null;
}): { id: string; name: string }[] {
  return opts.fields
    .filter((f) => f.venue_id === opts.venueId && f.id !== opts.fieldId && f.is_active !== false)
    .filter((f) => {
      const candidate: FieldConflictCandidate = {
        id: `sibling-${f.id}`,
        fieldId: f.id,
        zoneId: null,
        blocksEntireField: true,
        startsAtMs: opts.startsAtMs,
        endsAtMs: opts.endsAtMs,
      };
      const existing = opts.existing.filter(
        (e) => !opts.excludeAssignmentId || e.id !== opts.excludeAssignmentId,
      );
      return findLocalFieldConflicts(candidate, existing).length === 0;
    })
    .map((f) => ({ id: f.id, name: f.name }));
}

/**
 * Auslastung eines Platzes im Intervall (Flächenanteil, nicht nur Zonen-Anzahl).
 */
export function fieldUtilizationInInterval(opts: {
  fieldId: string;
  startsAtMs: number;
  endsAtMs: number;
  zones: readonly ZoneMeta[];
  existing: readonly FieldConflictCandidate[];
}): 'free' | 'partial' | 'full' {
  const overlapping = opts.existing.filter(
    (e) =>
      e.fieldId === opts.fieldId &&
      intervalsOverlapHalfOpen(opts.startsAtMs, opts.endsAtMs, e.startsAtMs, e.endsAtMs),
  );
  if (overlapping.length === 0) return 'free';
  if (overlapping.some((e) => e.blocksEntireField || e.zoneId == null)) return 'full';

  // Räumliche Abdeckung grob: wenn gesamte Fläche durch Overlaps der Belegungen „voll“
  // Für einfache UI: wenn kein freier Partial-Zone mehr frei → full
  const suggestion = suggestFreeZones({
    fieldId: opts.fieldId,
    startsAtMs: opts.startsAtMs,
    endsAtMs: opts.endsAtMs,
    zones: opts.zones,
    existing: overlapping,
  });
  if (!suggestion.entireFieldFree && suggestion.freeZones.length === 0) return 'full';
  return 'partial';
}

/** PLATZ.3 Client-Rechte: eigene Staff-Mannschaft oder Vereins-Admin (role=admin irgendwo im Club). */
export function canManageFacilityAssignmentForEvent(opts: {
  eventTeamSeasonId: string;
  memberships: readonly { team_season_id: string; role: string }[];
  clubTeamSeasonIds: readonly string[];
}): boolean {
  const clubSet = new Set(opts.clubTeamSeasonIds);
  const staffRoles = new Set(['trainer', 'co_trainer', 'head_coach', 'admin']);
  for (const m of opts.memberships) {
    const role = String(m.role ?? '')
      .trim()
      .toLowerCase();
    if (m.team_season_id === opts.eventTeamSeasonId && staffRoles.has(role)) return true;
    if (role === 'admin' && clubSet.has(m.team_season_id)) return true;
  }
  return false;
}
