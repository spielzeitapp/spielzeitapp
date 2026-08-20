import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createServer } from 'vite';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const page = read('src/manager/ManagerTrainingLibraryPage.tsx');
const parser = read('src/lib/trainingExercisePdfImport.ts');
const storage = read('src/lib/trainingExercises.ts');
const migration = read('supabase/migrations/20260820193000_training_exercise_pdf_import.sql');

assert.match(page, /PDF importieren/);
assert.match(page, /PDF-Import prüfen/);
assert.match(page, /besonders die Trainingsphase prüfen/);
assert.match(parser, /file\.arrayBuffer\(\)/, 'PDF muss lokal im Browser gelesen werden');
assert.doesNotMatch(parser, /fetch\(/, 'Original-PDF darf nicht an einen Analyse-Service gesendet werden');
assert.match(parser, /MAX_PDF_BYTES = 15 \* 1024 \* 1024/);
assert.match(storage, /source_type: input\.sourceType \?\? 'club'/);
assert.match(migration, /'training-exercise-media'[\s\S]*false,/);
assert.match(migration, /can_manage_club_venues/);

const samplePaths = process.argv.slice(2);
if (samplePaths.length) {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { analyzeTrainingExercisePdf } = await vite.ssrLoadModule('/src/lib/trainingExercisePdfImport.ts');
    for (const samplePath of samplePaths) {
      const bytes = fs.readFileSync(samplePath);
      const file = new File([bytes], path.basename(samplePath), { type: 'application/pdf' });
      const draft = await analyzeTrainingExercisePdf(file);
      assert.ok(draft.title.length >= 3, `${path.basename(samplePath)}: title`);
      assert.ok(draft.description.length >= 20, `${path.basename(samplePath)}: description`);
      assert.ok(draft.coachingPoints.length >= 10, `${path.basename(samplePath)}: coaching points`);
      if (/Karteikarte 17/.test(samplePath)) {
        assert.equal(draft.title, 'schneller & weiter');
        assert.equal(draft.playerCountMin, '10');
        assert.match(draft.materials, /Ringe: 2\s*-\s*4/);
      }
      if (/5vs5\+3/.test(samplePath)) {
        assert.match(draft.title, /5vs5 \+ 3/);
        assert.equal(draft.suitablePhases[0], 'AK');
        assert.equal(draft.playerCountMin, '13');
        assert.match(draft.organization, /20 x 25 Meter/);
        assert.match(draft.variations, /10 Ballkontakte/);
      }
    }
  } finally {
    await vite.close();
  }
}

console.log(`training-exercise-import1: ok${samplePaths.length ? ` (inkl. ${samplePaths.length} Beispiel-PDFs)` : ''}`);
