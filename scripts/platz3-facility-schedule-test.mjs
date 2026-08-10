/**
 * PLATZ.3 – Konflikt- und Rechte-Logik (ohne DB).
 */
import assert from 'assert';
import {
  intervalsOverlapHalfOpen,
  zonesConflict,
  findLocalFieldConflicts,
  suggestFreeZones,
  fieldUtilizationInInterval,
  canManageFacilityAssignmentForEvent,
} from '../src/lib/fieldScheduleConflicts.ts';

// Angrenzende Zeiten erlaubt
assert.strictEqual(intervalsOverlapHalfOpen(0, 100, 100, 200), false);
assert.strictEqual(intervalsOverlapHalfOpen(0, 100, 99, 200), true);

// Hälften vs. Ganzplatz
assert.strictEqual(
  zonesConflict({ zoneId: 'h1', blocksEntireField: false }, { zoneId: 'h2', blocksEntireField: false }),
  false,
);
assert.strictEqual(
  zonesConflict({ zoneId: 'h1', blocksEntireField: false }, { zoneId: null, blocksEntireField: true }),
  true,
);
assert.strictEqual(
  zonesConflict({ zoneId: 'h1', blocksEntireField: false }, { zoneId: 'h1', blocksEntireField: false }),
  true,
);

const half1 = {
  id: 'a1',
  fieldId: 'field-rohrbach',
  zoneId: 'h1',
  blocksEntireField: false,
  startsAtMs: 17 * 3600_000,
  endsAtMs: 18.5 * 3600_000,
  label: 'U12',
};
const half2 = {
  id: 'a2',
  fieldId: 'field-rohrbach',
  zoneId: 'h2',
  blocksEntireField: false,
  startsAtMs: 17 * 3600_000,
  endsAtMs: 18.5 * 3600_000,
  label: 'U14',
};
const otherVenue = {
  id: 'a3',
  fieldId: 'field-stveit',
  zoneId: null,
  blocksEntireField: true,
  startsAtMs: 17 * 3600_000,
  endsAtMs: 18.5 * 3600_000,
  label: 'U12 St.Veit',
};

// Szenario A: zwei Hälften OK
assert.strictEqual(findLocalFieldConflicts(half1, [half2]).length, 0);

// Szenario B: dritte Belegung kollidiert
const third = {
  id: 'a4',
  fieldId: 'field-rohrbach',
  zoneId: 'h1',
  blocksEntireField: false,
  startsAtMs: 17.5 * 3600_000,
  endsAtMs: 18.25 * 3600_000,
};
assert.ok(findLocalFieldConflicts(third, [half1, half2]).length > 0);

const full = {
  id: 'a5',
  fieldId: 'field-stveit',
  zoneId: null,
  blocksEntireField: true,
  startsAtMs: 10 * 3600_000,
  endsAtMs: 12 * 3600_000,
};
const halfAgainstFull = {
  id: 'a6',
  fieldId: 'field-stveit',
  zoneId: 'h1',
  blocksEntireField: false,
  startsAtMs: 11 * 3600_000,
  endsAtMs: 12 * 3600_000,
};
// Szenario C
assert.ok(findLocalFieldConflicts(halfAgainstFull, [full]).length > 0);

// Szenario D: andere Sportanlage/Platz = kein Konflikt
assert.strictEqual(findLocalFieldConflicts(half1, [otherVenue]).length, 0);

const zones = [
  { id: 'h1', name: 'Hälfte 1', blocksEntireField: false },
  { id: 'h2', name: 'Hälfte 2', blocksEntireField: false },
];

// Auslastung: beide Hälften = full
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

// Rechte
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
assert.strictEqual(
  canManageFacilityAssignmentForEvent({
    eventTeamSeasonId: 'ts-u14',
    memberships: [{ team_season_id: 'ts-u12', role: 'admin' }],
    clubTeamSeasonIds: ['ts-u12', 'ts-u14'],
  }),
  true,
);

console.log('platz3 facility schedule logic OK');
