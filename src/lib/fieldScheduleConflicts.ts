/**
 * Zeitliche Platzkonflikte (halb-offen [start, end)).
 * Berührung an der Grenze (Ende = Beginn) ist kein Konflikt.
 */

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
};

export function intervalsOverlapHalfOpen(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function zonesConflict(
  a: { zoneId: string | null; blocksEntireField: boolean },
  b: { zoneId: string | null; blocksEntireField: boolean },
): boolean {
  if (a.blocksEntireField || b.blocksEntireField) return true;
  if (a.zoneId == null || b.zoneId == null) return true;
  return a.zoneId === b.zoneId;
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
    return zonesConflict(candidate, row);
  });
}

export type ZoneMeta = {
  id: string;
  name: string;
  blocksEntireField: boolean;
  isActive?: boolean;
};

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
      const candidate: FieldConflictCandidate = {
        id: `candidate-${z.id}`,
        fieldId: opts.fieldId,
        zoneId: z.id,
        blocksEntireField: false,
        startsAtMs: opts.startsAtMs,
        endsAtMs: opts.endsAtMs,
      };
      return findLocalFieldConflicts(candidate, existing).length === 0;
    });

  return { entireFieldFree, freeZones };
}

/**
 * Auslastung eines Platzes im Intervall:
 * - free: nichts belegt
 * - partial: mind. eine nicht-blockierende Teilfläche belegt, Gesamtplatz noch frei
 * - full: Gesamtplatz / blockierende Zone oder alle nicht-blockierenden Zonen belegt
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

  const partialZones = opts.zones.filter((z) => z.isActive !== false && !z.blocksEntireField);
  if (partialZones.length === 0) return 'full';

  const occupied = new Set(
    overlapping.map((e) => e.zoneId).filter((id): id is string => Boolean(id)),
  );
  const allPartialsTaken = partialZones.every((z) => occupied.has(z.id));
  return allPartialsTaken ? 'full' : 'partial';
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
