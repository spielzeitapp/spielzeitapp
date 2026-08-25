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
assert.match(editor, /onEdit=\{\(\) => openExerciseEditor\(it\)\}/, 'card edit action opens the exact library exercise');
assert.match(editor, /edit: item\.exercise_id/, 'exercise editor deep link contains the exercise id');
assert.match(editor, /Praxisnotiz für diese Einheit/, 'training view exposes a session-only practice note');
assert.match(editor, /changeNotes\(it, event\.target\.value\)/, 'training view persists the practice note');
assert.match(editor, /openReplacePicker\(it\)/, 'replace flow is wired');
assert.match(library, /replaceItemId/, 'library handles the selected exercise replacement');
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

assert.match(card, /variant="session-card"/, 'card uses large session-card sketch variant');
assert.match(card, /md:grid-cols-\[minmax\(280px,340px\)_minmax\(0,1fr\)\]/, 'desktop card uses sketch + content grid');
assert.match(card, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/, 'mobile actions respect safe area');
assert.match(card, /grid-cols-2/, 'mobile actions wrap into two safe columns without overflow');
assert.match(card, />\s*Bearbeiten\s*</, 'card has a direct edit action');
assert.match(card, /Praxisnotiz/, 'card has a direct practice-note action');

const image = fs.readFileSync('src/components/training/TrainingExerciseImage.tsx', 'utf8');
assert.match(image, /variant\?: TrainingExerciseImageVariant/, 'image component supports variants');
assert.match(image, /'session-card'/, 'session-card variant defined');
assert.match(image, /aspect-video/, 'session-card uses wide aspect ratio on mobile');
assert.match(image, /min-h-\[210px\]/, 'session-card has minimum visible height');
assert.match(image, /min-w-\[280px\]/, 'session-card desktop preview is wide enough');
assert.match(image, /'library'/, 'library variant defined');
assert.match(image, /'detail'/, 'detail variant defined');
assert.match(image, /object-contain/, 'all variants use object-contain');

assert.match(library, /variant="library"/, 'library uses library image variant');
assert.match(library, /const editExerciseId = searchParams\.get\('edit'\)/, 'library accepts a direct edit link');
assert.match(library, /navigate\(returnAfterSave\)/, 'library returns to the training plan after saving');
assert.match(detail, /variant="detail"/, 'detail modal uses detail image variant');

assert.match(detail, /Organisation \/ Aufbau/, 'detail shows organization');
assert.match(detail, /Ablauf/, 'detail shows flow section');
assert.match(detail, /Video ansehen/, 'detail supports video link');

assert.match(sessions, /exerciseId\?: string/, 'session exercise replace updates exercise_id');

console.log('training-session-exercise-cards: ok');
