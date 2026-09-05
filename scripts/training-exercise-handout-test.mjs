/** Static checks for the single-exercise A4 PDF export. */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('src/manager/ManagerTrainingLibraryPage.tsx', 'utf8');
const handout = fs.readFileSync('src/lib/trainingExerciseHandout.ts', 'utf8');
const detailModal = fs.readFileSync('src/components/training/TrainingExerciseDetailModal.tsx', 'utf8');
const sessionHandout = fs.readFileSync('src/lib/trainingSessionHandout.ts', 'utf8');
const wordExport = fs.readFileSync('src/lib/trainingSessionWordExport.ts', 'utf8');

assert.match(page, /createTrainingExerciseHandoutHtml/);
assert.match(page, /Übung als PDF/);
assert.match(page, /printExercise\(row\)/);
assert.match(page, /exportingExerciseId === row\.id \? 'PDF…' : 'PDF'/);
assert.match(page, /getTrainingExerciseSketchUrl/);
assert.match(page, /contextSeason\?\.season\?\.name/);
assert.match(handout, /@page \{ size: A4 portrait/);
assert.match(handout, /Inhalte: Aufbau, Ablauf & Variationen/);
assert.match(handout, /Material/);
assert.match(handout, /Coachingpunkte/);
assert.match(handout, /resolveTrainingExerciseShortText/);
assert.match(handout, /Drucken \/ als PDF speichern/);
assert.match(handout, /players,/);
assert.doesNotMatch(handout, /\$\{players\} Spieler/);
assert.match(handout, /Video \$\{index \+ 1\} ansehen/);
assert.match(handout, /margin-top: auto/);
assert.match(handout, /font-size: 9\.2pt/);
assert.match(page, /contextSeason\?\.team\?\.age_group/);
assert.match(detailModal, /resolveTrainingExerciseShortText/);
assert.match(detailModal, /Ausführlichen Originaltext anzeigen/);
assert.match(sessionHandout, /resolveTrainingExerciseShortText/);
assert.match(wordExport, /resolveTrainingExerciseShortText/);

console.log('training-exercise-handout: ok');
