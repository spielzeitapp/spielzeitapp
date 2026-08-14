/**
 * Trainingseinheiten + Übungszuordnung (keine Event-Dubletten).
 * STEP 3A Basis · STEP 3C Felder (record_type, Dokumentation).
 */

import { supabase } from './supabaseClient';
import type {
  ExerciseFocus,
  TrainingExerciseReviewStatus,
  TrainingPhase,
  TrainingRecordType,
  TrainingReviewRating,
  TrainingSessionStatus,
} from './trainingPhases';
import { isTrainingPhase, isTrainingSessionStatus, totalSessionMinutes } from './trainingPhases';
import type { TrainingExerciseRow } from './trainingExercises';

export type TrainingSessionRow = {
  id: string;
  club_id: string;
  team_id: string;
  team_season_id: string;
  event_id: string | null;
  title: string;
  objective: string | null;
  notes: string | null;
  planned_duration_minutes: number | null;
  status: TrainingSessionStatus;
  record_type: TrainingRecordType;
  source_session_id: string | null;
  template_id: string | null;
  focus: ExerciseFocus | null;
  age_group: string | null;
  actual_duration_minutes: number | null;
  completed_at: string | null;
  completed_by: string | null;
  review_rating: TrainingReviewRating | null;
  review_notes: string | null;
  worked_well: string | null;
  needs_improvement: string | null;
  repeat_next_time: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TrainingSessionExerciseRow = {
  id: string;
  training_session_id: string;
  exercise_id: string;
  phase: TrainingPhase;
  sort_order: number;
  duration_minutes: number;
  coach_notes: string | null;
  was_completed: boolean | null;
  actual_duration_minutes: number | null;
  review_status: TrainingExerciseReviewStatus | null;
  review_notes: string | null;
  repeat_recommended: boolean;
  exercise?: TrainingExerciseRow | null;
};

const SESSION_SELECT =
  'id, club_id, team_id, team_season_id, event_id, title, objective, notes, planned_duration_minutes, status, record_type, source_session_id, template_id, focus, age_group, actual_duration_minutes, completed_at, completed_by, review_rating, review_notes, worked_well, needs_improvement, repeat_next_time, archived_at, archived_by, created_by, created_at, updated_at';

const ITEM_SELECT =
  'id, training_session_id, exercise_id, phase, sort_order, duration_minutes, coach_notes, was_completed, actual_duration_minutes, review_status, review_notes, repeat_recommended';

function nullIfEmpty(s: string | null | undefined): string | null {
  const t = String(s ?? '').trim();
  return t ? t : null;
}

function isMigrationPending(message: string): boolean {
  return /training_sessions|training_session_exercises|does not exist|schema cache|42P01|record_type|completed_at/i.test(
    message,
  );
}

function parseFocus(v: unknown): ExerciseFocus | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s as ExerciseFocus;
}

function parseReviewRating(v: unknown): TrainingReviewRating | null {
  const s = String(v ?? '');
  if (s === 'excellent' || s === 'good' || s === 'partial' || s === 'off_plan') return s;
  return null;
}

function parseExerciseReview(v: unknown): TrainingExerciseReviewStatus | null {
  const s = String(v ?? '');
  if (s === 'worked_well' || s === 'adapted' || s === 'not_done' || s === 'repeat') return s;
  return null;
}

