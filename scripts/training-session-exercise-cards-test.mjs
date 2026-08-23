import assert from 'node:assert/strict';
import fs from 'node:fs';

const editor = fs.readFileSync('src/manager/ManagerTrainingSessionEditorPage.tsx', 'utf8');
const library = fs.readFileSync('src/manager/ManagerTrainingLibraryPage.tsx', 'utf8');
const card = fs.readFileSync('src/components/training/TrainingSessionExerciseCard.tsx', 'utf8');
const detail = fs.readFileSync('src/components/training/TrainingExerciseDetailModal.tsx', 'utf8');
const sessions = fs.readFileSync('src/lib/trainingSessions.ts', 'utf8');

assert.match(editor, /TrainingSessionExerciseCard/, 'editor uses compact exercise cards');
assert.match(editor, /TrainingExerciseDetailModal/, 'editor reuses shared exercise detail modal');
assert.match(editor, /onView=\{\(\) => setDetailItemId\(it\.id\)\}/, 'card view action is wired');
assert.match(editor, /openReplacePicker\(it\)/, 'replace flow is wired');
assert.match(editor, /replaceExercise\(/, 'replaceExercise handler exists');
assert.match(editor, /Training ansehen/, 'training view button label present');
assert.doesNotMatch(
  editor,
  /Training ansehen[\s\S]{0,120}md:hidden/,
  'training view button is not mobile-only',
);
assert.doesNotMatch(
  editor,
  /fixed inset-0 z-50 flex flex-col bg-white md:hidden/,
  'training view overlay works on desktop too',
);

assert.match(library, /TrainingExerciseDetailModal/, 'library uses shared detail modal');
assert.doesNotMatch(library, /function DetailModal\(/, 'library no longer defines a duplicate detail modal');

assert.match(card, /TrainingExerciseImage/, 'card shows sketch preview');
assert.match(card, /onView/, 'card exposes view action');
assert.match(card, /onReplace/, 'card exposes replace action');
assert.match(card, /Trainerhinweise/, 'coach notes section exists');

assert.match(detail, /Organisation \/ Aufbau/, 'detail shows organization');
assert.match(detail, /Ablauf/, 'detail shows flow section');
assert.match(detail, /Video ansehen/, 'detail supports video link');

assert.match(sessions, /exerciseId\?: string/, 'session exercise replace updates exercise_id');

console.log('training-session-exercise-cards: ok');
