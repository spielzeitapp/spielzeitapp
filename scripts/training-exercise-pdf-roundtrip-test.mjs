/**
 * Contract checks for automatic SpielzeitApp-PDF recognition and external PDF fallback.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const page = fs.readFileSync('src/manager/ManagerTrainingLibraryPage.tsx', 'utf8');
const handout = fs.readFileSync('src/lib/trainingExerciseHandout.ts', 'utf8');
const importer = fs.readFileSync('src/lib/trainingExercisePdfImport.ts', 'utf8');

assert.match(page, /PDF importieren/);
assert.doesNotMatch(page, /SpielzeitApp-Übung importieren/);
assert.doesNotMatch(page, />\s*Übertragen\s*</);
assert.match(handout, /createTrainingExercisePdfPayload/);
assert.match(handout, /machine-data/);
assert.match(importer, /parseTrainingExercisePdfPayload/);
assert.match(importer, /extractSpielzeitAppSketch/);
assert.match(importer, /importKind: 'spielzeitapp'/);
assert.match(importer, /importKind: 'external'/);

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const payloadModule = await vite.ssrLoadModule('/src/lib/trainingExercisePdfPayload.ts');
  const exercise = {
    id: 'exercise-1', club_id: 'club-1', team_id: null,
    title: 'Passspiel mit Umschalten', description: 'Exakte Beschreibung\nmit zweiter Zeile.',
    focus: 'passspiel', suitable_phases: ['HT1', 'HT2'], age_group: 'U12', duration_minutes: 18,
    player_count_min: 8, player_count_max: 12, difficulty: 'hard', materials: '8 Bälle, 12 Hütchen',
    organization: 'Feld 20 × 25 Meter', coaching_points: 'Vororientierung\nPassschärfe',
    variations: 'Mit zwei Kontakten', short_content: 'Kurzer Inhalt', short_materials: 'Bälle, Hütchen',
    short_coaching: 'Vororientierung', image_path: 'club-1/exercises/exercise-1/sketch.webp',
    source_type: 'club', source_reference: '', visibility: 'club', created_by: null, is_active: true,
  };
  const encoded = payloadModule.createTrainingExercisePdfPayload(exercise);
  const decoded = payloadModule.parseTrainingExercisePdfPayload(`Kopfzeile\n${encoded}\nFußzeile`);
  assert.equal(decoded.title, exercise.title);
  assert.equal(decoded.description, exercise.description);
  assert.deepEqual(decoded.suitablePhases, exercise.suitable_phases);
  assert.equal(decoded.durationMinutes, exercise.duration_minutes);
  assert.equal(decoded.playerCountMin, '8');
  assert.equal(decoded.playerCountMax, '12');
  assert.equal(decoded.difficulty, 'hard');
  assert.equal(decoded.coachingPoints, exercise.coaching_points);
  assert.equal(decoded.hasSketch, true);
  assert.equal(payloadModule.parseTrainingExercisePdfPayload('Externe Trainings-PDF'), null);
} finally {
  await vite.close();
}

console.log('training-exercise-pdf-roundtrip: ok');
