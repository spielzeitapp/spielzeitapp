/**
 * Minimal duration helpers test for STEP 3A (no jest required).
 */
import assert from 'assert';

const PHASES = ['AW', 'HT1', 'HT2', 'AK'];
function isTrainingPhase(v) {
  return PHASES.includes(v);
}
function sumPhaseMinutes(items) {
  const out = { AW: 0, HT1: 0, HT2: 0, AK: 0 };
  for (const row of items) {
    if (isTrainingPhase(row.phase)) out[row.phase] += Math.max(0, row.duration_minutes || 0);
  }
  return out;
}
function totalSessionMinutes(items) {
  return items.reduce((acc, row) => acc + Math.max(0, row.duration_minutes || 0), 0);
}

assert.strictEqual(isTrainingPhase('AW'), true);
assert.strictEqual(isTrainingPhase('XX'), false);

const items = [
  { phase: 'AW', duration_minutes: 15 },
  { phase: 'HT1', duration_minutes: 20 },
  { phase: 'HT2', duration_minutes: 25 },
  { phase: 'AK', duration_minutes: 20 },
];

const byPhase = sumPhaseMinutes(items);
assert.strictEqual(byPhase.AW, 15);
assert.strictEqual(byPhase.HT1, 20);
assert.strictEqual(byPhase.HT2, 25);
assert.strictEqual(byPhase.AK, 20);
assert.strictEqual(totalSessionMinutes(items), 80);

console.log('trainingPhases helpers OK');
