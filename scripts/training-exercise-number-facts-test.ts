import assert from 'node:assert/strict';
import {
  extractQuantityFacts,
  numericFactContradictions,
} from '../supabase/functions/shorten-training-exercise/numericFactGuard.ts';

const stationSource = [
  'Pro Station können 4-6 Spieler üben.',
  'Zwei Markierungsscheiben in einem vertikalen Abstand von ca. 10 Meter aufbauen.',
  'B läuft nach dem ersten Klatschball zur Hürde und überspringt sie mit drei Sprüngen.',
].join(' ');

assert.deepEqual(
  numericFactContradictions(
    stationSource,
    'Pro Station zwei Markierungsscheiben im Abstand von 10 m, je 2 Spieler.',
  ),
  ['Zahlenwiderspruch bei Spieler: Kurzfassung 2, Original 4-6'],
);

assert.deepEqual(
  numericFactContradictions(
    stationSource,
    'Pro Station üben 4–6 Spieler. Zwei Markierungsscheiben stehen 10 Meter auseinander. Drei Sprünge über die Hürde.',
  ),
  [],
);

const gameSource = [
  '2 Mannschaften spielen im 2vs2. Die beiden anderen Spieler sind neutral.',
  'Der Anspieler hat zwei Kontakte. Das Feld ist 28 Meter breit.',
].join(' ');

assert.deepEqual(
  numericFactContradictions(
    gameSource,
    'Zwei Teams spielen 2vs2 mit 2 neutralen Spielern. Der Anspieler hat 2 Kontakte. Das Feld ist 28 m breit.',
  ),
  [],
);

assert.deepEqual(
  extractQuantityFacts('vier bis sechs Spieler und zwei Markierungsscheiben'),
  [
    { subject: 'Spieler', value: '4-6' },
    { subject: 'Markierungsscheiben', value: '2' },
  ],
);

console.log('training-exercise-number-facts: ok');
