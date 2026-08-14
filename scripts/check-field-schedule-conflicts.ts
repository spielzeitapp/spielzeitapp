/**
 * Lightweight conflict-rule checks (no test runner in package.json).
 * Run: npx tsx scripts/check-field-schedule-conflicts.ts
 */
import {
  findLocalFieldConflicts,
  intervalsOverlapHalfOpen,
  zonesConflict,
} from '../src/lib/fieldScheduleConflicts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Half-open: touching edges OK
assert(!intervalsOverlapHalfOpen(0, 100, 100, 200), 'touching edges must not overlap');
assert(intervalsOverlapHalfOpen(0, 101, 100, 200), 'overlapping must conflict');

// Zones: halves OK, entire blocks halves
assert(
  !zonesConflict(
    { zoneId: 'north', blocksEntireField: false },
    { zoneId: 'south', blocksEntireField: false },
  ),
  'different zones OK',
);
assert(
  zonesConflict(
    { zoneId: null, blocksEntireField: true },
    { zoneId: 'north', blocksEntireField: false },
  ),
  'entire vs zone conflict',
);
assert(
  zonesConflict(
    { zoneId: 'north', blocksEntireField: false },
    { zoneId: 'north', blocksEntireField: false },
  ),
  'same zone conflict',
);

const existing = [
  {
    id: 'a1',
    fieldId: 'f1',
    zoneId: 'north',
    blocksEntireField: false,
    startsAtMs: 1000,
    endsAtMs: 2000,
  },
  {
    id: 'a2',
    fieldId: 'f1',
    zoneId: 'south',
    blocksEntireField: false,
    startsAtMs: 1000,
    endsAtMs: 2000,
  },
];

assert(
  findLocalFieldConflicts(
    {
      id: 'new',
      fieldId: 'f1',
      zoneId: 'north',
      blocksEntireField: false,
      startsAtMs: 1500,
      endsAtMs: 2500,
    },
    existing,
  ).length === 1,
  'same half overlap',
);

assert(
  findLocalFieldConflicts(
    {
      id: 'new',
      fieldId: 'f1',
      zoneId: null,
      blocksEntireField: true,
      startsAtMs: 1500,
      endsAtMs: 2500,
    },
    existing,
  ).length === 2,
  'entire field vs both halves',
);

assert(
  findLocalFieldConflicts(
    {
      id: 'new',
      fieldId: 'f1',
      zoneId: 'south',
      blocksEntireField: false,
      startsAtMs: 2000,
      endsAtMs: 3000,
    },
    existing,
  ).length === 0,
  'adjacent south OK',
);

console.log('fieldScheduleConflicts checks OK');
