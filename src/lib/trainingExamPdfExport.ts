import { jsPDF } from 'jspdf';
import type { TrainingExerciseRow } from './trainingExercises';
import type { TrainingSessionExerciseRow, TrainingSessionRow } from './trainingSessions';
import type { TrainingPhase } from './trainingPhases';
import type { TrainingExamPhaseTextOverrides } from './trainingExamDocumentation';
import { createTrainingExerciseOriginalText, resolveTrainingExerciseShortText } from './trainingExerciseShortText';

export type TrainingExamPdfSession = {
  session: TrainingSessionRow;
  items: TrainingSessionExerciseRow[];
  exerciseMap: Record<string, TrainingExerciseRow>;
  eventDateIso?: string | null;
  sketchUrls?: Record<string, string | null>;
  examFocus: string;
  examTeamName: string;
  examDateIso: string | null;
  examNumber: number;
  phaseTextOverrides?: TrainingExamPhaseTextOverrides;
};

export type TrainingExamPdfInput = {
  sessions: TrainingExamPdfSession[];
  trainerName: string;
  version?: number;
};

const PHASES: TrainingPhase[] = ['AW', 'HT1', 'HT2', 'AK'];
// Exakte Nutzflächen der unveränderten NÖFV-ÖFB-D-Diplom-Seite (A4 quer).
const TABLE_HEADER_TOP = 45.4;
const PHASE_TOP = 50.4;
const PHASE_GAP = 1.3;
const CONTENT_TABLE_BOTTOM = 205;
const PHASE_HEIGHT = (CONTENT_TABLE_BOTTOM - PHASE_TOP - PHASE_GAP * 3) / 4;
const TABLE_LEFT = 14.8;
const TABLE_RIGHT = 262.3;
const CONTENT_X = 14.8;
const CONTENT_WIDTH = 79.2;
const SKETCH_COLUMN_X = CONTENT_X + CONTENT_WIDTH;
const SKETCH_COLUMN_WIDTH = 73.2;
const SKETCH_X = SKETCH_COLUMN_X + 3.8;
const SKETCH_WIDTH = SKETCH_COLUMN_WIDTH - 3.8;
const MATERIAL_COLUMN_X = SKETCH_COLUMN_X + SKETCH_COLUMN_WIDTH;
const MATERIAL_X = MATERIAL_COLUMN_X + 3.8;
const MATERIAL_WIDTH = 27.8;
const COACHING_COLUMN_X = 198.8;
const COACHING_X = 202.3;
const COACHING_WIDTH = 60;
const TITLE_X_OFFSET = 9;
const TITLE_Y_OFFSET = 3.5;
const TITLE_HEIGHT = 5.4;
const CONTENT_Y_OFFSET = 7.6;

export type TrainingExamTextFit = 'fit' | 'tight' | 'too-long';

export type TrainingExamPhaseTextFit = {
  content: TrainingExamTextFit;
  materials: TrainingExamTextFit;
  coaching: TrainingExamTextFit;
};

let backgroundCache: string | null = null;

async function loadOfficialBlankPage(): Promise<string> {
  if (backgroundCache) return backgroundCache;
  const response = await fetch('/templates/oefbd-training-blank-page.png.b64');
  if (!response.ok) throw new Error('Die offizielle ÖFB-D-Vorlage konnte nicht geladen werden.');
  const encoded = (await response.text()).replace(/\s+/g, '');
  backgroundCache = `data:image/png;base64,${encoded}`;
  return backgroundCache;
}