export function mapSessionRow(raw: Record<string, unknown>): TrainingSessionRow {
  const statusRaw = String(raw.status ?? 'draft');
  return {
    id: String(raw.id),
    club_id: String(raw.club_id),
    team_id: String(raw.team_id),
    team_season_id: String(raw.team_season_id),
    event_id: raw.event_id ? String(raw.event_id) : null,
    title: String(raw.title ?? ''),
    objective: (raw.objective as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    planned_duration_minutes:
      raw.planned_duration_minutes == null ? null : Number(raw.planned_duration_minutes),
    status: isTrainingSessionStatus(statusRaw) ? statusRaw : 'draft',
    record_type: String(raw.record_type ?? 'session') === 'template' ? 'template' : 'session',
    source_session_id: raw.source_session_id ? String(raw.source_session_id) : null,
    template_id: raw.template_id ? String(raw.template_id) : null,
    focus: parseFocus(raw.focus),
    age_group: (raw.age_group as string | null) ?? null,
    actual_duration_minutes:
      raw.actual_duration_minutes == null ? null : Number(raw.actual_duration_minutes),
    completed_at: (raw.completed_at as string | null) ?? null,
    completed_by: raw.completed_by ? String(raw.completed_by) : null,
    review_rating: parseReviewRating(raw.review_rating),
    review_notes: (raw.review_notes as string | null) ?? null,
    worked_well: (raw.worked_well as string | null) ?? null,
    needs_improvement: (raw.needs_improvement as string | null) ?? null,
    repeat_next_time: Boolean(raw.repeat_next_time),
    archived_at: (raw.archived_at as string | null) ?? null,
    archived_by: raw.archived_by ? String(raw.archived_by) : null,
    created_by: raw.created_by ? String(raw.created_by) : null,
    created_at: (raw.created_at as string | null) ?? null,
    updated_at: (raw.updated_at as string | null) ?? null,
  };
}

function mapItem(raw: Record<string, unknown>): TrainingSessionExerciseRow {
  const phaseRaw = String(raw.phase ?? 'HT1');
  return {
    id: String(raw.id),
    training_session_id: String(raw.training_session_id),
    exercise_id: String(raw.exercise_id),
    phase: isTrainingPhase(phaseRaw) ? phaseRaw : 'HT1',
    sort_order: Number(raw.sort_order) || 0,
    duration_minutes: Number(raw.duration_minutes) || 15,
    coach_notes: (raw.coach_notes as string | null) ?? null,
    was_completed: raw.was_completed == null ? null : Boolean(raw.was_completed),
    actual_duration_minutes:
      raw.actual_duration_minutes == null ? null : Number(raw.actual_duration_minutes),
    review_status: parseExerciseReview(raw.review_status),
    review_notes: (raw.review_notes as string | null) ?? null,
    repeat_recommended: Boolean(raw.repeat_recommended),
  };
}

export async function listTrainingSessionsForSeason(
  teamSeasonId: string,
  opts?: { includeArchived?: boolean; includeTemplates?: boolean },
): Promise<{ data: TrainingSessionRow[]; error: string | null }> {
  let q = supabase
    .from('training_sessions')
    .select(SESSION_SELECT)
    .eq('team_season_id', teamSeasonId)
    .order('updated_at', { ascending: false });
  if (!opts?.includeTemplates) q = q.neq('record_type', 'template');
  if (!opts?.includeArchived) q = q.neq('status', 'archived');
  const { data, error } = await q;
  if (error) {
    // Fallback ohne STEP-3C-Spalten
    if (/record_type|completed_at|column/i.test(error.message)) {
      const legacy = await supabase
        .from('training_sessions')
        .select(
          'id, club_id, team_id, team_season_id, event_id, title, objective, notes, planned_duration_minutes, status, created_at, updated_at',
        )
        .eq('team_season_id', teamSeasonId)
        .order('updated_at', { ascending: false });
      if (legacy.error) {
        if (isMigrationPending(legacy.error.message)) {
          return { data: [], error: 'Trainingseinheiten noch nicht migriert (STEP 3A ausstehend).' };
        }
        return { data: [], error: legacy.error.message };
      }
      return {
        data: (legacy.data ?? []).map((r) => mapSessionRow(r as Record<string, unknown>)),
        error: null,
      };
    }
    if (isMigrationPending(error.message)) {
      return { data: [], error: 'Trainingseinheiten noch nicht migriert (STEP 3A ausstehend).' };
    }
    return { data: [], error: error.message };
  }
  return { data: (data ?? []).map((r) => mapSessionRow(r as Record<string, unknown>)), error: null };
}

export async function getTrainingSession(
  id: string,
): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  const { data, error } = await supabase.from('training_sessions').select(SESSION_SELECT).eq('id', id).maybeSingle();
  if (error) {
    if (/record_type|column/i.test(error.message)) {
      const legacy = await supabase
        .from('training_sessions')
        .select(
          'id, club_id, team_id, team_season_id, event_id, title, objective, notes, planned_duration_minutes, status, created_at, updated_at',
        )
        .eq('id', id)
        .maybeSingle();
      if (legacy.error) {
        if (isMigrationPending(legacy.error.message)) return { data: null, error: null };
        return { data: null, error: legacy.error.message };
      }
      return { data: legacy.data ? mapSessionRow(legacy.data as Record<string, unknown>) : null, error: null };
    }
    if (isMigrationPending(error.message)) return { data: null, error: null };
    return { data: null, error: error.message };
  }
  return { data: data ? mapSessionRow(data as Record<string, unknown>) : null, error: null };
}

