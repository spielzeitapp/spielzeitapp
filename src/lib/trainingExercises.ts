/**
 * Übungsbibliothek (training_exercises).
 */

import { supabase } from './supabaseClient';
import { uploadStorageObject } from './storageUpload';
import type { ExerciseDifficulty, ExerciseFocus, TrainingPhase } from './trainingPhases';
import { isTrainingPhase } from './trainingPhases';

export type TrainingExerciseRow = {
  id: string;
  club_id: string;
  team_id: string | null;
  title: string;
  description: string | null;
  focus: ExerciseFocus;
  suitable_phases: TrainingPhase[];
  age_group: string | null;
  duration_minutes: number;
  player_count_min: number | null;
  player_count_max: number | null;
  difficulty: ExerciseDifficulty;
  materials: string | null;
  organization: string | null;
  coaching_points: string | null;
  variations: string | null;
  image_path: string | null;
  source_type: string;
  source_reference: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

const SELECT =
  'id, club_id, team_id, title, description, focus, suitable_phases, age_group, duration_minutes, player_count_min, player_count_max, difficulty, materials, organization, coaching_points, variations, image_path, source_type, source_reference, is_active, created_at, updated_at';

export const TRAINING_EXERCISE_MEDIA_BUCKET = 'training-exercise-media';

function nullIfEmpty(s: string | null | undefined): string | null {
  const t = String(s ?? '').trim();
  return t ? t : null;
}

function normalizePhases(raw: unknown): TrainingPhase[] {
  const arr = Array.isArray(raw) ? raw.map(String) : [];
  const phases = arr.filter(isTrainingPhase);
  return phases.length ? phases : (['HT1'] as TrainingPhase[]);
}

function mapRow(raw: Record<string, unknown>): TrainingExerciseRow {
  return {
    id: String(raw.id),
    club_id: String(raw.club_id),
    team_id: raw.team_id ? String(raw.team_id) : null,
    title: String(raw.title ?? ''),
    description: (raw.description as string | null) ?? null,
    focus: (String(raw.focus ?? 'other') as ExerciseFocus) || 'other',
    suitable_phases: normalizePhases(raw.suitable_phases),
    age_group: (raw.age_group as string | null) ?? null,
    duration_minutes: Number(raw.duration_minutes) || 15,
    player_count_min: raw.player_count_min == null ? null : Number(raw.player_count_min),
    player_count_max: raw.player_count_max == null ? null : Number(raw.player_count_max),
    difficulty: (String(raw.difficulty ?? 'medium') as ExerciseDifficulty) || 'medium',
    materials: (raw.materials as string | null) ?? null,
    organization: (raw.organization as string | null) ?? null,
    coaching_points: (raw.coaching_points as string | null) ?? null,
    variations: (raw.variations as string | null) ?? null,
    image_path: (raw.image_path as string | null) ?? null,
    source_type: String(raw.source_type ?? 'club'),
    source_reference: (raw.source_reference as string | null) ?? null,
    is_active: raw.is_active !== false,
    created_at: (raw.created_at as string | null) ?? null,
    updated_at: (raw.updated_at as string | null) ?? null,
  };
}

function isMigrationPending(message: string): boolean {
  return /training_exercises|does not exist|schema cache|42P01/i.test(message);
}

export async function listTrainingExercises(
  clubId: string,
  opts?: { includeInactive?: boolean },
): Promise<{ data: TrainingExerciseRow[]; error: string | null }> {
  let q = supabase
    .from('training_exercises')
    .select(SELECT)
    .eq('club_id', clubId)
    .order('title', { ascending: true });
  if (!opts?.includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) {
    if (isMigrationPending(error.message)) {
      return { data: [], error: 'Trainingsbibliothek noch nicht migriert (STEP 3A ausstehend).' };
    }
    return { data: [], error: error.message };
  }
  return { data: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)), error: null };
}

export async function getTrainingExercise(
  id: string,
): Promise<{ data: TrainingExerciseRow | null; error: string | null }> {
  const { data, error } = await supabase.from('training_exercises').select(SELECT).eq('id', id).maybeSingle();
  if (error) {
    if (isMigrationPending(error.message)) return { data: null, error: null };
    return { data: null, error: error.message };
  }
  return { data: data ? mapRow(data as Record<string, unknown>) : null, error: null };
}

export type TrainingExerciseInput = {
  clubId: string;
  teamId?: string | null;
  title: string;
  description?: string | null;
  focus: ExerciseFocus;
  suitablePhases: TrainingPhase[];
  ageGroup?: string | null;
  durationMinutes: number;
  playerCountMin?: number | null;
  playerCountMax?: number | null;
  difficulty?: ExerciseDifficulty;
  materials?: string | null;
  organization?: string | null;
  coachingPoints?: string | null;
  variations?: string | null;
  imagePath?: string | null;
  sourceType?: 'club' | 'import';
  sourceReference?: string | null;
};