function clean(value: unknown): string {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: 'Europe/Vienna',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

type WrappedTextLine = {
  text: string;
  offsetX: number;
  hasBullet?: boolean;
};

const BULLET_INDENT = 3.2;

function wrapTextLines(pdf: jsPDF, value: string, width: number): WrappedTextLine[] {
  return value.split('\n').flatMap((paragraph) => {
    const normalized = paragraph.trim();
    if (!normalized) return [{ text: '', offsetX: 0 }];
    const bulletMatch = normalized.match(/^•\s*(.*)$/);
    if (bulletMatch) {
      const wrapped = pdf.splitTextToSize(bulletMatch[1], Math.max(1, width - BULLET_INDENT)) as string[];
      const lines = wrapped.length > 0 ? wrapped : [''];
      return lines.map((text, index) => ({
        text,
        offsetX: BULLET_INDENT,
        hasBullet: index === 0,
      }));
    }
    const wrapped = pdf.splitTextToSize(normalized, width) as string[];
    return (wrapped.length > 0 ? wrapped : ['']).map((text) => ({ text, offsetX: 0 }));
  });
}

function drawFittedText(
  pdf: jsPDF,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { maxFontSize: number; minFontSize: number; lineHeightFactor?: number },
): { usedHeight: number; lineCount: number; maxLines: number; fontSize: number; truncated: boolean } {
  const lineHeightFactor = options.lineHeightFactor ?? 1.14;
  const text = clean(value);
  if (!text) return { usedHeight: 0, lineCount: 0, maxLines: 1, fontSize: options.maxFontSize, truncated: false };

  let fontSize = options.maxFontSize;
  let lineHeightMm = 0;
  let maxLines = 1;
  let lines: WrappedTextLine[] = [];

  while (true) {
    pdf.setFontSize(fontSize);
    lineHeightMm = fontSize * 0.352778 * lineHeightFactor;
    maxLines = Math.max(1, Math.floor(height / lineHeightMm));
    lines = wrapTextLines(pdf, text, width);

    if (lines.length <= maxLines || fontSize <= options.minFontSize) break;
    fontSize = Math.max(options.minFontSize, Math.round((fontSize - 0.2) * 10) / 10);
  }

  pdf.setFontSize(fontSize);
  const visibleLines = lines.slice(0, maxLines);

  visibleLines.forEach((line, index) => {
    const baseline = y + index * lineHeightMm;
    if (baseline <= y + height) {
      if (line.hasBullet) pdf.text('•', x, baseline);
      pdf.text(line.text, x + line.offsetX, baseline);
    }
  });
  return {
    usedHeight: visibleLines.length * lineHeightMm,
    lineCount: visibleLines.length,
    maxLines,
    fontSize,
    truncated: lines.length > visibleLines.length,
  };
}

function fitStatus(
  metrics: ReturnType<typeof drawFittedText>,
  maxFontSize: number,
): TrainingExamTextFit {
  if (metrics.truncated) return 'too-long';
  if (metrics.fontSize < maxFontSize || metrics.lineCount >= Math.max(1, Math.floor(metrics.maxLines * 0.86))) {
    return 'tight';
  }
  return 'fit';
}

/** Misst dieselben umgebrochenen Zeilen, die später in die PDF gezeichnet werden. */
export function measureTrainingExamPhaseTextFit(input: {
  title: string;
  content: string;
  materials: string;
  coaching: string;
}): TrainingExamPhaseTextFit {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.setFont('helvetica', 'bold');
  const titleMetrics = drawFittedText(pdf, input.title, 0, 0, CONTENT_WIDTH - TITLE_X_OFFSET - 1.2, TITLE_HEIGHT, {
    maxFontSize: 7,
    minFontSize: 6.5,
    lineHeightFactor: 1.08,
  });
  pdf.setFont('helvetica', 'normal');
  const contentMetrics = drawFittedText(pdf, input.content, 0, 0, CONTENT_WIDTH - 2.4, PHASE_HEIGHT - CONTENT_Y_OFFSET - 1, {
    maxFontSize: 7,
    minFontSize: 6.5,
    lineHeightFactor: 1.03,
  });
  const materialsMetrics = drawFittedText(pdf, input.materials, 0, 0, MATERIAL_WIDTH - 2.2, PHASE_HEIGHT - 7.4, {
    maxFontSize: 7,
    minFontSize: 6.5,
    lineHeightFactor: 1.12,
  });
  const coachingMetrics = drawFittedText(pdf, input.coaching, 0, 0, COACHING_WIDTH - 2.2, PHASE_HEIGHT - 7.4, {
    maxFontSize: 7,
    minFontSize: 6.5,
    lineHeightFactor: 1.12,
  });
  return {
    content: titleMetrics.truncated ? 'too-long' : fitStatus(contentMetrics, 7),
    materials: fitStatus(materialsMetrics, 7),
    coaching: fitStatus(coachingMetrics, 7),
  };
}

function drawAdjustedTable(pdf: jsPDF): void {
  pdf.setFillColor(255, 255, 255);
  pdf.rect(TABLE_LEFT, TABLE_HEADER_TOP, TABLE_RIGHT - TABLE_LEFT, CONTENT_TABLE_BOTTOM - TABLE_HEADER_TOP, 'F');
  pdf.setDrawColor(70, 70, 70);
  pdf.setLineWidth(0.15);
  pdf.rect(TABLE_LEFT, TABLE_HEADER_TOP, TABLE_RIGHT - TABLE_LEFT, CONTENT_TABLE_BOTTOM - TABLE_HEADER_TOP);
  pdf.line(TABLE_LEFT, PHASE_TOP, TABLE_RIGHT, PHASE_TOP);
  [SKETCH_COLUMN_X, MATERIAL_COLUMN_X, COACHING_COLUMN_X].forEach((x) => {
    pdf.line(x, TABLE_HEADER_TOP, x, CONTENT_TABLE_BOTTOM);
  });
  pdf.setTextColor(15, 15, 15);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('Inhalte', CONTENT_X + CONTENT_WIDTH / 2, 49, { align: 'center' });
  pdf.text('Organisation (Skizzen)', SKETCH_COLUMN_X + SKETCH_COLUMN_WIDTH / 2, 49, { align: 'center' });
  pdf.text('Geräte', MATERIAL_COLUMN_X + (COACHING_COLUMN_X - MATERIAL_COLUMN_X) / 2, 49, { align: 'center' });
  pdf.text('Coachingpunkte', COACHING_COLUMN_X + (TABLE_RIGHT - COACHING_COLUMN_X) / 2, 49, { align: 'center' });
  pdf.setDrawColor(209, 213, 219);
  for (let phaseIndex = 1; phaseIndex < PHASES.length; phaseIndex += 1) {
    const separatorY = PHASE_TOP + phaseIndex * PHASE_HEIGHT + (phaseIndex - 0.5) * PHASE_GAP;
    pdf.line(TABLE_LEFT, separatorY, TABLE_RIGHT, separatorY);
  }
}

function withoutContentBullets(value: unknown): string {
  return clean(value)
    .split('\n')
    .map((line) => line.replace(/^•\s*/, '').trim())
    .join('\n')
    .trim();
}

function withoutVideoLines(value: unknown): string {
  return clean(value)
    .split('\n')
    .filter((line) => !/^video\s*:/i.test(line.trim()) && !/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)/i.test(line))
    .join('\n')
    .trim();
}

