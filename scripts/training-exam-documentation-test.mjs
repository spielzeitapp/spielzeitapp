import fs from 'node:fs';

const panel = fs.readFileSync('src/manager/ManagerTrainingExamPanel.tsx', 'utf8');
const pdf = fs.readFileSync('src/lib/trainingExamPdfExport.ts', 'utf8');
const data = fs.readFileSync('src/lib/trainingExamDocumentation.ts', 'utf8');
const sessions = fs.readFileSync('src/manager/ManagerTrainingSessionsPage.tsx', 'utf8');
const editor = fs.readFileSync('src/manager/ManagerTrainingSessionEditorPage.tsx', 'utf8');
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
const pdfSelectionMigration = fs.readFileSync(
  'supabase/migrations/20260905100000_training_exam_pdf_unit_selection.sql',
  'utf8',
);
const pdfSelectionWorkflow = fs.readFileSync(
  '.github/workflows/staging-training-exam-unit-selection.yml',
  'utf8',
);

const checks = [
  [sessions.includes("selectMainTab('exam')"), 'Trainerprüfung-Tab fehlt'],
  [sessions.includes("requestedTab === 'exam'"), 'Direkter Rücksprung zur Trainerprüfung fehlt'],
  [sessions.includes('<ManagerTrainingExamPanel'), 'Trainerprüfung-Panel fehlt'],
  [panel.includes('PDF-Vorschau'), 'Vorschau-Aktion fehlt'],
  [panel.includes('Gesamtdokumentation herunterladen'), 'Sammeldownload fehlt'],
  [panel.includes('PDF herunterladen'), 'Teil-Download fehlt'],
  [panel.includes('Trainername für alle PDF-Seiten'), 'Trainername-Feld fehlt'],
  [panel.includes('Trainingsdatum'), 'Datumsfeld fehlt'],
  [panel.includes('automatisch nach Trainingsdatum sortiert'), 'Automatische Datumssortierung fehlt'],
  [panel.includes('for (const [index, item] of selectedItems.entries())'), 'PDF-Nummerierung folgt nicht der Datumssortierung'],
  [panel.includes('orderedItems.filter((item) => item.included_in_pdf)'), 'PDF filtert nicht nach ausgewählten Einheiten'],
  [panel.includes('checked={item.included_in_pdf}'), 'Auswahlbox je Trainingseinheit fehlt'],
  [panel.includes('In PDF'), 'Beschriftung der PDF-Auswahl fehlt'],
  [panel.includes('Benötigte PDF-Einheiten'), 'Auswahl der benötigten Einheiten fehlt'],
  [panel.includes('5 Einheiten mit Videodokumentation'), 'Option für fünf Einheiten fehlt'],
  [panel.includes('10 Einheiten'), 'Option für zehn Einheiten fehlt'],
  [panel.includes('updateTrainingExamItemIncluded'), 'PDF-Auswahl wird nicht gespeichert'],
  [panel.includes('updateTrainingExamRequiredUnits'), 'Zielanzahl wird nicht gespeichert'],
  [panel.includes("returnTo=${encodeURIComponent('/manager/training/einheiten?tab=exam')}"), 'Bearbeiten-Rücksprung zur Trainerprüfung fehlt'],
  [panel.includes('?view=training&returnTo='), 'Ansehen-Aktion für Prüfungseinheiten fehlt'],
  [panel.includes('>Ansehen</Link>'), 'Ansehen-Beschriftung für Prüfungseinheiten fehlt'],
  [editor.includes("createTrainingExerciseHandoutHtml"), 'Einzelübungs-PDF fehlt in der Trainingsansicht'],
  [editor.includes("'Einzelübung PDF'"), 'PDF-Knopf in der Trainingsansicht fehlt'],
  [editor.includes("'A4-Handout'"), 'Handout-Knopf in der Trainingsansicht fehlt'],
  [editor.includes('if (safeManagerReturnTo)'), 'Rücksprung aus Ansehen zur Trainerprüfung fehlt'],
  [panel.includes('Mannschaft'), 'Mannschaftsfeld fehlt'],
  [panel.includes('Schwerpunkt'), 'Schwerpunktfeld fehlt'],
  [panel.includes('Gemeinsame Kurzfassungen prüfen'), 'Prüfung der gemeinsamen Kurzfassungen fehlt'],
  [panel.includes('Gilt für alle Ausgaben'), 'Hinweis zur gemeinsamen Verwendung fehlt'],
  [panel.includes('Kurzfassung bearbeiten'), 'Link zum gemeinsamen Kurzfassung-Editor fehlt'],
  [panel.includes('Übungsbibliothek, Handout und Einzelübungs-PDF'), 'Ausgaben der gemeinsamen Kurzfassung fehlen'],
  [!panel.includes('const useOriginal = overrides.useOriginal !== false'), 'Prüfungsansicht verwendet noch einen eigenen Originaltext-Modus'],
  [!panel.includes('setPhaseTextMode'), 'Alter Textmodus-Umschalter ist noch aktiv'],
  [!panel.includes('updatePhaseText'), 'Prüfungstexte können noch separat bearbeitet werden'],
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
  [pdfSelectionMigration.includes('included_in_pdf boolean NOT NULL DEFAULT true'), 'Migration für PDF-Auswahl fehlt'],
  [pdfSelectionWorkflow.includes('acbaecjzoabafbsjrzvr'), 'Staging-Projektwächter für PDF-Auswahl fehlt'],
  [pdfSelectionWorkflow.includes('EXPECTED_PROJECT_NAME: spielzeitapp-staging'), 'Staging-Name wird nicht geprüft'],
  [data.includes('phase_text_overrides'), 'Kompatibilität mit gespeicherten Prüfungstexten fehlt'],
  [data.includes('included_in_pdf'), 'Persistenz der PDF-Auswahl fehlt'],
  [!pdf.includes('phaseTextOverrides'), 'PDF verwendet noch prüfungsspezifische Texte'],
  [!pdf.includes('useOriginal'), 'PDF verwendet noch den alten Originaltext-Modus'],
  [pdf.includes('Die gemeinsame Kurzfassung'), 'Warnung für zu lange gemeinsame Kurzfassung fehlt'],
  [pdf.includes('withoutContentBullets'), 'Inhaltsspalte entfernt Aufzählungspunkte nicht'],
  [pdf.includes('resolveTrainingExerciseShortText'), 'PDF nutzt die verständliche Bibliotheks-Kurzfassung nicht'],
  [pdf.includes('drawFittedText'), 'Dynamische Textanpassung fehlt'],
  [pdf.includes('const BULLET_INDENT = 3.2'), 'Einheitlicher Einzug für Aufzählungen fehlt'],
  [pdf.includes("pdf.text('•', x, baseline)"), 'Echte Aufzählungszeichen fehlen'],
  [!pdf.includes("pdf.text(line, x, baseline, { maxWidth: width })"), 'PDF streckt bereits umgebrochene Zeilen weiterhin'],
  [!pdf.includes('ellipsizeLine'), 'PDF fügt weiterhin Auslassungspunkte ein'],
  [panel.includes('measureTrainingExamPhaseTextFit'), 'PDF-Editor nutzt nicht die tatsächliche PDF-Zeilenmessung'],
  [pdf.includes('const PHASE_GAP = 0.7'), 'Kompakter gleichmäßiger Phasenabstand fehlt'],
  [pdf.includes('const CONTENT_TABLE_BOTTOM = 205'), 'Verlängerte Übungstabelle fehlt'],
  [pdf.includes('const TABLE_LEFT = 12.7'), 'PDF-Tabelle ist nicht an der linken Vorlagenlinie ausgerichtet'],
  [pdf.includes('const TABLE_RIGHT = 280.2'), 'PDF-Tabelle nutzt den rechten A4-Rand nicht optimal'],
  [pdf.includes('const ORIGINAL_HEADER_RIGHT = 264.5'), 'Ausgangskante der Kopftabelle fehlt'],
  [pdf.includes('function drawAdjustedHeader'), 'Verbreiterung der Kopftabelle fehlt'],
  [pdf.includes('drawAdjustedHeader(pdf)'), 'Verbreiterte Kopftabelle wird nicht gezeichnet'],
  [pdf.includes('const PHASE_GREEN: [number, number, number] = [38, 124, 70]'), 'Grüne Phasenkennzeichnung fehlt'],
  [pdf.includes('const CONTENT_WIDTH = 101'), 'Optimierte Inhaltsspalte fehlt'],
  [pdf.includes('const SKETCH_COLUMN_WIDTH = 67'), 'Optimierte Skizzenspalte fehlt'],
  [pdf.includes('const COACHING_COLUMN_X = MATERIAL_COLUMN_X + 32'), 'Optimierte Gerätespalte fehlt'],
  [pdf.includes('TITLE_Y_OFFSET + titleMetrics.usedHeight + TITLE_CONTENT_GAP'), 'Dynamischer Abstand unter mehrzeiligen Titeln fehlt'],
  [pdf.includes("minFontSize: 6.5"), 'Lesbare Mindestschriftgröße fehlt'],
  [pdf.includes('measureTrainingExamPhaseTextFit'), 'PDF-Zeilenmessung fehlt'],
  [/Die PDF schneidet niemals mitten im Satz ab/i.test(pdf), 'Schutz vor abgeschnittenen Sätzen fehlt'],
  [panel.includes('tatsächlich umgebrochenen PDF-Zeilen'), 'PDF-Zeilenstatus fehlt'],
  [pdf.includes('drawPhaseLabel'), 'Neu ausgerichtete Phasenlabels fehlen'],
  [pdf.includes('drawSketchPhaseBadge'), 'Phasenkennzeichnung an Skizzen fehlt'],
  [pdf.includes('const SKETCH_BADGE_X = SKETCH_COLUMN_X + 3.5'), 'Eigener Bereich fuer das Skizzen-Phasenschild fehlt'],
  [pdf.includes('const SKETCH_X = SKETCH_COLUMN_X + 17'), 'Skizze wird nicht vom Phasenschild freigehalten'],
  [pdf.includes('pdf.setFontSize(7.4)'), 'Phasenbezeichnungen in den Textspalten sind zu klein'],
  [pdf.includes('const TABLE_LINE_WIDTH = 0.25'), 'Einheitliche druckstarke Tabellenlinien fehlen'],
  [pdf.includes('pdf.line(TABLE_LEFT, HEADER_TOP, TABLE_RIGHT, HEADER_TOP)'), 'Kopflinie wird nicht durchgehend gezeichnet'],
  [pdf.includes('pdf.line(TABLE_LEFT, y, TABLE_RIGHT, y)'), 'Kopftrennlinien werden nicht durchgehend gezeichnet'],
  [pdf.includes('SKETCH_X + 0.4'), 'Skizzen nutzen den verfügbaren Weißraum nicht'],
  [pdf.includes('separatorY'), 'Zeilengleiche Phasentrennung fehlt'],
  [pdf.includes('`${date}_OeFB-D-Dokumentation_${suffix}.pdf`'), 'PDF-Dateiname enthält kein Erstellungsdatum'],
  [!pdf.includes('CONTENT_PHASE_TOPS'), 'Alte ungleiche Inhaltspositionen sind noch aktiv'],
  [!pdf.includes("exercise.title} (${item.duration_minutes} Min.)"), 'Minuten stehen noch automatisch im PDF-Titel'],
];

for (const [ok, message] of checks) {
  if (!ok) throw new Error(message);
}

console.log('training-exam-documentation-test: ok');
