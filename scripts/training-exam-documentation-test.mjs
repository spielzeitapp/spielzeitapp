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
const phaseTextMigration = fs.readFileSync(
  'supabase/migrations/20260825120000_training_exam_phase_text_overrides.sql',
  'utf8',
);

const checks = [
  [sessions.includes("selectMainTab('exam')"), 'Trainerprüfung-Tab fehlt'],
  [sessions.includes("requestedTab === 'exam'"), 'Direkter Rücksprung zur Trainerprüfung fehlt'],
  [sessions.includes('<ManagerTrainingExamPanel'), 'Trainerprüfung-Panel fehlt'],
  [panel.includes('PDF-Vorschau'), 'Vorschau-Aktion fehlt'],
  [panel.includes('Gesamtdokumentation herunterladen'), 'Sammeldownload fehlt'],
  [panel.includes('Test-PDF herunterladen'), 'Teil-Download fehlt'],
  [panel.includes('Trainername für alle PDF-Seiten'), 'Trainername-Feld fehlt'],
  [panel.includes('Trainingsdatum'), 'Datumsfeld fehlt'],
  [panel.includes('automatisch nach Trainingsdatum sortiert'), 'Automatische Datumssortierung fehlt'],
  [panel.includes('for (const [index, item] of selectedItems.entries())'), 'PDF-Nummerierung folgt nicht der Datumssortierung'],
  [panel.includes("returnTo=${encodeURIComponent('/manager/training/einheiten?tab=exam')}"), 'Bearbeiten-Rücksprung zur Trainerprüfung fehlt'],
  [panel.includes('Mannschaft'), 'Mannschaftsfeld fehlt'],
  [panel.includes('Schwerpunkt'), 'Schwerpunktfeld fehlt'],
  [panel.includes('PDF-Prüfungstexte auswählen'), 'Auswahl für PDF-Prüfungstexte fehlt'],
  [panel.includes('const useOriginal = overrides.useOriginal !== false'), 'Originaltext ist in der Oberfläche nicht der Standard'],
  [panel.includes('Originaltext'), 'Umschalter zum Originaltext fehlt'],
  [panel.includes('Deine Kurzfassung bleibt gespeichert'), 'Kurzfassung wird beim Umschalten nicht geschützt'],
  [panel.includes('Zu lang'), 'Längenwarnung für Prüfungstexte fehlt'],
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
  [phaseTextMigration.includes('phase_text_overrides jsonb'), 'Migration für phasenweise Prüfungstexte fehlt'],
  [data.includes('phase_text_overrides'), 'Persistenz der Prüfungstexte fehlt'],
  [pdf.includes('phaseTextOverrides'), 'PDF nutzt Prüfungstexte nicht'],
  [pdf.includes('useOriginal'), 'PDF berücksichtigt den Originaltext-Modus nicht'],
  [pdf.includes('const useOriginal = override?.useOriginal !== false'), 'Originaltext ist im PDF-Export nicht der Standard'],
  [pdf.includes("useOriginal ? 'Der Originaltext' : 'Die Kurzfassung'"), 'Warnung für zu lange PDF-Texte fehlt'],
  [pdf.includes('withoutContentBullets'), 'Inhaltsspalte entfernt Aufzählungspunkte nicht'],
  [pdf.includes('resolveTrainingExerciseShortText'), 'PDF nutzt die verständliche Bibliotheks-Kurzfassung nicht'],
  [pdf.includes('drawFittedText'), 'Dynamische Textanpassung fehlt'],
  [pdf.includes('const BULLET_INDENT = 3.2'), 'Einheitlicher Einzug für Aufzählungen fehlt'],
  [pdf.includes("pdf.text('•', x, baseline)"), 'Echte Aufzählungszeichen fehlen'],
  [!pdf.includes("pdf.text(line, x, baseline, { maxWidth: width })"), 'PDF streckt bereits umgebrochene Zeilen weiterhin'],
  [!pdf.includes('ellipsizeLine'), 'PDF fügt weiterhin Auslassungspunkte ein'],
  [panel.includes('measureTrainingExamPhaseTextFit'), 'PDF-Editor nutzt nicht die tatsächliche PDF-Zeilenmessung'],
  [pdf.includes('const PHASE_GAP = 1.3'), 'Gleichmäßiger Phasenabstand fehlt'],
  [pdf.includes('const CONTENT_TABLE_BOTTOM = 205'), 'Verlängerte Übungstabelle fehlt'],
  [pdf.includes('const TABLE_LEFT = 12.7'), 'PDF-Tabelle ist nicht an der linken Vorlagenlinie ausgerichtet'],
  [pdf.includes('const TABLE_RIGHT = 264.5'), 'PDF-Tabelle ist nicht an der rechten Vorlagenlinie ausgerichtet'],
  [pdf.includes('const CONTENT_WIDTH = 92'), 'Weiter verbreiterte Inhaltsspalte fehlt'],
  [pdf.includes('const SKETCH_COLUMN_WIDTH = 68'), 'Nach rechts verschobene Skizzenspalte fehlt'],
  [pdf.includes('const COACHING_COLUMN_X = MATERIAL_COLUMN_X + 25.6'), 'Schmalere Gerätespalte fehlt'],
  [pdf.includes('TITLE_Y_OFFSET + titleMetrics.usedHeight + TITLE_CONTENT_GAP'), 'Dynamischer Abstand unter mehrzeiligen Titeln fehlt'],
  [pdf.includes("minFontSize: 6.5"), 'Lesbare Mindestschriftgröße fehlt'],
  [pdf.includes('measureTrainingExamPhaseTextFit'), 'PDF-Zeilenmessung fehlt'],
  [pdf.includes('die PDF schneidet niemals mitten im Satz ab'), 'Schutz vor abgeschnittenen Sätzen fehlt'],
  [panel.includes('tatsächlich umgebrochenen PDF-Zeilen'), 'PDF-Zeilenstatus fehlt'],
  [pdf.includes('drawPhaseLabel'), 'Neu ausgerichtete Phasenlabels fehlen'],
  [pdf.includes('drawSketchPhaseBadge'), 'Phasenkennzeichnung an Skizzen fehlt'],
  [pdf.includes('const SKETCH_BADGE_X = SKETCH_COLUMN_X + 3.5'), 'Eigener Bereich fuer das Skizzen-Phasenschild fehlt'],
  [pdf.includes('const SKETCH_X = SKETCH_COLUMN_X + 17'), 'Skizze wird nicht vom Phasenschild freigehalten'],
  [pdf.includes('pdf.setFontSize(7.4)'), 'Phasenbezeichnungen in den Textspalten sind zu klein'],
  [pdf.includes('pdf.setLineWidth(0.25)'), 'Aussen- und Kopfrahmen sind nicht druckstark genug'],
  [pdf.includes('pdf.setLineWidth(0.21)'), 'Phasentrennlinien sind nicht druckstark genug'],
  [pdf.includes('separatorY'), 'Zeilengleiche Phasentrennung fehlt'],
  [pdf.includes('`${date}_OeFB-D-Dokumentation_${suffix}.pdf`'), 'PDF-Dateiname enthält kein Erstellungsdatum'],
  [!pdf.includes('CONTENT_PHASE_TOPS'), 'Alte ungleiche Inhaltspositionen sind noch aktiv'],
  [!pdf.includes("exercise.title} (${item.duration_minutes} Min.)"), 'Minuten stehen noch automatisch im PDF-Titel'],
];

for (const [ok, message] of checks) {
  if (!ok) throw new Error(message);
}

console.log('training-exam-documentation-test: ok');