async function imageUrlToJpegData(url: string): Promise<{ data: string; width: number; height: number } | null> {
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    const max = 1400;
    const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL('image/jpeg', 0.9), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

function drawContainedImage(
  pdf: jsPDF,
  image: { data: string; width: number; height: number },
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.min(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  pdf.addImage(image.data, 'JPEG', x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2, drawnWidth, drawnHeight, undefined, 'FAST');
}

function drawPhaseLabel(pdf: jsPDF, phase: TrainingPhase, x: number, y: number): void {
  pdf.setTextColor(185, 28, 28);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.2);
  pdf.text(phase, x, y);
}

function drawSketchPhaseBadge(pdf: jsPDF, phase: TrainingPhase, x: number, y: number): void {
  pdf.setFillColor(198, 28, 28);
  pdf.roundedRect(x, y, 12.5, 5.2, 1.5, 1.5, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.8);
  pdf.text(phase, x + 6.25, y + 3.55, { align: 'center' });
}

function phaseItems(entry: TrainingExamPdfSession, phase: TrainingPhase): TrainingSessionExerciseRow[] {
  return entry.items
    .filter((item) => item.phase === phase)
    .sort((left, right) => left.sort_order - right.sort_order);
}

async function drawPhase(
  pdf: jsPDF,
  entry: TrainingExamPdfSession,
  phase: TrainingPhase,
  index: number,
): Promise<void> {
  const items = phaseItems(entry, phase);
  const top = PHASE_TOP + index * (PHASE_HEIGHT + PHASE_GAP);
  if (items.length === 0) return;

  const titleParts: string[] = [];
  const detailParts: string[] = [];
  const materialParts: string[] = [];
  const coachingParts: string[] = [];
  const originalDetailParts: string[] = [];
  const originalMaterialParts: string[] = [];
  const originalCoachingParts: string[] = [];
  for (const item of items) {
    const exercise = entry.exerciseMap[item.exercise_id] ?? item.exercise ?? null;
    if (!exercise) continue;
    const shortText = resolveTrainingExerciseShortText({
      description: exercise.description,
      organization: exercise.organization,
      materials: exercise.materials,
      coachingPoints: exercise.coaching_points,
      variations: exercise.variations,
      shortContent: exercise.short_content,
      shortMaterials: exercise.short_materials,
      shortCoaching: exercise.short_coaching,
    });
    const originalText = createTrainingExerciseOriginalText({
      description: exercise.description,
      organization: exercise.organization,
      materials: exercise.materials,
      coachingPoints: exercise.coaching_points,
      variations: exercise.variations,
    });
    titleParts.push(clean(exercise.title));
    if (shortText.content) detailParts.push(shortText.content);
    if (shortText.materials) materialParts.push(shortText.materials);
    if (shortText.coaching) coachingParts.push(withoutVideoLines(shortText.coaching));
    if (originalText.content) originalDetailParts.push(originalText.content);
    if (originalText.materials) originalMaterialParts.push(originalText.materials);
    if (originalText.coaching) originalCoachingParts.push(withoutVideoLines(originalText.coaching));
  }

  const override = entry.phaseTextOverrides?.[phase];
  // Missing mode is intentionally the original. A short version is only used
  // after the trainer explicitly selects it for this phase.
  const useOriginal = override?.useOriginal !== false;
  const contentText = withoutContentBullets(
    useOriginal
      ? originalDetailParts.join('\n\n')
      : typeof override?.content === 'string'
        ? override.content
        : detailParts.join('\n\n'),
  );
  const materialsText = useOriginal
    ? originalMaterialParts.join('\n')
    : typeof override?.materials === 'string'
      ? override.materials
      : materialParts.join('\n');
  const coachingText = useOriginal
    ? originalCoachingParts.join('\n\n')
    : typeof override?.coaching === 'string'
      ? override.coaching
      : coachingParts.join('\n\n');

  drawPhaseLabel(pdf, phase, CONTENT_X + 1.3, top + 3.1);
  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'bold');
  const titleMetrics = drawFittedText(
    pdf,
    titleParts.join(' / '),
    CONTENT_X + TITLE_X_OFFSET,
    top + TITLE_Y_OFFSET,
    CONTENT_WIDTH - TITLE_X_OFFSET - 1.2,
    TITLE_HEIGHT,
    {
      maxFontSize: 7,
      minFontSize: 6.5,
      lineHeightFactor: 1.08,
    },
  );
  pdf.setFont('helvetica', 'normal');
  const contentY = top + CONTENT_Y_OFFSET;
  const contentMetrics = drawFittedText(pdf, contentText, CONTENT_X + 1.3, contentY, CONTENT_WIDTH - 2.4, top + PHASE_HEIGHT - contentY - 1, {
    maxFontSize: 7,
    minFontSize: 6.5,
    lineHeightFactor: 1.03,
  });

  drawPhaseLabel(pdf, phase, MATERIAL_X + 1.2, top + 3.1);
  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'normal');
  const materialsMetrics = drawFittedText(pdf, materialsText, MATERIAL_X + 1.2, top + 6.5, MATERIAL_WIDTH - 2.2, PHASE_HEIGHT - 7.4, {
    maxFontSize: 7,
    minFontSize: 6.5,
    lineHeightFactor: 1.12,
  });

  drawPhaseLabel(pdf, phase, COACHING_X + 1.2, top + 3.1);
  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'normal');
  const coachingMetrics = drawFittedText(pdf, coachingText, COACHING_X + 1.2, top + 6.5, COACHING_WIDTH - 2.2, PHASE_HEIGHT - 7.4, {
    maxFontSize: 7,
    minFontSize: 6.5,
    lineHeightFactor: 1.12,
  });

  if (titleMetrics.truncated || contentMetrics.truncated || materialsMetrics.truncated || coachingMetrics.truncated) {
    const fields = [
      titleMetrics.truncated ? 'Titel' : '',
      contentMetrics.truncated ? 'Inhalt/Ablauf' : '',
      materialsMetrics.truncated ? 'Geräte' : '',
      coachingMetrics.truncated ? 'Coachingpunkte' : '',
    ].filter(Boolean).join(', ');
    throw new Error(
      `${useOriginal ? 'Der Originaltext' : 'Die Kurzfassung'} für ${phase} ist in ${fields} zu lang für die offizielle PDF-Vorlage. `
      + `${useOriginal ? `Wähle für ${phase} bewusst „Kurzfassung“ oder kürze den Originaltext in der Übung.` : 'Kürze den markierten Text vollständig; die PDF schneidet niemals mitten im Satz ab.'}`,
    );
  }

  const imageItems = items
    .map((item) => ({ item, url: entry.sketchUrls?.[item.exercise_id] ?? null }))
    .filter((candidate): candidate is { item: TrainingSessionExerciseRow; url: string } => Boolean(candidate.url));
  if (imageItems.length === 0) {
    pdf.setFontSize(6.5);
    pdf.setTextColor(130, 130, 130);
    pdf.text('Keine Skizze', SKETCH_X + SKETCH_WIDTH / 2, top + PHASE_HEIGHT / 2, { align: 'center' });
    drawSketchPhaseBadge(pdf, phase, SKETCH_X + 1.5, top + 1.5);
    return;
  }
  const images = (await Promise.all(imageItems.slice(0, 2).map((candidate) => imageUrlToJpegData(candidate.url)))).filter(
    (candidate): candidate is { data: string; width: number; height: number } => Boolean(candidate),
  );
  if (images.length === 1) {
    drawContainedImage(pdf, images[0], SKETCH_X + 1, top + 1, SKETCH_WIDTH - 2, PHASE_HEIGHT - 2);
  } else if (images.length === 2) {
    const half = (SKETCH_WIDTH - 3) / 2;
    drawContainedImage(pdf, images[0], SKETCH_X + 1, top + 1, half, PHASE_HEIGHT - 2);
    drawContainedImage(pdf, images[1], SKETCH_X + 2 + half, top + 1, half, PHASE_HEIGHT - 2);
  }
  drawSketchPhaseBadge(pdf, phase, SKETCH_X + 1.5, top + 1.5);
}

