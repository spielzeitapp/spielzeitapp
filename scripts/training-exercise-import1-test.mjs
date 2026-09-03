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
const migrationPdf = read('supabase/migrations/20260820193000_training_exercise_pdf_import.sql');
const migrationVisibility = read(
  'supabase/migrations/20260822220000_training_exercise_visibility_and_sketch_paths.sql',
);
const migrationShortText = read(
  'supabase/migrations/20260825143000_training_exercise_short_texts.sql',
);

assert.match(page, /PDF importieren/);
assert.doesNotMatch(page, /SpielzeitApp-Übung importieren/);
assert.match(page, /PDF-Import prüfen/);
assert.match(page, /besonders die Trainingsphase prüfen/);
assert.match(page, /Skizze hochladen/);
assert.match(page, /Skizze ersetzen/);
assert.match(page, /Skizze entfernen/);
assert.match(page, /Skizze wirklich entfernen/);
assert.match(page, /max\. 8 MB/);
assert.match(page, /DetailModal|exercise-detail-title/);
assert.match(page, /Organisation \/ Aufbau/);
assert.match(page, /Coachingpunkte/);
assert.match(page, /Variationen/);
assert.match(page, /Kurzfassung für Handout &amp; optionale Trainer-PDF/);
assert.match(page, /Prüfen & bei Bedarf KI kürzen/);
assert.match(page, /Nur für mich \(privat\)/);
assert.match(page, /Schwerpunkt filtern|Trainingsphase filtern/);
assert.match(parser, /file\.arrayBuffer\(\)/, 'PDF muss lokal im Browser gelesen werden');
assert.doesNotMatch(parser, /fetch\(/, 'Original-PDF darf nicht an einen Analyse-Service gesendet werden');
assert.match(parser, /MAX_PDF_BYTES = 15 \* 1024 \* 1024/);
assert.match(parser, /createTrainingExerciseShortText/);
assert.match(parser, /parseTrainingExercisePdfPayload/);
assert.match(parser, /importKind: 'spielzeitapp'/);
assert.match(parser, /importKind: 'external'/);
assert.match(parser, /resolveExerciseSketchColumnStart/);
assert.match(parser, /descriptionCenter \+ sketchCenter/);
assert.doesNotMatch(parser, /pageWidth \* 0\.55 \* scale/);
assert.match(parser, /collectCoachDetailLines/);
assert.match(parser, /pages\.map\(\(candidate\) => candidate\.lines\)/);
assert.match(storage, /source_type: input\.sourceType \?\? 'club'/);
assert.match(storage, /TRAINING_EXERCISE_SKETCH_MAX_BYTES = 8 \* 1024 \* 1024/);
assert.match(storage, /\$\{clubId\}\/exercises\/\$\{exerciseId\}/);
assert.match(storage, /visibility/);
assert.match(storage, /short_content/);
assert.match(migrationPdf, /'training-exercise-media'[\s\S]*false,/);
assert.match(migrationPdf, /can_manage_club_venues/);
assert.match(migrationVisibility, /visibility IN \('club', 'private'\)/);
assert.match(migrationVisibility, /split_part\(name, '\/', 2\) IN \('imports', 'exercises'\)/);
assert.match(migrationVisibility, /created_by = auth\.uid\(\)/);
assert.match(migrationShortText, /short_content text NULL/);
assert.match(migrationShortText, /short_materials text NULL/);
assert.match(migrationShortText, /short_coaching text NULL/);

const samplePaths = process.argv.slice(2);
if (samplePaths.length) {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { analyzeTrainingExercisePdf, collectCoachDetailLines, resolveExerciseSketchColumnStart } = await vite.ssrLoadModule(
      '/src/lib/trainingExercisePdfImport.ts',
    );
    assert.deepEqual(
      collectCoachDetailLines(
        [
          ['ABLAUF & BESCHREIBUNG', 'Organisation', 'Aufbau', 'Ablauf', 'AI FOOTBALL COACH · Seite 1 / 2'],
          ['Erster Teil des Ablaufs.', 'Zweiter Teil des Ablaufs.', 'Coachingpunkte', 'Offene Stellung.', 'Variationen', 'Mit zwei Bällen.'],
        ],
        0,
      ),
      ['Ablauf', 'Erster Teil des Ablaufs.', 'Zweiter Teil des Ablaufs.', 'Coachingpunkte', 'Offene Stellung.', 'Variationen', 'Mit zwei Bällen.'],
      'AI-Football-Coach-Abschnitte müssen über einen Seitenumbruch hinweg gelesen werden',
    );
    assert.equal(
      resolveExerciseSketchColumnStart(
        [
          { text: 'Beschreibung', x: 127.65, width: 62.89 },
          { text: 'Skizze', x: 431.53, width: 28.95 },
        ],
        595.4,
      ),
      302.55,
      'Skizzenspalte muss aus den beiden Spaltenüberschriften berechnet werden',
    );
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
      if (/Warm-Up mit Ball im Mittelkreis/i.test(samplePath)) {
        assert.match(draft.title, /Warm-Up mit Ball im Mittelkreis/i);
        assert.equal(draft.suitablePhases[0], 'AW');
        assert.match(draft.organization, /8 Markierungsscheiben oder Hütchen/i);
        assert.match(draft.description, /passt zu einem Mitspieler/i);
        assert.match(draft.coachingPoints, /Lautstarke Kommunikation/i);
        assert.match(draft.variations, /Mit zwei Bällen gleichzeitig spielen/i);
      }
    }
  } finally {
    await vite.close();
  }
}

console.log(`training-exercise-import1: ok${samplePaths.length ? ` (inkl. ${samplePaths.length} Beispiel-PDFs)` : ''}`);
