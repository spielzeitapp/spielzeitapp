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