export async function getTrainingSessionByEvent(
  eventId: string,
): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select(SESSION_SELECT)
    .eq('event_id', eventId)
    .eq('record_type', 'session')
    .in('status', ['draft', 'ready'])
    .maybeSingle();
  if (error) {
    if (/record_type|column/i.test(error.message)) {
      const legacy = await supabase
        .from('training_sessions')
        .select(
          'id, club_id, team_id, team_season_id, event_id, title, objective, notes, planned_duration_minutes, status, created_at, updated_at',
        )
        .eq('event_id', eventId)
        .in('status', ['draft', 'ready'])
        .maybeSingle();
      if (legacy.error) {
        if (isMigrationPending(legacy.error.message)) return { data: null, error: null };
        return { data: null, error: legacy.error.message };
      }
      return { data: legacy.data ? mapSessionRow(legacy.data as Record<string, unknown>) : null, error: null };
    }
    if (isMigrationPending(error.message)) return { data: null, error: null };
    return { data: null, error: error.message };
  }
  return { data: data ? mapSessionRow(data as Record<string, unknown>) : null, error: null };
}

export async function listSessionExercises(
  sessionId: string,
): Promise<{ data: TrainingSessionExerciseRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('training_session_exercises')
    .select(
      `${ITEM_SELECT}, exercise:training_exercises (id, club_id, team_id, title, description, focus, suitable_phases, age_group, duration_minutes, player_count_min, player_count_max, difficulty, materials, organization, coaching_points, variations, image_path, source_type, is_active)`,
    )
    .eq('training_session_id', sessionId)
    .order('phase', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) {
    if (/was_completed|review_status|column/i.test(error.message)) {
      const legacy = await supabase
        .from('training_session_exercises')
        .select(
          `id, training_session_id, exercise_id, phase, sort_order, duration_minutes, coach_notes, exercise:training_exercises (id, club_id, team_id, title, description, focus, suitable_phases, age_group, duration_minutes, player_count_min, player_count_max, difficulty, materials, organization, coaching_points, variations, image_path, source_type, is_active)`,
        )
        .eq('training_session_id', sessionId)
        .order('phase', { ascending: true })
        .order('sort_order', { ascending: true });
      if (legacy.error) {
        if (isMigrationPending(legacy.error.message)) return { data: [], error: null };
        return { data: [], error: legacy.error.message };
      }
      return {
        data: (legacy.data ?? []).map((raw) => {
          const row = raw as Record<string, unknown>;
          const item = mapItem(row);
          const ex = row.exercise as Record<string, unknown> | null;
          if (ex && typeof ex === 'object') {
            item.exercise = mapExerciseEmbed(ex);
          }
          return item;
        }),
        error: null,
      };
    }
    if (isMigrationPending(error.message)) return { data: [], error: null };
    return { data: [], error: error.message };
  }
  return {
    data: (data ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      const item = mapItem(row);
      const ex = row.exercise as Record<string, unknown> | null;
      if (ex && typeof ex === 'object') item.exercise = mapExerciseEmbed(ex);
      return item;
    }),
    error: null,
  };
}

