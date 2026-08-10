/**
 * PLATZ.4 – räumliche Flächenkonflikte (selbstständig, ohne TS-Import).
 * Spiegelt die Unit-Square-Logik aus src/lib/fieldZoneGeometry.ts.
 */
import assert from 'assert';

function rectsOverlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function intervalsOverlapHalfOpen(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

const PRESETS = {
  entire: { id: 'entire', blocks: true, rect: { x: 0, y: 0, w: 1, h: 1 } },
  half_a: { id: 'half_a', blocks: false, rect: { x: 0, y: 0, w: 0.5, h: 1 } },
  half_b: { id: 'half_b', blocks: false, rect: { x: 0.5, y: 0, w: 0.5, h: 1 } },
  third_a: { id: 'third_a', blocks: false, rect: { x: 0, y: 0, w: 1 / 3, h: 1 } },
  third_b: { id: 'third_b', blocks: false, rect: { x: 1 / 3, y: 0, w: 1 / 3, h: 1 } },
  third_c: { id: 'third_c', blocks: false, rect: { x: 2 / 3, y: 0, w: 1 / 3, h: 1 } },
  quarter_a: { id: 'quarter_a', blocks: false, rect: { x: 0, y: 0, w: 0.5, h: 0.5 } },
  quarter_b: { id: 'quarter_b', blocks: false, rect: { x: 0.5, y: 0, w: 0.5, h: 0.5 } },
  quarter_c: { id: 'quarter_c', blocks: false, rect: { x: 0, y: 0.5, w: 0.5, h: 0.5 } },
  quarter_d: { id: 'quarter_d', blocks: false, rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
};

function spatialConflict(a, b) {
  if (a.blocks || b.blocks) return true;
  return rectsOverlap(a.rect, b.rect);
}

function findConflicts(candidate, existing) {
  return existing.filter((row) => {
    if (row.id === candidate.id) return false;
    if (row.fieldId !== candidate.fieldId) return false;
    if (!intervalsOverlapHalfOpen(candidate.startsAtMs, candidate.endsAtMs, row.startsAtMs, row.endsAtMs)) {
      return false;
    }
    return spatialConflict(candidate.zone, row.zone);
  });
}

const t0 = 17 * 3600_000;
const t1 = 18.5 * 3600_000;

assert.strictEqual(intervalsOverlapHalfOpen(0, 100, 100, 200), false);
assert.strictEqual(rectsOverlap(PRESETS.half_a.rect, PRESETS.half_b.rect), false);
assert.ok(rectsOverlap(PRESETS.half_a.rect, PRESETS.quarter_a.rect));
assert.strictEqual(rectsOverlap(PRESETS.half_a.rect, PRESETS.quarter_b.rect), false);

const u12 = {
  id: 'a1',
  fieldId: 'haupt',
  startsAtMs: t0,
  endsAtMs: t1,
  zone: PRESETS.half_a,
};
const u14 = {
  id: 'a2',
  fieldId: 'haupt',
  startsAtMs: t0,
  endsAtMs: t1,
  zone: PRESETS.half_b,
};
const u10 = {
  id: 'a3',
  fieldId: 'training',
  startsAtMs: t0,
  endsAtMs: t1,
  zone: PRESETS.entire,
};

assert.strictEqual(findConflicts(u12, [u14]).length, 0);
assert.strictEqual(findConflicts(u12, [u10]).length, 0);

const u9 = {
  id: 'a4',
  fieldId: 'haupt',
  startsAtMs: 17.5 * 3600_000,
  endsAtMs: 18.25 * 3600_000,
  zone: PRESETS.quarter_a,
};
assert.ok(findConflicts(u9, [u12, u14]).length > 0);

assert.strictEqual(
  findConflicts(
    { id: 'd1', fieldId: 'haupt', startsAtMs: t0, endsAtMs: t1, zone: PRESETS.third_a },
    [
      { id: 'd2', fieldId: 'haupt', startsAtMs: t0, endsAtMs: t1, zone: PRESETS.third_b },
      { id: 'd3', fieldId: 'haupt', startsAtMs: t0, endsAtMs: t1, zone: PRESETS.third_c },
    ],
  ).length,
  0,
);

assert.strictEqual(
  findConflicts(
    { id: 'qB', fieldId: 'haupt', startsAtMs: t0, endsAtMs: t1, zone: PRESETS.quarter_b },
    [u12],
  ).length,
  0,
);

assert.strictEqual(
  findConflicts(
    {
      id: 'later',
      fieldId: 'haupt',
      startsAtMs: t1,
      endsAtMs: t1 + 3600_000,
      zone: PRESETS.half_a,
    },
    [u12],
  ).length,
  0,
);

assert.ok(findConflicts({ id: 'full', fieldId: 'haupt', startsAtMs: t0, endsAtMs: t1, zone: PRESETS.entire }, [u12]).length > 0);

assert.strictEqual(Object.keys(PRESETS).length, 10);

console.log('platz4-field-geometry-test: OK');
