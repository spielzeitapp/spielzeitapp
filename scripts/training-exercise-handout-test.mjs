/** Static checks for the single-exercise A4 PDF export. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('src/manager/ManagerTrainingLibraryPage.tsx', 'utf8');
const handout = fs.readFileSync('src/lib/trainingExerciseHandout.ts', 'utf8');

assert.match(page, /createTrainingExerciseHandoutHtml/);
assert.match(page, /Übung als PDF/);
assert.match(page, /getTrainingExerciseSketchUrl/);
assert.match(page, /contextSeason\?\.season\?\.name/);
assert.match(handout, /@page \{ size: A4 portrait/);
assert.match(handout, /Organisation & Aufbau/);
assert.match(handout, /Ablauf/);
assert.match(handout, /Material/);
assert.match(handout, /Coachingpunkte/);
assert.match(handout, /Variationen/);
assert.match(handout, /Drucken \/ als PDF speichern/);

console.log('training-exercise-handout: ok');
