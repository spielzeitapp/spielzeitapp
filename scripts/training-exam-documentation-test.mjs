import fs from 'node:fs';

const panel = fs.readFileSync('src/manager/ManagerTrainingExamPanel.tsx', 'utf8');
const pdf = fs.readFileSync('src/lib/trainingExamPdfExport.ts', 'utf8');
const data = fs.readFileSync('src/lib/trainingExamDocumentation.ts', 'utf8');
const sessions = fs.readFileSync('src/manager/ManagerTrainingSessionsPage.tsx', 'utf8');
const migration = fs.readFileSync(
  'supabase/migrations/20260824210000_training_exam_documentations.sql',
  'utf8',
);

const checks = [
  [sessions.includes("setMainTab('exam')"), 'Trainerprüfung-Tab fehlt'],
  [sessions.includes('<ManagerTrainingExamPanel'), 'Trainerprüfung-Panel fehlt'],
  [panel.includes('PDF-Vorschau'), 'Vorschau-Aktion fehlt'],
  [panel.includes('Gesamtdokumentation herunterladen'), 'Sammeldownload fehlt'],
  [panel.includes('selectedItems.length !== bundle.documentation.required_units'), '10er-Guard fehlt'],
  [panel.includes('Seit Export geändert'), 'Änderungshinweis fehlt'],
  [pdf.includes('/templates/oefbd-training-blank-page.png.b64'), 'Originalvorlage fehlt'],
  [pdf.includes("const PHASES: TrainingPhase[] = ['AW', 'HT1', 'HT2', 'AK']"), 'Phasen fehlen'],
  [!pdf.includes('SpielzeitApp'), 'PDF darf kein SpielzeitApp-Branding enthalten'],
  [data.includes('training_exam_documentation_items'), 'Persistenz fehlt'],
  [migration.includes('ENABLE ROW LEVEL SECURITY'), 'RLS fehlt'],
  [migration.includes('created_by = auth.uid()'), 'persönlicher Zugriffsschutz fehlt'],
];

for (const [ok, message] of checks) {
  if (!ok) throw new Error(message);
}

console.log('training-exam-documentation-test: ok');
