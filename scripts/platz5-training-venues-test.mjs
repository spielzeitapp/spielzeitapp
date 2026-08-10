/**
 * PLATZ.5 – Trainingsanlagen-Zuordnung (ohne DB).
 * Default purpose = training (PLATZ.6-kompatibel).
 */
import assert from 'assert';

function isTrainingVenueAllowedClient(allowedVenueIds, venueId) {
  if (!venueId) return false;
  return allowedVenueIds.includes(venueId);
}

function defaultPurpose(purpose) {
  return purpose ?? 'training';
}

const allowed = ['rohrbach', 'stveit'];
assert.strictEqual(isTrainingVenueAllowedClient(allowed, 'rohrbach'), true);
assert.strictEqual(isTrainingVenueAllowedClient(allowed, 'loosdorf'), false);
assert.strictEqual(isTrainingVenueAllowedClient(allowed, null), false);
assert.strictEqual(isTrainingVenueAllowedClient([], 'rohrbach'), false);
assert.ok(allowed.length >= 2);
assert.strictEqual(new Set(['a', 'a', 'b']).size, 2);
assert.strictEqual(defaultPurpose(undefined), 'training');
assert.strictEqual(defaultPurpose('home_match'), 'home_match');

console.log('platz5-training-venues-test: OK');