function mapExerciseEmbed(ex: Record<string, unknown>): TrainingExerciseRow {
  return {
    id: String(ex.id),
    club_id: String(ex.club_id),
    team_id: ex.team_id ? String(ex.team_id) : null,
    title: String(ex.title ?? ''),
    description: (ex.description as string | null) ?? null,
    focus: (String(ex.focus ?? 'other') as TrainingExerciseRow['focus']) || 'other',
    suitable_phases: (Array.isArray(ex.suitable_phases)
      ? ex.suitable_phases.filter((p): p is TrainingPhase => isTrainingPhase(String(p)))
      : ['HT1']) as TrainingPhase[],
    age_group: (ex.age_group as string | null) ?? null,
    duration_minutes: Number(ex.duration_minutes) || 15,
    player_count_min: ex.player_count_min == null ? null : Number(ex.player_count_min),
    player_count_max: ex.player_count_max == null ? null : Number(ex.player_count_max),
    difficulty: (String(ex.difficulty ?? 'medium') as TrainingExerciseRow['difficulty']) || 'medium',
    materials: (ex.materials as string | null) ?? null,
    organization: (ex.organization as string | null) ?? null,
    coaching_points: (ex.coaching_points as string | null) ?? null,
    variations: (ex.variations as string | null) ?? null,
    image_path: (ex.image_path as string | null) ?? null,
    source_type: String(ex.source_type ?? 'club'),
    is_active: ex.is_active !== false,
  };
}

