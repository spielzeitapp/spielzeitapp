/**
 * Übungsbibliothek (training_exercises).
 */

import { supabase } from './supabaseClient';
import { uploadStorageObject } from './storageUpload';
import type { ExerciseDifficulty, ExerciseFocus, TrainingPhase } from './trainingPhases';
import { isTrainingPhase } from './trainingPhases';

export type TrainingExerciseVisibility = 'club' | 'private';

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
  short_content: string | null;
  short_materials: string | null;
  short_coaching: string | null;
  image_path: string | null;
  source_type: string;
  source_reference: string | null;
  visibility: TrainingExerciseVisibility;
  created_by: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

const SELECT =
  'id, club_id, team_id, title, description, focus, suitable_phases, age_group, duration_minutes, player_count_min, player_count_max, difficulty, materials, organization, coaching_points, variations, short_content, short_materials, short_coaching, image_path, source_type, source_reference, visibility, created_by, is_active, created_at, updated_at';

const SELECT_WITHOUT_SHORT_TEXT =
  'id, club_id, team_id, title, description, focus, suitable_phases, age_group, duration_minutes, player_count_min, player_count_max, difficulty, materials, organization, coaching_points, variations, image_path, source_type, source_reference, visibility, created_by, is_active, created_at, updated_at';

export const TRAINING_EXERCISE_MEDIA_BUCKET = 'training-exercise-media';
/** Muss zum Bucket-Limit (8 MB) passen. */
export const TRAINING_EXERCISE_SKETCH_MAX_BYTES = 8 * 1024 * 1024;

function nullIfEmpty(s: string | null | undefined): string | null {
  const t = String(s ?? '').trim();
  return t ? t : null;
}

function normalizePhases(raw: unknown): TrainingPhase[] {
  const arr = Array.isArray(raw) ? raw.map(String) : [];
  const phases = arr.filter(isTrainingPhase);
  return phases.length ? phases : (['HT1'] as TrainingPhase[]);
}

function normalizeVisibility(raw: unknown): TrainingExerciseVisibility {
  return String(raw ?? 'club').trim().toLowerCase() === 'private' ? 'private' : 'club';
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
    short_content: (raw.short_content as string | null) ?? null,
    short_materials: (raw.short_materials as string | null) ?? null,
    short_coaching: (raw.short_coaching as string | null) ?? null,
    image_path: (raw.image_path as string | null) ?? null,
    source_type: String(raw.source_type ?? 'club'),
    source_reference: (raw.source_reference as string | null) ?? null,
    visibility: normalizeVisibility(raw.visibility),
    created_by: raw.created_by ? String(raw.created_by) : null,
    is_active: raw.is_active !== false,
    created_at: (raw.created_at as string | null) ?? null,
    updated_at: (raw.updated_at as string | null) ?? null,
  };
}

function isMigrationPending(message: string): boolean {
  return /training_exercises|does not exist|schema cache|42P01/i.test(message);
}

function isVisibilityColumnMissing(message: string): boolean {
  return /visibility|created_by|42703|PGRST204/i.test(message);
}

function isShortTextColumnMissing(message: string): boolean {
  return /short_content|short_materials|short_coaching/i.test(message);
}

