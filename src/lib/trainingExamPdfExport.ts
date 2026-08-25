import { jsPDF } from 'jspdf';
import type { TrainingExerciseRow } from './trainingExercises';
import type { TrainingSessionExerciseRow, TrainingSessionRow } from './trainingSessions';
import type { TrainingPhase } from './trainingPhases';

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
};

export type TrainingExamPdfInput = {
  sessions: TrainingExamPdfSession[];
  trainerName: string;
  version?: number;
};

const PHASES: TrainingPhase[] = ['AW', 'HT1', 'HT2', 'AK'];
// Exakte Nutzflächen der unveränderten NÖFV-ÖFB-D-Diplom-Seite (A4 quer).
const PHASE_TOP = 49.8;
const PHASE_HEIGHT = 32.8;
// Die Phasenlabels sind in der unveränderten Hintergrundvorlage ungleichmäßig verteilt.
const CONTENT_PHASE_TOPS = [49.8, 86, 122.2, 167.4] as const;
const CONTENT_TABLE_BOTTOM = 180.8;
const CONTENT_X = 14.8;
const CONTENT_WIDTH = 58.2;
const SKETCH_X = 76.8;
const SKETCH_WIDTH = 86.2;
const MATERIAL_X = 166.8;
const MATERIAL_WIDTH = 32;
const COACHING_X = 202.3;
const COACHING_WIDTH = 60;

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

function wrapTextLines(pdf: jsPDF, value: string, width: number): string[] {
  return value.split('\n').flatMap((paragraph) => {
    const normalized = paragraph.trim();
    if (!normalized) return [''];
    const wrapped = pdf.splitTextToSize(normalized, width) as string[];
    return wrapped.length > 0 ? wrapped : [''];
  });
}

function ellipsizeLine(pdf: jsPDF, value: string, width: number): string {
  const suffix = '…';
  let fitted = value.replace(/[.…\s]+$/, '');
  while (fitted && pdf.getTextWidth(`${fitted}${suffix}`) > width) {
    fitted = fitted.slice(0, -1).trimEnd();
  }
  return `${fitted}${suffix}`;
}

function drawFittedText(
  pdf: jsPDF,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { maxFontSize: number; minFontSize: number; lineHeightFactor?: number },
): void {
  const lineHeightFactor = options.lineHeightFactor ?? 1.14;
  const text = clean(value);
  if (!text) return;

  let fontSize = options.maxFontSize;
  let lineHeightMm = 0;
  let maxLines = 1;
  let lines: string[] = [];

  while (true) {
    pdf.setFontSize(fontSize);
    lineHeightMm = fontSize * 0.352778 * lineHeightFactor;
    maxLines = Math.max(1, Math.floor(height / lineHeightMm));
    lines = wrapTextLines(pdf, text, width);

    if (lines.length <= maxLines || fontSize <= options.minFontSize) break;
    fontSize = Math.max(options.minFontSize, Math.round((fontSize - 0.2) * 10) / 10);
  }

  pdf.setFontSize(fontSize);
  const truncated = lines.length > maxLines;
  const visibleLines = lines.slice(0, maxLines);
  if (truncated && visibleLines.length > 0) {
    visibleLines[visibleLines.length - 1] = ellipsizeLine(pdf, visibleLines[visibleLines.length - 1], width);
  }

  visibleLines.forEach((line, index) => {
    const baseline = y + index * lineHeightMm;
    if (baseline <= y + height) {
      pdf.text(line, x, baseline, { maxWidth: width });
    }
  });
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
  const top = PHASE_TOP + index * PHASE_HEIGHT;
  const contentTop = CONTENT_PHASE_TOPS[index];
  const contentBottom = CONTENT_PHASE_TOPS[index + 1] ?? CONTENT_TABLE_BOTTOM;
  if (items.length === 0) return;

  const contentParts: string[] = [];
  const materialParts: string[] = [];
  const coachingParts: string[] = [];
  for (const item of items) {
    const exercise = entry.exerciseMap[item.exercise_id] ?? item.exercise ?? null;
    if (!exercise) continue;
    contentParts.push(
      [
        `${exercise.title} (${item.duration_minutes} Min.)`,
        clean(exercise.description),
        clean(exercise.organization) ? `Aufbau: ${clean(exercise.organization)}` : '',
      ].filter(Boolean).join('\n'),
    );
    if (clean(exercise.materials)) materialParts.push(clean(exercise.materials));
    coachingParts.push(
      [withoutVideoLines(exercise.coaching_points), withoutVideoLines(exercise.variations) ? `Variation: ${withoutVideoLines(exercise.variations)}` : '']
        .filter(Boolean)
        .join('\n'),
    );
  }

  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'normal');
  drawFittedText(
    pdf,
    contentParts.join('\n\n'),
    CONTENT_X,
    contentTop + 7.2,
    CONTENT_WIDTH,
    Math.max(3.5, contentBottom - contentTop - 8.5),
    {
      maxFontSize: 6.5,
      minFontSize: 5.5,
      lineHeightFactor: 1.15,
    },
  );
  drawFittedText(pdf, materialParts.join('\n'), MATERIAL_X, top + 4, MATERIAL_WIDTH, PHASE_HEIGHT - 5.2, {
    maxFontSize: 6.1,
    minFontSize: 5.5,
    lineHeightFactor: 1.12,
  });
  drawFittedText(pdf, coachingParts.join('\n\n'), COACHING_X, top + 4, COACHING_WIDTH, PHASE_HEIGHT - 5.2, {
    maxFontSize: 6.1,
    minFontSize: 5.5,
    lineHeightFactor: 1.12,
  });

  const imageItems = items
    .map((item) => ({ item, url: entry.sketchUrls?.[item.exercise_id] ?? null }))
    .filter((candidate): candidate is { item: TrainingSessionExerciseRow; url: string } => Boolean(candidate.url));
  if (imageItems.length === 0) {
    pdf.setFontSize(6.5);
    pdf.setTextColor(130, 130, 130);
    pdf.text('Keine Skizze', SKETCH_X + SKETCH_WIDTH / 2, top + PHASE_HEIGHT / 2, { align: 'center' });
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
}

export async function createTrainingExamPdf(input: TrainingExamPdfInput): Promise<Blob> {
  if (input.sessions.length === 0) throw new Error('Bitte mindestens eine Trainingseinheit auswählen.');
  const background = await loadOfficialBlankPage();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });

  for (let index = 0; index < input.sessions.length; index += 1) {
    if (index > 0) pdf.addPage('a4', 'landscape');
    const entry = input.sessions[index];
    pdf.addImage(background, 'PNG', 0, 0, 297, 210, 'oefbd-original', 'FAST');

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
