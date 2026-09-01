/**
 * Static contract checks for lossless SpielzeitApp exercise transfer packages.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const packageModule = read('src/lib/trainingExercisePackage.ts');
const page = read('src/manager/ManagerTrainingLibraryPage.tsx');

// Stable, versioned archive contract with bounded input sizes.
assert.match(packageModule, /spielzeitapp\.training-exercise/);
assert.match(packageModule, /PACKAGE_VERSION = 1/);
assert.match(packageModule, /\.spielzeit-uebung/);
assert.match(packageModule, /manifest\.json/);
assert.match(packageModule, /sketch\.webp/);
assert.match(packageModule, /MAX_PACKAGE_BYTES/);
assert.match(packageModule, /MAX_SKETCH_BYTES/);
assert.match(packageModule, /zipSync/);
assert.match(packageModule, /unzipSync/);
assert.match(packageModule, /raw\.format !== PACKAGE_FORMAT/);
assert.match(packageModule, /raw\.version !== PACKAGE_VERSION/);
assert.match(packageModule, /validFocus/);

// Every editable exercise field is represented in the package draft.
for (const field of [
  'title',
  'description',
  'focus',
  'suitablePhases',
  'ageGroup',
  'durationMinutes',
  'playerCountMin',
  'playerCountMax',
  'difficulty',
  'materials',
  'organization',
  'coachingPoints',
  'variations',
  'shortContent',
  'shortMaterials',
  'shortCoaching',
  'sourceType',
  'sourceReference',
  'visibility',
  'sketch',
]) {
  assert.match(packageModule, new RegExp(`\\b${field}\\b`), `${field} missing from package contract`);
}

// Native packages are additive; external PDF import remains available.
assert.match(page, /createTrainingExercisePackage/);
assert.match(page, /parseTrainingExercisePackage/);
assert.match(page, /Übungspaket importieren/);
assert.match(page, /Übungspaket prüfen/);
assert.match(page, /Paket wird erstellt/);
assert.match(page, /PDF importieren/);
assert.match(page, /analyzeTrainingExercisePdf/);

console.log('training-exercise-package: ok');
