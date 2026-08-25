import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('src/manager/ManagerTrainingSessionEditorPage.tsx', 'utf8');
const library = fs.readFileSync('src/manager/ManagerTrainingLibraryPage.tsx', 'utf8');

assert.match(library, /einheiten\/neu\?exercise=/, 'library forwards the selected exercise');
assert.match(editor, /searchParams\.get\('exercise'\)/, 'editor reads the selected exercise');
assert.match(editor, /In welchen Abschnitt möchtest du diese Übung einfügen\?/, 'phase choice is shown');
assert.match(editor, /addExercise\(requestedExercise, phase\)/, 'selected exercise is added to chosen phase');
assert.match(library, /selectionPhase/, 'library receives the requested training phase');
assert.match(library, /Passende Übungen sind vorgefiltert/, 'matching exercises are clearly prefiltered');
assert.match(library, /selectForSession\(row\)/, 'library adds the chosen exercise to the session');

console.log('training-session-add-exercise: ok');
