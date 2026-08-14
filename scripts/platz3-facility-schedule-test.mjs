/**
 * PLATZ.3 – Konflikt- und Rechte-Logik (ohne DB), selbstständig lauffähig.
 */
import assert from 'assert';

function intervalsOverlapHalfOpen(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function zonesConflict(a, b) {
  if (a.blocksEntireField || b.blocksEntireField) return true;
  if (a.zoneId == null || b.zoneId == null) return true;
  return a.zoneId === b.zoneId;
}

function findLocalFieldConflicts(candidate, existing) {
  return existing.filter((row) => {
    if (row.id && candidate.id && row.id === candidate.id) return false;
    if (row.fieldId !== candidate.fieldId) return false;
    if (!intervalsOverlapHalfOpen(candidate.startsAtMs, candidate.endsAtMs, row.startsAtMs, row.endsAtMs)) {
      return false;
    }
    return zonesConflict(candidate, row);
  });
}

function suggestFreeZones(opts) {
  const existing = opts.existing.filter(
    (e) =>
      e.fieldId === opts.fieldId &&
      (!opts.excludeAssignmentId || e.id !== opts.excludeAssignmentId),
  );
  const entireCandidate = {
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
      const candidate = {
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

function fieldUtilizationInInterval(opts) {
  const overlapping = opts.existing.filter(
    (e) =>
      e.fieldId === opts.fieldId &&
      intervalsOverlapHalfOpen(opts.startsAtMs, opts.endsAtMs, e.startsAtMs, e.endsAtMs),
  );
  if (overlapping.length === 0) return 'free';
  if (overlapping.some((e) => e.blocksEntireField || e.zoneId == null)) return 'full';
  const partialZones = opts.zones.filter((z) => z.isActive !== false && !z.blocksEntireField);
  if (partialZones.length === 0) return 'full';
  const occupied = new Set(overlapping.map((e) => e.zoneId).filter(Boolean));
  return partialZones.every((z) => occupied.has(z.id)) ? 'full' : 'partial';
}

function canManageFacilityAssignmentForEvent(opts) {
  const clubSet = new Set(opts.clubTeamSeasonIds);
  const staffRoles = new Set(['trainer', 'co_trainer', 'head_coach', 'admin']);
  for (const m of opts.memberships) {
    const role = String(m.role ?? '').trim().toLowerCase();
    if (m.team_season_id === opts.eventTeamSeasonId && staffRoles.has(role)) return true;
    if (role === 'admin' && clubSet.has(m.team_season_id)) return true;
  }
  return false;
}

assert.strictEqual(intervalsOverlapHalfOpen(0, 100, 100, 200), false);
assert.strictEqual(intervalsOverlapHalfOpen(0, 100, 99, 200), true);

assert.strictEqual(
  zonesConflict({ zoneId: 'h1', blocksEntireField: false }, { zoneId: 'h2', blocksEntireField: false }),
  false,
);
assert.strictEqual(
  zonesConflict({ zoneId: 'h1', blocksEntireField: false }, { zoneId: null, blocksEntireField: true }),
  true,
);

const half1 = {
  id: 'a1',
  fieldId: 'field-rohrbach',
  zoneId: 'h1',
  blocksEntireField: false,
  startsAtMs: 17 * 3600_000,
  endsAtMs: 18.5 * 3600_000,
};
const half2 = {
  id: 'a2',
  fieldId: 'field-rohrbach',
  zoneId: 'h2',
  blocksEntireField: false,
  startsAtMs: 17 * 3600_000,
  endsAtMs: 18.5 * 3600_000,
};
const otherVenue = {
  id: 'a3',
  fieldId: 'field-stveit',
  zoneId: null,
  blocksEntireField: true,
  startsAtMs: 17 * 3600_000,
  endsAtMs: 18.5 * 3600_000,
};

assert.strictEqual(findLocalFieldConflicts(half1, [half2]).length, 0);
assert.ok(
  findLocalFieldConflicts(
    {
      id: 'a4',
      fieldId: 'field-rohrbach',
      zoneId: 'h1',
      blocksEntireField: false,
      startsAtMs: 17.5 * 3600_000,
      endsAtMs: 18.25 * 3600_000,
    },
    [half1, half2],
  ).length > 0,
);
assert.strictEqual(findLocalFieldConflicts(half1, [otherVenue]).length, 0);

const zones = [
  { id: 'h1', name: 'Hälfte 1', blocksEntireField: false },
  { id: 'h2', name: 'Hälfte 2', blocksEntireField: false },
];
assert.strictEqual(
  fieldUtilizationInInterval({
    fieldId: 'field-rohrbach',
    startsAtMs: 17 * 3600_000,
    endsAtMs: 18.5 * 3600_000,
    zones,
    existing: [half1, half2],
  }),
  'full',
);

const free = suggestFreeZones({
  fieldId: 'field-rohrbach',
  startsAtMs: 17 * 3600_000,
  endsAtMs: 18.5 * 3600_000,
  zones,
  existing: [half1],
});
assert.strictEqual(free.entireFieldFree, false);
assert.deepStrictEqual(
  free.freeZones.map((z) => z.id),
  ['h2'],
);

assert.strictEqual(
  canManageFacilityAssignmentForEvent({
    eventTeamSeasonId: 'ts-u12',
    memberships: [{ team_season_id: 'ts-u12', role: 'trainer' }],
    clubTeamSeasonIds: ['ts-u12', 'ts-u14'],
  }),
  true,
);
assert.strictEqual(
  canManageFacilityAssignmentForEvent({
    eventTeamSeasonId: 'ts-u14',
    memberships: [{ team_season_id: 'ts-u12', role: 'trainer' }],
    clubTeamSeasonIds: ['ts-u12', 'ts-u14'],
  }),
  false,
);

console.log('platz3 facility schedule logic OK');