export async function createTrainingSession(input: {
  clubId: string;
  teamId: string;
  teamSeasonId: string;
  eventId?: string | null;
  title: string;
  objective?: string | null;
  notes?: string | null;
  status?: TrainingSessionStatus;
  recordType?: TrainingRecordType;
  sourceSessionId?: string | null;
  templateId?: string | null;
  focus?: ExerciseFocus | null;
  ageGroup?: string | null;
}): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  const title = String(input.title ?? '').trim();
  if (!title) return { data: null, error: 'Titel ist Pflicht.' };
  const recordType = input.recordType ?? 'session';
  const payload: Record<string, unknown> = {
    club_id: input.clubId,
    team_id: input.teamId,
    team_season_id: input.teamSeasonId,
    event_id: recordType === 'template' ? null : input.eventId ?? null,
    title,
    objective: nullIfEmpty(input.objective),
    notes: nullIfEmpty(input.notes),
    status: input.status ?? 'draft',
    record_type: recordType,
    source_session_id: input.sourceSessionId ?? null,
    template_id: input.templateId ?? null,
    focus: input.focus ?? null,
    age_group: nullIfEmpty(input.ageGroup),
  };
  const { data, error } = await supabase.from('training_sessions').insert(payload).select(SESSION_SELECT).maybeSingle();
  if (error) {
    if (isMigrationPending(error.message) || /record_type|column/i.test(error.message)) {
      // Fallback ohne 3C-Spalten
      const legacyPayload = {
        club_id: input.clubId,
        team_id: input.teamId,
        team_season_id: input.teamSeasonId,
        event_id: input.eventId ?? null,
        title,
        objective: nullIfEmpty(input.objective),
        notes: nullIfEmpty(input.notes),
        status: input.status === 'completed' ? 'ready' : input.status ?? 'draft',
      };
      if (recordType === 'template') {
        return {
          data: null,
          error: 'Vorlagen erfordern STEP-3C-Migration (noch nicht auf dieser Umgebung).',
        };
      }
      const legacy = await supabase
        .from('training_sessions')
        .insert(legacyPayload)
        .select(
          'id, club_id, team_id, team_season_id, event_id, title, objective, notes, planned_duration_minutes, status, created_at, updated_at',
        )
        .maybeSingle();
      if (legacy.error) {
        if (/unique|duplicate/i.test(legacy.error.message)) {
          return { data: null, error: 'Für diesen Termin existiert bereits ein aktiver Trainingsplan.' };
        }
        return { data: null, error: legacy.error.message };
      }
      return { data: legacy.data ? mapSessionRow(legacy.data as Record<string, unknown>) : null, error: null };
    }
    if (/unique|duplicate/i.test(error.message)) {
      return { data: null, error: 'Für diesen Termin existiert bereits ein aktiver Trainingsplan.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data ? mapSessionRow(data as Record<string, unknown>) : null, error: null };
}

export async function updateTrainingSession(
  id: string,
  patch: {
    title?: string;
    objective?: string | null;
    notes?: string | null;
    eventId?: string | null;
    status?: TrainingSessionStatus;
    plannedDurationMinutes?: number | null;
    focus?: ExerciseFocus | null;
    ageGroup?: string | null;
    actualDurationMinutes?: number | null;
    reviewRating?: TrainingReviewRating | null;
    reviewNotes?: string | null;
    workedWell?: string | null;
    needsImprovement?: string | null;
    repeatNextTime?: boolean;
    completedAt?: string | null;
    completedBy?: string | null;
    archivedAt?: string | null;
    archivedBy?: string | null;
  },
): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = String(patch.title).trim();
  if (patch.objective !== undefined) payload.objective = nullIfEmpty(patch.objective);
  if (patch.notes !== undefined) payload.notes = nullIfEmpty(patch.notes);
  if (patch.eventId !== undefined) payload.event_id = patch.eventId;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.plannedDurationMinutes !== undefined) {
    payload.planned_duration_minutes = patch.plannedDurationMinutes;
  }
  if (patch.focus !== undefined) payload.focus = patch.focus;
  if (patch.ageGroup !== undefined) payload.age_group = nullIfEmpty(patch.ageGroup);
  if (patch.actualDurationMinutes !== undefined) {
    payload.actual_duration_minutes = patch.actualDurationMinutes;
  }
  if (patch.reviewRating !== undefined) payload.review_rating = patch.reviewRating;
  if (patch.reviewNotes !== undefined) payload.review_notes = nullIfEmpty(patch.reviewNotes);
  if (patch.workedWell !== undefined) payload.worked_well = nullIfEmpty(patch.workedWell);
  if (patch.needsImprovement !== undefined) {
    payload.needs_improvement = nullIfEmpty(patch.needsImprovement);
  }
  if (patch.repeatNextTime !== undefined) payload.repeat_next_time = patch.repeatNextTime;
  if (patch.completedAt !== undefined) payload.completed_at = patch.completedAt;
  if (patch.completedBy !== undefined) payload.completed_by = patch.completedBy;
  if (patch.archivedAt !== undefined) payload.archived_at = patch.archivedAt;
  if (patch.archivedBy !== undefined) payload.archived_by = patch.archivedBy;
  if (payload.title !== undefined && !String(payload.title).trim()) {
    return { data: null, error: 'Titel ist Pflicht.' };
  }
  const { data, error } = await supabase
    .from('training_sessions')
    .update(payload)
    .eq('id', id)
    .select(SESSION_SELECT)
    .maybeSingle();
  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      return { data: null, error: 'Für diesen Termin existiert bereits ein aktiver Trainingsplan.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data ? mapSessionRow(data as Record<string, unknown>) : null, error: null };
}

/** Entfernt nur die Event-Verknüpfung — Termin und Einheit bleiben. */
export async function unlinkSessionFromEvent(
  sessionId: string,
): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  return updateTrainingSession(sessionId, { eventId: null, status: 'draft' });
}

