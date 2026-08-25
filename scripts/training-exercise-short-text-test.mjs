import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { createTrainingExerciseShortText, TRAINING_SHORT_TEXT_LIMITS } = await vite.ssrLoadModule(
    '/src/lib/trainingExerciseShortText.ts',
  );
  const result = createTrainingExerciseShortText({
    description:
      'Spieler A passt zu Spieler B. Spieler B nimmt den Ball in Spielrichtung mit. Danach erfolgt der Abschluss auf das Tor. Anschließend wechseln beide Spieler ihre Position.',
    organization: 'Feld 20 x 25 Meter mit zwei Toren aufbauen.',
    materials: '8 Bälle, 12 Hütchen, 8 Bälle, 2 Tore',
    coachingPoints:
      'Offene Stellung einnehmen. Erster Kontakt in Spielrichtung. Nach dem Pass sofort freilaufen. Hohes Tempo einfordern.',
    variations: 'Mit maximal zwei Kontakten spielen.',
  });

  assert.match(result.content, /^Aufbau:/);
  assert.match(result.content, /^Start:/m);
  assert.match(result.content, /^Ablauf:/m);
  assert.ok(!/^•/m.test(result.content));
  assert.match(result.content, /Spieler A passt zu Spieler B/);
  assert.match(result.coaching, /^• Offene Stellung/m);
  assert.match(result.coaching, /Variation:/);
  assert.equal((result.materials.match(/8 Bälle/g) ?? []).length, 1);
  assert.ok(result.content.length <= TRAINING_SHORT_TEXT_LIMITS.content);
  assert.ok(result.materials.length <= TRAINING_SHORT_TEXT_LIMITS.materials);
  assert.ok(result.coaching.length <= TRAINING_SHORT_TEXT_LIMITS.coaching);
  assert.ok(!/https?:\/\//.test(`${result.content}${result.coaching}`));
  assert.ok(!/…|\.\.\./.test(`${result.content}${result.materials}${result.coaching}`));
  assert.deepEqual(TRAINING_SHORT_TEXT_LIMITS, { content: 300, materials: 100, coaching: 250 });

  const realistic = createTrainingExerciseShortText({
    organization: 'Ein ca. 15 x 30 Meter großes Spielfeld mit zwei Toren aufbauen.',
    description:
      'Spieler B startet die Aktion, indem er von der Markierungsscheibe in Richtung Spieler A zwischen die Dummies läuft. B erhält ein Zuspiel von A, welches er zwischen den Dummies direkt wieder zurückspielt.',
    materials: 'Bälle, Hütchen, zwei Tore',
    coachingPoints:
      'Die Mannschaften treten im Wettkampf gegeneinander an: Welches Team erzielt in einem Zeitabschnitt die meisten Treffer? Nach dem Pass sofort freilaufen.',
    variations: 'Die Positionen B und C an den Dummies einfach ohne Ball besetzen.',
  });

  assert.match(realistic.content, /Aufbau: Ein etwa 15 x 30 Meter/);
  assert.match(realistic.content, /Spieler B startet die Aktion/);
  for (const line of `${realistic.content}\n${realistic.coaching}`.split('\n').filter(Boolean)) {
    assert.doesNotMatch(
      line,
      /\b(?:und|oder|mit|in|auf|für|von|zu|nach|vor|bei|durch|der|die|das|den|dem|einem|einer)$/i,
    );
  }
} finally {
  await vite.close();
}

console.log('training-exercise-short-text: ok');
