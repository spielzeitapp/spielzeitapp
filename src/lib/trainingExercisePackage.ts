import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { TrainingExerciseRow, TrainingExerciseVisibility } from './trainingExercises';
import {
  EXERCISE_FOCUS_LABELS,
  TRAINING_PHASES,
  type ExerciseDifficulty,
  type ExerciseFocus,
  type TrainingPhase,
} from './trainingPhases';

const PACKAGE_FORMAT = 'spielzeitapp.training-exercise';
const PACKAGE_VERSION = 1;
const MAX_PACKAGE_BYTES = 12 * 1024 * 1024;
const MANIFEST_FILE = 'manifest.json';
const SKETCH_FILE = 'sketch.webp';
const MAX_SKETCH_BYTES = 8 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 512 * 1024;

export const TRAINING_EXERCISE_PACKAGE_EXTENSION = '.spielzeit-uebung';
export const TRAINING_EXERCISE_PACKAGE_ACCEPT =
  '.spielzeit-uebung,application/vnd.spielzeitapp.training-exercise+zip';

export type TrainingExercisePackageDraft = {
  title: string;
  description: string;
  focus: ExerciseFocus;
  suitablePhases: TrainingPhase[];
  ageGroup: string;
  durationMinutes: number;
  playerCountMin: string;
  playerCountMax: string;
  difficulty: ExerciseDifficulty;
  materials: string;
  organization: string;
  coachingPoints: string;
  variations: string;
  shortContent: string;
  shortMaterials: string;
  shortCoaching: string;
  sourceType: 'club' | 'import';
  sourceReference: string;
  visibility: TrainingExerciseVisibility;
  sketch: Blob | null;
};

type ExerciseManifest = Omit<TrainingExercisePackageDraft, 'sketch' | 'playerCountMin' | 'playerCountMax'> & {
  playerCountMin: number | null;
  playerCountMax: number | null;
  hasSketch: boolean;
};

type PackageManifest = {
  format: typeof PACKAGE_FORMAT;
  version: typeof PACKAGE_VERSION;
  exportedAt: string;
  exercise: ExerciseManifest;
};

