import { strFromU8, strToU8, unzlibSync, zlibSync } from 'fflate';
import type { TrainingExerciseRow, TrainingExerciseVisibility } from './trainingExercises';
import {
  EXERCISE_FOCUS_LABELS,
  TRAINING_PHASES,
  type ExerciseDifficulty,
  type ExerciseFocus,
  type TrainingPhase,
} from './trainingPhases';

const PDF_PAYLOAD_FORMAT = 'spielzeitapp.training-exercise-pdf';
const PDF_PAYLOAD_VERSION = 1;
const PAYLOAD_START = 'SPIELZEITAPP_EXERCISE_V1_BEGIN';
const PAYLOAD_END = 'SPIELZEITAPP_EXERCISE_V1_END';
const MAX_COMPRESSED_PAYLOAD_BYTES = 256 * 1024;

// Browser print engines may expose underscores in the PDF text layer as spaces.
// Accept both representations so a PDF printed by Chrome/Edge can be imported
// again without weakening validation of the compressed payload itself.
const PAYLOAD_START_PATTERN = /SPIELZEITAPP[\s_]*EXERCISE[\s_]*V1[\s_]*BEGIN/i;
const PAYLOAD_END_PATTERN = /SPIELZEITAPP[\s_]*EXERCISE[\s_]*V1[\s_]*END/i;

export type TrainingExercisePdfPayload = {
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
  hasSketch: boolean;
};

type SerializedPayload = {
  format: typeof PDF_PAYLOAD_FORMAT;
  version: typeof PDF_PAYLOAD_VERSION;
  exercise: TrainingExercisePdfPayload;
};

function text(value: unknown): string {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  // Keep standard Base64 in printed PDFs. Chromium can turn the underscore in
  // Base64URL into a space in the PDF text layer, which corrupts the payload.
  return btoa(binary);
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
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

export function createTrainingExercisePdfPayload(exercise: TrainingExerciseRow): string {
  const payload: SerializedPayload = {
    format: PDF_PAYLOAD_FORMAT,
    version: PDF_PAYLOAD_VERSION,
    exercise: {
      title: exercise.title,
      description: exercise.description ?? '',
      focus: exercise.focus,
      suitablePhases: exercise.suitable_phases,
      ageGroup: exercise.age_group ?? '',
      durationMinutes: exercise.duration_minutes,
      playerCountMin: exercise.player_count_min?.toString() ?? '',
      playerCountMax: exercise.player_count_max?.toString() ?? '',
      difficulty: exercise.difficulty,
      materials: exercise.materials ?? '',
      organization: exercise.organization ?? '',
      coachingPoints: exercise.coaching_points ?? '',
      variations: exercise.variations ?? '',
      shortContent: exercise.short_content ?? '',
      shortMaterials: exercise.short_materials ?? '',
      shortCoaching: exercise.short_coaching ?? '',
      sourceType: exercise.source_type === 'import' ? 'import' : 'club',
      sourceReference: exercise.source_reference ?? '',
      visibility: exercise.visibility === 'private' ? 'private' : 'club',
      hasSketch: Boolean(exercise.image_path),
    },
  };
  const compressed = zlibSync(strToU8(JSON.stringify(payload)), { level: 9 });
  return `${PAYLOAD_START}${bytesToBase64Url(compressed)}${PAYLOAD_END}`;
}

export function parseTrainingExercisePdfPayload(documentText: string): TrainingExercisePdfPayload | null {
  const start = PAYLOAD_START_PATTERN.exec(documentText);
  if (!start) return null;
  const payloadStart = start.index + start[0].length;
  const remainder = documentText.slice(payloadStart);
  const end = PAYLOAD_END_PATTERN.exec(remainder);
  if (!end) throw new Error('Die eingebetteten SpielzeitApp-Daten in der PDF sind unvollständig.');
  const extractedPayload = remainder.slice(0, end.index);
  const encodedCandidates = [
    extractedPayload.replace(/\s+/g, ''),
    // Compatibility for PDFs already exported with Base64URL: Chromium may
    // expose an underscore as an ordinary space, while real line wrapping is
    // exposed as a newline.
    extractedPayload.replace(/[ \t]+/g, '_').replace(/[\r\n\f]+/g, ''),
  ];

  let raw: unknown;
  for (const encoded of [...new Set(encodedCandidates)]) {
    try {
      const compressed = base64UrlToBytes(encoded);
      if (compressed.byteLength > MAX_COMPRESSED_PAYLOAD_BYTES) throw new Error('payload too large');
      raw = JSON.parse(strFromU8(unzlibSync(compressed)));
      break;
    } catch {
      // Try the compatibility candidate before reporting a damaged payload.
    }
  }
  if (raw === undefined) {
    throw new Error('Die eingebetteten SpielzeitApp-Daten in der PDF sind beschädigt.');
  }
  if (!isRecord(raw) || raw.format !== PDF_PAYLOAD_FORMAT || raw.version !== PDF_PAYLOAD_VERSION) {
    throw new Error('Diese SpielzeitApp-PDF-Version wird nicht unterstützt.');
  }
  if (!isRecord(raw.exercise)) throw new Error('In der SpielzeitApp-PDF fehlen die Übungsdaten.');
  const exercise = raw.exercise;
  const title = text(exercise.title);
  if (!title) throw new Error('In der SpielzeitApp-PDF fehlt der Übungstitel.');
  const duration = Number(exercise.durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Die Dauer in der SpielzeitApp-PDF ist ungültig.');
  }
  const phases = Array.isArray(exercise.suitablePhases)
    ? exercise.suitablePhases.map(String).filter((phase): phase is TrainingPhase =>
        (TRAINING_PHASES as readonly string[]).includes(phase),
      )
    : [];
  const difficulty = String(exercise.difficulty ?? 'medium') as ExerciseDifficulty;

  return {
    title,
    description: text(exercise.description),
    focus: validFocus(exercise.focus),
    suitablePhases: phases.length ? phases : ['HT1'],
    ageGroup: text(exercise.ageGroup),
    durationMinutes: duration,
    playerCountMin: numberOrNull(exercise.playerCountMin)?.toString() ?? '',
    playerCountMax: numberOrNull(exercise.playerCountMax)?.toString() ?? '',
    difficulty: ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium',
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
    hasSketch: exercise.hasSketch === true,
  };
}

