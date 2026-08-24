import fs from 'node:fs';

const panel = fs.readFileSync('src/manager/ManagerTrainingExamPanel.tsx', 'utf8');
const pdf = fs.readFileSync('src/lib/trainingExamPdfExport.ts', 'utf8');
const data = fs.readFileSync('src/lib/trainingExamDocumentation.ts', 'utf8');
const sessions = fs.readFileSync('src/manager/ManagerTrainingSessionsPage.tsx', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20260824210000_training_exam_documentations.sql',
  'utf8',
);
const editableMigration = fs.readFileSync(
  'supabase/migrations/20260824223000_training_exam_editable_pdf_fields.sql',
  'utf8',
);

const checks = [
  [sessions.includes("setMainTab('exam')"), 'Trainerprüfung-Tab fehlt'],
  [sessions.includes('<ManagerTrainingExamPanel'), 'Trainerprüfung-Panel fehlt'],
  [panel.includes('PDF-Vorschau'), 'Vorschau-Aktion fehlt'],
  [panel.includes('Gesamtdokumentation herunterladen'), 'Sammeldownload fehlt'],
  [panel.includes('Test-PDF herunterladen'), 'Teil-Download fehlt'],
  [panel.includes('Trainername für alle PDF-Seiten'), 'Trainername-Feld fehlt'],
  [panel.includes('Trainingsdatum'), 'Datumsfeld fehlt'],
  [panel.includes('Mannschaft'), 'Mannschaftsfeld fehlt'],
  [panel.includes('Schwerpunkt'), 'Schwerpunktfeld fehlt'],
  [panel.includes('Seit Export geändert'), 'Änderungshinweis fehlt'],
  [pdf.includes('/templates/oefbd-training-blank-page.png.b64'), 'Originalvorlage fehlt'],
  [pdf.includes("const PHASES: TrainingPhase[] = ['AW', 'HT1', 'HT2', 'AK']"), 'Phasen fehlen'],
  [!pdf.includes('SpielzeitApp'), 'PDF darf kein SpielzeitApp-Branding enthalten'],
  [data.includes('training_exam_documentation_items'), 'Persistenz fehlt'],
  [migration.includes('ENABLE ROW LEVEL SECURITY'), 'RLS fehlt'],
  [migration.includes('created_by = auth.uid()'), 'persönlicher Zugriffsschutz fehlt'],
  [editableMigration.includes('trainer_name'), 'Trainername-Migration fehlt'],
  [editableMigration.includes('focus_override'), 'Schwerpunkt-Migration fehlt'],
  [editableMigration.includes('team_name_override'), 'Mannschaft-Migration fehlt'],
  [editableMigration.includes('training_date_override'), 'Datums-Migration fehlt'],
  [pdf.includes('drawFittedText'), 'Dynamische Textanpassung fehlt'],
];

for (const [ok, message] of checks) {
  if (!ok) throw new Error(message);
}

console.log('training-exam-documentation-test: ok');