export async function createTrainingExamPdf(input: TrainingExamPdfInput): Promise<Blob> {
  if (input.sessions.length === 0) throw new Error('Bitte mindestens eine Trainingseinheit auswählen.');
  const background = await loadOfficialBlankPage();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });

  for (let index = 0; index < input.sessions.length; index += 1) {
    if (index > 0) pdf.addPage('a4', 'landscape');
    const entry = input.sessions[index];
    pdf.addImage(background, 'PNG', 0, 0, 297, 210, 'oefbd-original', 'FAST');

    // Logo und Kopffelder der offiziellen Vorlage bleiben pixelgenau erhalten.
    // Nur die darunterliegende Übungstabelle wird breiter bzw. bis 205 mm verlängert.
    drawAdjustedTable(pdf);

    pdf.setTextColor(15, 15, 15);
    pdf.setFont('helvetica', 'bold');
    drawFittedText(pdf, entry.examFocus, 84.5, 38.1, 132, 4.2, {
      maxFontSize: 9.2,
      minFontSize: 7,
      lineHeightFactor: 1,
    });
    pdf.setFontSize(9.2);
    pdf.text(String(entry.examNumber || index + 1), 252, 38.1);
    pdf.setFont('helvetica', 'normal');
    drawFittedText(pdf, input.trainerName, 28, 43.6, 70, 4, {
      maxFontSize: 8.5,
      minFontSize: 6.5,
      lineHeightFactor: 1,
    });
    drawFittedText(pdf, entry.examTeamName, 143, 43.6, 42, 4, {
      maxFontSize: 8.5,
      minFontSize: 6.2,
      lineHeightFactor: 1,
    });
    pdf.setFontSize(8.5);
    pdf.text(formatDate(entry.examDateIso ?? entry.eventDateIso ?? entry.session.created_at), 216, 43.6, { maxWidth: 35 });

    for (let phaseIndex = 0; phaseIndex < PHASES.length; phaseIndex += 1) {
      await drawPhase(pdf, entry, PHASES[phaseIndex], phaseIndex);
    }
  }
  return pdf.output('blob');
}

export function trainingExamPdfFilename(version: number, draft = false, pageCount = 10): string {
  const suffix = draft
    ? `TEST_${String(pageCount).padStart(2, '0')}-Einheiten`
    : `V${String(version).padStart(2, '0')}`;
  return `OeFB-D-Dokumentation_${suffix}.pdf`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
