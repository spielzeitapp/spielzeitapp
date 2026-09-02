/**
 * Static checks for training library sketch UX + visibility (no live Supabase).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const page = read('src/manager/ManagerTrainingLibraryPage.tsx');
const lib = read('src/lib/trainingExercises.ts');
const migration = read(
  'supabase/migrations/20260822220000_training_exercise_visibility_and_sketch_paths.sql',
);

// Sketch validation
assert.match(page, /TRAINING_EXERCISE_SKETCH_MAX_BYTES/);
assert.match(page, /image\\?\/\(png\|jpeg\|webp\)/);
assert.match(page, /Skizze wird verarbeitet/);
assert.doesNotMatch(page, /10 \* 1024 \* 1024/);

// Detail + cards
assert.match(page, /openDetail/);
assert.match(page, /Kurzbeschreibung/);
assert.match(page, /Zur Einheit/);
assert.match(page, /Archivieren/);
assert.match(page, /Bearbeiten/);

// Visibility UI + storage path
assert.match(page, /visibility: form\.visibility/);
assert.match(lib, /buildTrainingExerciseSketchPath/);
assert.match(lib, /\$\{clubId\}\/exercises\/\$\{exerciseId\}/);
assert.match(migration, /visibility = 'club'/);
assert.match(migration, /OR created_by = auth\.uid\(\)/);
assert.doesNotMatch(lib, /atob\(|btoa\(|data:image/);

// 4:3 crop can also shrink an image and add neutral margins.
assert.match(page, /Bildgröße \/ Zoom/);
assert.match(page, /min=\{40\} max=\{250\}/);
assert.match(page, /canvas\.width = 1600/);
assert.match(page, /canvas\.height = 1200/);
assert.match(page, /fillStyle = '#ffffff'/);
assert.match(page, /Math\.min\(canvas\.width \/ rotated\.width, canvas\.height \/ rotated\.height\) \* options\.zoom/);
assert.doesNotMatch(page, /Math\.max\(canvas\.width \/ rotated\.width, canvas\.height \/ rotated\.height\) \* options\.zoom/);
assert.match(page, /Bei 100 % bleibt die vollständige Skizze sichtbar/);

// Local white-to-grass background unification in crop dialog
assert.match(page, /Weißen Hintergrund durch Rasen ersetzen/);
assert.match(page, /function removeWhiteBackground/);
assert.match(page, /function drawTrainingGrass/);
assert.match(page, />\s*Original\s*</);
assert.match(page, /'Mit Rasen'/);
assert.match(page, /threshold = 252 - Math\.round\(\(clamped \/ 100\) \* 72\)/);
assert.match(page, /colorTolerance = 22 \+ Math\.round\(\(clamped \/ 100\) \* 50\)/);
assert.match(page, /max - min <= colorTolerance/);
assert.match(page, /#66ad55/);
assert.match(page, /#80bd6f/);
assert.match(page, /replaceWhiteWithGrass/);

// Existing green sketches can be normalized to one dominant grass colour.
assert.match(page, /Gesamten Rasen vereinheitlichen/);
assert.match(page, /Grün-Erkennung/);
assert.match(page, /function unifyGrassBackground/);
assert.match(page, /function isLikelyGrassPixel/);
assert.match(page, /unifyGrass: cropUnifyGrass/);
assert.match(page, /Einfarbig grün/);
assert.match(page, /dominantBins/);

// Position controls also work when zoom is below 100% and the image is smaller than the canvas.
assert.match(page, /movementX = Math\.abs\(width - canvas\.width\) \/ 2/);
assert.match(page, /movementY = Math\.abs\(height - canvas\.height\) \/ 2/);
assert.doesNotMatch(page, /overflowX = Math\.max\(0, width - canvas\.width\)/);

console.log('training-library-sketch-ux: ok');
