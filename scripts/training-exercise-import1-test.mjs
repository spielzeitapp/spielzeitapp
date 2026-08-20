import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

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

const samplePath = process.env.TRAINING_IMPORT_SAMPLE_PDF;
if (samplePath) {
  const data = new Uint8Array(fs.readFileSync(samplePath));
  const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const pageProxy = await pdf.getPage(pageNumber);
    const content = await pageProxy.getTextContent();
    pages.push(content.items.flatMap((item) => ('str' in item ? [item.str] : [])).join(' '));
  }
  const text = pages.join('\n').replace(/\s+/g, ' ');
  assert.match(text, /1\. Kontakt/);
  assert.match(text, /Beschreibung/);
  assert.match(text, /Coachingpunkte/);
  assert.match(text, /Spieler_innenanzahl:\s*4\s*-\s*20/);
  assert.match(text, /youtu\.be\/O8ZUBbX0WJg/);
}

console.log(`training-exercise-import1: ok${samplePath ? ' (inkl. Beispiel-PDF)' : ''}`);