const SELECT_LEGACY =
  'id, club_id, team_id, title, description, focus, suitable_phases, age_group, duration_minutes, player_count_min, player_count_max, difficulty, materials, organization, coaching_points, variations, image_path, source_type, source_reference, is_active, created_at, updated_at';

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
    if (isShortTextColumnMissing(error.message)) {
      let fallbackQ = supabase
        .from('training_exercises')
        .select(SELECT_WITHOUT_SHORT_TEXT)
        .eq('club_id', clubId)
        .order('title', { ascending: true });
      if (!opts?.includeInactive) fallbackQ = fallbackQ.eq('is_active', true);
      const fallback = await fallbackQ;
      if (fallback.error) return { data: [], error: fallback.error.message };
      return { data: (fallback.data ?? []).map((r) => mapRow(r as Record<string, unknown>)), error: null };
    }
    if (isMigrationPending(error.message)) {
      return { data: [], error: 'Trainingsbibliothek noch nicht migriert (STEP 3A ausstehend).' };
    }
    if (isVisibilityColumnMissing(error.message)) {
      let legacyQ = supabase
        .from('training_exercises')
        .select(SELECT_LEGACY)
        .eq('club_id', clubId)
        .order('title', { ascending: true });
      if (!opts?.includeInactive) legacyQ = legacyQ.eq('is_active', true);
      const legacy = await legacyQ;
      if (legacy.error) return { data: [], error: legacy.error.message };
      return {
        data: (legacy.data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
        error: null,
      };
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
    if (isShortTextColumnMissing(error.message)) {
      const fallback = await supabase
        .from('training_exercises')
        .select(SELECT_WITHOUT_SHORT_TEXT)
        .eq('id', id)
        .maybeSingle();
      if (fallback.error) return { data: null, error: fallback.error.message };
      return { data: fallback.data ? mapRow(fallback.data as Record<string, unknown>) : null, error: null };
    }
    if (isMigrationPending(error.message)) return { data: null, error: null };
    if (isVisibilityColumnMissing(error.message)) {
      const legacy = await supabase
        .from('training_exercises')
        .select(SELECT_LEGACY)
        .eq('id', id)
        .maybeSingle();
      if (legacy.error) return { data: null, error: legacy.error.message };
      return { data: legacy.data ? mapRow(legacy.data as Record<string, unknown>) : null, error: null };
    }
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
  shortContent?: string | null;
  shortMaterials?: string | null;
  shortCoaching?: string | null;
  imagePath?: string | null;
  sourceType?: 'club' | 'import';
  sourceReference?: string | null;
  visibility?: TrainingExerciseVisibility;
  createdBy?: string | null;
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

async function resolveCreatedBy(explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createTrainingExercise(
  input: TrainingExerciseInput,
): Promise<{ data: TrainingExerciseRow | null; error: string | null }> {
  const err = validateInput(input);
  if (err) return { data: null, error: err };
  const createdBy = await resolveCreatedBy(input.createdBy);
  const visibility = input.visibility === 'private' ? 'private' : 'club';
  if (visibility === 'private' && !createdBy) {
    return { data: null, error: 'Private Übungen erfordern einen angemeldeten Ersteller.' };
  }
  const payload: Record<string, unknown> = {
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
    short_content: nullIfEmpty(input.shortContent),
    short_materials: nullIfEmpty(input.shortMaterials),
    short_coaching: nullIfEmpty(input.shortCoaching),
    image_path: nullIfEmpty(input.imagePath),
    source_type: input.sourceType ?? 'club',
    source_reference: nullIfEmpty(input.sourceReference),
    visibility,
    created_by: createdBy,
    is_active: true,
  };
  const { data, error } = await supabase.from('training_exercises').insert(payload).select(SELECT).maybeSingle();
  if (error) {
    if (isShortTextColumnMissing(error.message)) {
      const { short_content: _sc, short_materials: _sm, short_coaching: _sco, ...fallbackPayload } = payload;
      const fallback = await supabase
        .from('training_exercises')
        .insert(fallbackPayload)
        .select(SELECT_WITHOUT_SHORT_TEXT)
        .maybeSingle();
      if (fallback.error) return { data: null, error: fallback.error.message };
      return { data: fallback.data ? mapRow(fallback.data as Record<string, unknown>) : null, error: null };
    }
    if (isMigrationPending(error.message)) {
      return { data: null, error: 'Trainingsbibliothek noch nicht migriert (STEP 3A ausstehend).' };
    }
    if (isVisibilityColumnMissing(error.message)) {
      const { visibility: _v, created_by: _c, ...legacyPayload } = payload;
      const legacy = await supabase
        .from('training_exercises')
        .insert(legacyPayload)
        .select(SELECT_LEGACY)
        .maybeSingle();
      if (legacy.error) return { data: null, error: legacy.error.message };
      return { data: legacy.data ? mapRow(legacy.data as Record<string, unknown>) : null, error: null };
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
  if (patch.shortContent !== undefined) payload.short_content = nullIfEmpty(patch.shortContent);
  if (patch.shortMaterials !== undefined) payload.short_materials = nullIfEmpty(patch.shortMaterials);
  if (patch.shortCoaching !== undefined) payload.short_coaching = nullIfEmpty(patch.shortCoaching);
  if (patch.imagePath !== undefined) payload.image_path = nullIfEmpty(patch.imagePath);
  if (patch.sourceType !== undefined) payload.source_type = patch.sourceType;
  if (patch.sourceReference !== undefined) payload.source_reference = nullIfEmpty(patch.sourceReference);
  if (patch.visibility !== undefined) payload.visibility = patch.visibility === 'private' ? 'private' : 'club';
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
  if (error) {
    if (isShortTextColumnMissing(error.message)) {
      const { short_content: _sc, short_materials: _sm, short_coaching: _sco, ...fallbackPayload } = payload;
      const fallback = await supabase
        .from('training_exercises')
        .update(fallbackPayload)
        .eq('id', id)
        .select(SELECT_WITHOUT_SHORT_TEXT)
        .maybeSingle();
      if (fallback.error) return { data: null, error: fallback.error.message };
      return { data: fallback.data ? mapRow(fallback.data as Record<string, unknown>) : null, error: null };
    }
    if (isVisibilityColumnMissing(error.message)) {
      const { visibility: _v, ...legacyPayload } = payload;
      const legacy = await supabase
        .from('training_exercises')
        .update(legacyPayload)
        .eq('id', id)
        .select(SELECT_LEGACY)
        .maybeSingle();
      if (legacy.error) return { data: null, error: legacy.error.message };
      return { data: legacy.data ? mapRow(legacy.data as Record<string, unknown>) : null, error: null };
    }
    return { data: null, error: error.message };
  }
  return { data: data ? mapRow(data as Record<string, unknown>) : null, error: null };
}

export function buildTrainingExerciseSketchPath(clubId: string, exerciseId: string): string {
  return `${clubId}/exercises/${exerciseId}/${crypto.randomUUID()}.webp`;
}

/** @deprecated Legacy-Importpfad – weiterhin zum Lesen/Löschen unterstützt. */
export function buildLegacyTrainingExerciseImportPath(clubId: string): string {
  return `${clubId}/imports/${crypto.randomUUID()}.webp`;
}

export async function uploadTrainingExerciseSketch(
  clubId: string,
  sketch: Blob,
  exerciseId?: string | null,
): Promise<{ path: string | null; error: string | null }> {
  const path = exerciseId?.trim()
    ? buildTrainingExerciseSketchPath(clubId, exerciseId.trim())
    : buildLegacyTrainingExerciseImportPath(clubId);
  const { error } = await uploadStorageObject(TRAINING_EXERCISE_MEDIA_BUCKET, path, sketch, {
    contentType: 'image/webp',
    cacheControl: '86400',
  });
  return error ? { path: null, error: error.message } : { path, error: null };
}

export async function removeTrainingExerciseSketch(
  path: string,
): Promise<{ ok: boolean; error: string | null }> {
  const trimmed = String(path ?? '').trim();
  if (!trimmed) return { ok: true, error: null };
  const { error } = await supabase.storage.from(TRAINING_EXERCISE_MEDIA_BUCKET).remove([trimmed]);
  return error ? { ok: false, error: error.message } : { ok: true, error: null };
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

export function formatPlayerCountRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    if (min === max) return `${min} Spieler`;
    return `${min}–${max} Spieler`;
  }
  if (min != null) return `ab ${min} Spieler`;
  return `bis ${max} Spieler`;
}