function text(value: unknown): string {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

function safeFileStem(value: string): string {
  const stem = text(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return stem || 'spielzeitapp-uebung';
}

function packageExercise(row: TrainingExerciseRow, hasSketch: boolean): ExerciseManifest {
  return {
    title: row.title,
    description: row.description ?? '',
    focus: row.focus,
    suitablePhases: row.suitable_phases,
    ageGroup: row.age_group ?? '',
    durationMinutes: row.duration_minutes,
    playerCountMin: row.player_count_min,
    playerCountMax: row.player_count_max,
    difficulty: row.difficulty,
    materials: row.materials ?? '',
    organization: row.organization ?? '',
    coachingPoints: row.coaching_points ?? '',
    variations: row.variations ?? '',
    shortContent: row.short_content ?? '',
    shortMaterials: row.short_materials ?? '',
    shortCoaching: row.short_coaching ?? '',
    sourceType: row.source_type === 'import' ? 'import' : 'club',
    sourceReference: row.source_reference ?? '',
    visibility: row.visibility === 'private' ? 'private' : 'club',
    hasSketch,
  };
}

export async function createTrainingExercisePackage(
  exercise: TrainingExerciseRow,
  sketchUrl?: string | null,
): Promise<{ blob: Blob; fileName: string }> {
  let sketch: Uint8Array | null = null;
  if (sketchUrl) {
    const response = await fetch(sketchUrl);
    if (!response.ok) throw new Error('Die Skizze konnte nicht in das Übungspaket übernommen werden.');
    sketch = new Uint8Array(await response.arrayBuffer());
    if (sketch.byteLength > MAX_SKETCH_BYTES) {
      throw new Error('Die Skizze ist für ein Übungspaket zu groß.');
    }
  }

  const manifest: PackageManifest = {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    exercise: packageExercise(exercise, Boolean(sketch)),
  };
  const archive = zipSync(
    {
      [MANIFEST_FILE]: strToU8(JSON.stringify(manifest, null, 2)),
      ...(sketch ? { [SKETCH_FILE]: sketch } : {}),
    },
    { level: 6 },
  );

  return {
    blob: new Blob([archive], { type: 'application/vnd.spielzeitapp.training-exercise+zip' }),
    fileName: `${safeFileStem(exercise.title)}${TRAINING_EXERCISE_PACKAGE_EXTENSION}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`${label} fehlt im Übungspaket.`);
  return result;
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function validFocus(value: unknown): ExerciseFocus {
  const candidate = String(value ?? '');
  return Object.prototype.hasOwnProperty.call(EXERCISE_FOCUS_LABELS, candidate)
    ? (candidate as ExerciseFocus)
    : 'technik';
}

export async function parseTrainingExercisePackage(file: File): Promise<TrainingExercisePackageDraft> {
  if (!file.name.toLowerCase().endsWith(TRAINING_EXERCISE_PACKAGE_EXTENSION)) {
    throw new Error('Bitte eine SpielzeitApp-Übungspaket-Datei auswählen.');
  }
  if (file.size > MAX_PACKAGE_BYTES) throw new Error('Das Übungspaket darf maximal 12 MB groß sein.');

  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('Das Übungspaket ist beschädigt oder nicht lesbar.');
  }
  const manifestBytes = archive[MANIFEST_FILE];
  if (!manifestBytes || manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
    throw new Error('Im Übungspaket fehlt die gültige Beschreibung.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new Error('Die Beschreibung des Übungspakets ist beschädigt.');
  }
  if (!isRecord(raw) || raw.format !== PACKAGE_FORMAT || raw.version !== PACKAGE_VERSION) {
    throw new Error('Dieses Übungspaket-Format wird nicht unterstützt.');
  }
  if (!isRecord(raw.exercise)) throw new Error('Im Übungspaket fehlen die Übungsdaten.');
  const exercise = raw.exercise;

  const phaseValues = Array.isArray(exercise.suitablePhases)
    ? exercise.suitablePhases.map(String).filter((phase): phase is TrainingPhase =>
        (TRAINING_PHASES as readonly string[]).includes(phase),
      )
    : [];
  const focusValue = validFocus(exercise.focus);
  const difficultyValue = String(exercise.difficulty ?? 'medium') as ExerciseDifficulty;
  const duration = Number(exercise.durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Die Dauer im Übungspaket ist ungültig.');

  const sketchBytes = archive[SKETCH_FILE];
  if (sketchBytes && sketchBytes.byteLength > MAX_SKETCH_BYTES) {
    throw new Error('Die Skizze im Übungspaket ist zu groß.');
  }
  if (exercise.hasSketch === true && !sketchBytes) {
    throw new Error('Die Skizze fehlt im Übungspaket.');
  }

  return {
    title: requiredText(exercise.title, 'Titel'),
    description: text(exercise.description),
    focus: focusValue,
    suitablePhases: phaseValues.length ? phaseValues : ['HT1'],
    ageGroup: text(exercise.ageGroup),
    durationMinutes: duration,
    playerCountMin: nullableNumber(exercise.playerCountMin)?.toString() ?? '',
    playerCountMax: nullableNumber(exercise.playerCountMax)?.toString() ?? '',
    difficulty: ['easy', 'medium', 'hard'].includes(difficultyValue) ? difficultyValue : 'medium',
    materials: text(exercise.materials),
    organization: text(exercise.organization),
    coachingPoints: text(exercise.coachingPoints),
    variations: text(exercise.variations),
    shortContent: text(exercise.shortContent),
    shortMaterials: text(exercise.shortMaterials),
    shortCoaching: text(exercise.shortCoaching),
    sourceType: exercise.sourceType === 'import' ? 'import' : 'club',
    sourceReference: text(exercise.sourceReference),
    visibility: exercise.visibility === 'private' ? 'private' : 'club',
    sketch: sketchBytes ? new Blob([sketchBytes], { type: 'image/webp' }) : null,
  };
}
