import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('src/manager/ManagerTrainingSessionEditorPage.tsx', 'utf8');
const library = fs.readFileSync('src/manager/ManagerTrainingLibraryPage.tsx', 'utf8');

assert.match(library, /einheiten\/neu\?exercise=/, 'library forwards the selected exercise');
assert.match(editor, /searchParams\.get\('exercise'\)/, 'editor reads the selected exercise');
assert.match(editor, /In welchen Abschnitt möchtest du diese Übung einfügen\?/, 'phase choice is shown');
assert.match(editor, /addExercise\(requestedExercise, phase\)/, 'selected exercise is added to chosen phase');
assert.doesNotMatch(
  editor,
  /if \(!ex\.suitable_phases\.includes\(pickerPhase\)\) return false/,
  'recommended phases do not hide exercises from the picker',
);
assert.match(editor, /Für diese Phase empfohlen/, 'recommended exercises remain clearly marked');

console.log('training-session-add-exercise: ok');