function validateInput(input: TrainingExerciseInput): string | null {
  if (!String(input.title ?? '').trim()) return 'Titel ist Pflicht.';
  if (!input.focus) return 'Schwerpunkt ist Pflicht.';
  if (!input.suitablePhases?.length) return 'Mindestens eine Phase wählen.';
  if (!(input.durationMinutes > 0)) return 'Dauer muss größer als 0 sein.';
  const min = input.playerCountMin ?? null;
  const max = input.playerCountMax ?? null;
  if (min != null && max != null && max < min) return 'Max. Spielerzahl darf nicht kleiner als Min. sein.';
  return null;
}

export async function createTrainingExercise(
  input: TrainingExerciseInput,
): Promise<{ data: TrainingExerciseRow | null; error: string | null }> {
  const err = validateInput(input);
  if (err) return { data: null, error: err };
  const payload = {
    club_id: input.clubId,
    team_id: input.teamId ?? null,
    title: String(input.title).trim(),
    description: nullIfEmpty(input.description),
    focus: input.focus,
    suitable_phases: input.suitablePhases,
    age_group: nullIfEmpty(input.ageGroup),
    duration_minutes: input.durationMinutes,
    player_count_min: input.playerCountMin ?? null,
    player_count_max: input.playerCountMax ?? null,
    difficulty: input.difficulty ?? 'medium',
    materials: nullIfEmpty(input.materials),
    organization: nullIfEmpty(input.organization),
    coaching_points: nullIfEmpty(input.coachingPoints),
    variations: nullIfEmpty(input.variations),
    image_path: nullIfEmpty(input.imagePath),
    source_type: input.sourceType ?? 'club',
    source_reference: nullIfEmpty(input.sourceReference),
    is_active: true,
  };
  const { data, error } = await supabase.from('training_exercises').insert(payload).select(SELECT).maybeSingle();
  if (error) {
    if (isMigrationPending(error.message)) {
      return { data: null, error: 'Trainingsbibliothek noch nicht migriert (STEP 3A ausstehend).' };
    }
    return { data: null, error: error.message };
  }
  return { data: data ? mapRow(data as Record<string, unknown>) : null, error: null };
}

export async function updateTrainingExercise(
  id: string,
  patch: Partial<TrainingExerciseInput> & { isActive?: boolean },
): Promise<{ data: TrainingExerciseRow | null; error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = String(patch.title).trim();
  if (patch.description !== undefined) payload.description = nullIfEmpty(patch.description);
  if (patch.focus !== undefined) payload.focus = patch.focus;
  if (patch.suitablePhases !== undefined) payload.suitable_phases = patch.suitablePhases;
  if (patch.ageGroup !== undefined) payload.age_group = nullIfEmpty(patch.ageGroup);
  if (patch.durationMinutes !== undefined) payload.duration_minutes = patch.durationMinutes;
  if (patch.playerCountMin !== undefined) payload.player_count_min = patch.playerCountMin;
  if (patch.playerCountMax !== undefined) payload.player_count_max = patch.playerCountMax;
  if (patch.difficulty !== undefined) payload.difficulty = patch.difficulty;
  if (patch.materials !== undefined) payload.materials = nullIfEmpty(patch.materials);
  if (patch.organization !== undefined) payload.organization = nullIfEmpty(patch.organization);
  if (patch.coachingPoints !== undefined) payload.coaching_points = nullIfEmpty(patch.coachingPoints);
  if (patch.variations !== undefined) payload.variations = nullIfEmpty(patch.variations);
  if (patch.imagePath !== undefined) payload.image_path = nullIfEmpty(patch.imagePath);
  if (patch.sourceType !== undefined) payload.source_type = patch.sourceType;
  if (patch.sourceReference !== undefined) payload.source_reference = nullIfEmpty(patch.sourceReference);
  if (patch.isActive !== undefined) payload.is_active = patch.isActive;

  if (payload.title !== undefined && !String(payload.title).trim()) {
    return { data: null, error: 'Titel ist Pflicht.' };
  }

  const { data, error } = await supabase
    .from('training_exercises')
    .update(payload)
    .eq('id', id)
    .select(SELECT)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data ? mapRow(data as Record<string, unknown>) : null, error: null };
}

export async function uploadTrainingExerciseSketch(
  clubId: string,
  sketch: Blob,
): Promise<{ path: string | null; error: string | null }> {
  const objectId = crypto.randomUUID();
  const path = `${clubId}/imports/${objectId}.webp`;
  const { error } = await uploadStorageObject(TRAINING_EXERCISE_MEDIA_BUCKET, path, sketch, {
    contentType: 'image/webp',
    cacheControl: '86400',
  });
  return error ? { path: null, error: error.message } : { path, error: null };
}

export async function removeTrainingExerciseSketch(path: string): Promise<void> {
  await supabase.storage.from(TRAINING_EXERCISE_MEDIA_BUCKET).remove([path]);
}

export async function getTrainingExerciseSketchUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(TRAINING_EXERCISE_MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

export async function archiveTrainingExercise(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.from('training_exercises').update({ is_active: false }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function countExerciseUsage(
  exerciseId: string,
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from('training_session_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('exercise_id', exerciseId);
  if (error) {
    if (isMigrationPending(error.message)) return { count: 0, error: null };
    return { count: 0, error: error.message };
  }
  return { count: count ?? 0, error: null };
}