export async function archiveTrainingSession(
  id: string,
  userId?: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase
    .from('training_sessions')
    .update({
      status: 'archived',
      event_id: null,
      archived_at: new Date().toISOString(),
      archived_by: userId ?? null,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function addExerciseToSession(input: {
  sessionId: string;
  exerciseId: string;
  phase: TrainingPhase;
  durationMinutes: number;
  sortOrder?: number;
  coachNotes?: string | null;
}): Promise<{ data: TrainingSessionExerciseRow | null; error: string | null }> {
  if (!(input.durationMinutes > 0)) return { data: null, error: 'Dauer muss größer als 0 sein.' };
  let sortOrder = input.sortOrder;
  if (sortOrder == null) {
    const { data: existing } = await supabase
      .from('training_session_exercises')
      .select('sort_order')
      .eq('training_session_id', input.sessionId)
      .eq('phase', input.phase)
      .order('sort_order', { ascending: false })
      .limit(1);
    sortOrder = existing?.[0] ? Number((existing[0] as { sort_order: number }).sort_order) + 1 : 0;
  }
  const payload = {
    training_session_id: input.sessionId,
    exercise_id: input.exerciseId,
    phase: input.phase,
    sort_order: sortOrder,
    duration_minutes: input.durationMinutes,
    coach_notes: nullIfEmpty(input.coachNotes),
  };
  const { data, error } = await supabase
    .from('training_session_exercises')
    .insert(payload)
    .select(ITEM_SELECT)
    .maybeSingle();
  if (error) {
    if (/was_completed|column/i.test(error.message)) {
      const legacy = await supabase
        .from('training_session_exercises')
        .insert(payload)
        .select('id, training_session_id, exercise_id, phase, sort_order, duration_minutes, coach_notes')
        .maybeSingle();
      if (legacy.error) return { data: null, error: legacy.error.message };
      await refreshPlannedDuration(input.sessionId);
      return { data: legacy.data ? mapItem(legacy.data as Record<string, unknown>) : null, error: null };
    }
    return { data: null, error: error.message };
  }
  await refreshPlannedDuration(input.sessionId);
  return { data: data ? mapItem(data as Record<string, unknown>) : null, error: null };
}

export async function updateSessionExercise(
  id: string,
  patch: {
    phase?: TrainingPhase;
    sortOrder?: number;
    durationMinutes?: number;
    coachNotes?: string | null;
    wasCompleted?: boolean | null;
    actualDurationMinutes?: number | null;
    reviewStatus?: TrainingExerciseReviewStatus | null;
    reviewNotes?: string | null;
    repeatRecommended?: boolean;
  },
): Promise<{ data: TrainingSessionExerciseRow | null; error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.phase !== undefined) payload.phase = patch.phase;
  if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;
  if (patch.durationMinutes !== undefined) payload.duration_minutes = patch.durationMinutes;
  if (patch.coachNotes !== undefined) payload.coach_notes = nullIfEmpty(patch.coachNotes);
  if (patch.wasCompleted !== undefined) payload.was_completed = patch.wasCompleted;
  if (patch.actualDurationMinutes !== undefined) {
    payload.actual_duration_minutes = patch.actualDurationMinutes;
  }
  if (patch.reviewStatus !== undefined) payload.review_status = patch.reviewStatus;
  if (patch.reviewNotes !== undefined) payload.review_notes = nullIfEmpty(patch.reviewNotes);
  if (patch.repeatRecommended !== undefined) payload.repeat_recommended = patch.repeatRecommended;
  const { data, error } = await supabase
    .from('training_session_exercises')
    .update(payload)
    .eq('id', id)
    .select(ITEM_SELECT)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  const row = data ? mapItem(data as Record<string, unknown>) : null;
  if (row && (patch.durationMinutes !== undefined || patch.phase !== undefined)) {
    await refreshPlannedDuration(row.training_session_id);
  }
  return { data: row, error: null };
}

export async function removeExerciseFromSession(
  id: string,
  sessionId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.from('training_session_exercises').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  await refreshPlannedDuration(sessionId);
  return { ok: true, error: null };
}

export async function reorderSessionExercises(
  sessionId: string,
  phase: TrainingPhase,
  orderedIds: string[],
): Promise<{ ok: boolean; error: string | null }> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await supabase
      .from('training_session_exercises')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
      .eq('training_session_id', sessionId)
      .eq('phase', phase);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

async function refreshPlannedDuration(sessionId: string): Promise<void> {
  const { data } = await listSessionExercises(sessionId);
  const total = totalSessionMinutes(data);
  await supabase
    .from('training_sessions')
    .update({ planned_duration_minutes: total || null })
    .eq('id', sessionId);
}
