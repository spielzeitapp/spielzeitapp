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
};

export type TrainingExamPdfInput = {
  sessions: TrainingExamPdfSession[];
  trainerName: string;
  teamName: string;
  version?: number;
};

const PHASES: TrainingPhase[] = ['AW', 'HT1', 'HT2', 'AK'];
// Exakte Nutzflächen der unveränderten NÖFV-ÖFB-D-Diplom-Seite (A4 quer).
const PHASE_TOP = 49.8;
const PHASE_HEIGHT = 32.8;
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

function limitedLines(pdf: jsPDF, value: string, width: number, maxLines: number): string[] {
  const lines = pdf.splitTextToSize(clean(value), width) as string[];
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/[.…\s]+$/, '')}…`;
  return clipped;
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
      [clean(exercise.coaching_points), clean(exercise.variations) ? `Variation: ${clean(exercise.variations)}` : '']
        .filter(Boolean)
        .join('\n'),
    );
  }

  pdf.setTextColor(20, 20, 20);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.8);
  pdf.text(limitedLines(pdf, contentParts.join('\n\n'), CONTENT_WIDTH, 14), CONTENT_X, top + 4.8, {
    lineHeightFactor: 1.12,
    maxWidth: CONTENT_WIDTH,
  });
  pdf.setFontSize(5.5);
  pdf.text(limitedLines(pdf, materialParts.join('\n'), MATERIAL_WIDTH, 15), MATERIAL_X, top + 4.2, {
    lineHeightFactor: 1.12,
    maxWidth: MATERIAL_WIDTH,
  });
  pdf.text(limitedLines(pdf, coachingParts.join('\n\n'), COACHING_WIDTH, 16), COACHING_X, top + 4.2, {
    lineHeightFactor: 1.1,
    maxWidth: COACHING_WIDTH,
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
    pdf.setFontSize(9.2);
    pdf.text(clean(entry.session.objective) || clean(entry.session.title), 84.5, 38.1, { maxWidth: 132 });
    pdf.text(String(index + 1), 252, 38.1);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text(clean(input.trainerName), 28, 43.6, { maxWidth: 70 });
    pdf.text(clean(input.teamName), 143, 43.6, { maxWidth: 42 });
    pdf.text(formatDate(entry.eventDateIso ?? entry.session.created_at), 216, 43.6, { maxWidth: 35 });

    for (let phaseIndex = 0; phaseIndex < PHASES.length; phaseIndex += 1) {
      await drawPhase(pdf, entry, PHASES[phaseIndex], phaseIndex);
    }
  }
  return pdf.output('blob');
}

export function trainingExamPdfFilename(version: number, draft = false): string {
  const suffix = draft ? 'VORSCHAU' : `V${String(version).padStart(2, '0')}`;
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
