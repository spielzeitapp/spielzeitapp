/**
 * Trainingseinheiten + Übungszuordnung (keine Event-Dubletten).
 */

import { supabase } from './supabaseClient';
import type { TrainingPhase, TrainingSessionStatus } from './trainingPhases';
import { isTrainingPhase, totalSessionMinutes } from './trainingPhases';
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
  exercise?: TrainingExerciseRow | null;
};

const SESSION_SELECT =
  'id, club_id, team_id, team_season_id, event_id, title, objective, notes, planned_duration_minutes, status, created_at, updated_at';

const ITEM_SELECT =
  'id, training_session_id, exercise_id, phase, sort_order, duration_minutes, coach_notes';

function nullIfEmpty(s: string | null | undefined): string | null {
  const t = String(s ?? '').trim();
  return t ? t : null;
}

function isMigrationPending(message: string): boolean {
  return /training_sessions|training_session_exercises|does not exist|schema cache|42P01/i.test(
    message,
  );
}

function mapSession(raw: Record<string, unknown>): TrainingSessionRow {
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
    status: (String(raw.status ?? 'draft') as TrainingSessionStatus) || 'draft',
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
  };
}

export async function listTrainingSessionsForSeason(
  teamSeasonId: string,
  opts?: { includeArchived?: boolean },
): Promise<{ data: TrainingSessionRow[]; error: string | null }> {
  let q = supabase
    .from('training_sessions')
    .select(SESSION_SELECT)
    .eq('team_season_id', teamSeasonId)
    .order('updated_at', { ascending: false });
  if (!opts?.includeArchived) q = q.neq('status', 'archived');
  const { data, error } = await q;
  if (error) {
    if (isMigrationPending(error.message)) {
      return { data: [], error: 'Trainingseinheiten noch nicht migriert (STEP 3A ausstehend).' };
    }
    return { data: [], error: error.message };
  }
  return { data: (data ?? []).map((r) => mapSession(r as Record<string, unknown>)), error: null };
}

export async function getTrainingSession(
  id: string,
): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  const { data, error } = await supabase.from('training_sessions').select(SESSION_SELECT).eq('id', id).maybeSingle();
  if (error) {
    if (isMigrationPending(error.message)) return { data: null, error: null };
    return { data: null, error: error.message };
  }
  return { data: data ? mapSession(data as Record<string, unknown>) : null, error: null };
}

export async function getTrainingSessionByEvent(
  eventId: string,
): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select(SESSION_SELECT)
    .eq('event_id', eventId)
    .in('status', ['draft', 'ready'])
    .maybeSingle();
  if (error) {
    if (isMigrationPending(error.message)) return { data: null, error: null };
    return { data: null, error: error.message };
  }
  return { data: data ? mapSession(data as Record<string, unknown>) : null, error: null };
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
    if (isMigrationPending(error.message)) return { data: [], error: null };
    return { data: [], error: error.message };
  }
  return {
    data: (data ?? []).map((raw) => {
      const row = raw as Record<string, unknown>;
      const item = mapItem(row);
      const ex = row.exercise as Record<string, unknown> | null;
      if (ex && typeof ex === 'object') {
        item.exercise = {
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
      return item;
    }),
    error: null,
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
}): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  const title = String(input.title ?? '').trim();
  if (!title) return { data: null, error: 'Titel ist Pflicht.' };
  const payload = {
    club_id: input.clubId,
    team_id: input.teamId,
    team_season_id: input.teamSeasonId,
    event_id: input.eventId ?? null,
    title,
    objective: nullIfEmpty(input.objective),
    notes: nullIfEmpty(input.notes),
    status: input.status ?? 'draft',
  };
  const { data, error } = await supabase.from('training_sessions').insert(payload).select(SESSION_SELECT).maybeSingle();
  if (error) {
    if (isMigrationPending(error.message)) {
      return { data: null, error: 'Trainingseinheiten noch nicht migriert (STEP 3A ausstehend).' };
    }
    if (/unique|duplicate/i.test(error.message)) {
      return { data: null, error: 'Für diesen Termin existiert bereits ein aktiver Trainingsplan.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data ? mapSession(data as Record<string, unknown>) : null, error: null };
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
  return { data: data ? mapSession(data as Record<string, unknown>) : null, error: null };
}

/** Entfernt nur die Event-Verknüpfung — Termin und Einheit bleiben. */
export async function unlinkSessionFromEvent(
  sessionId: string,
): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  return updateTrainingSession(sessionId, { eventId: null, status: 'draft' });
}

export async function archiveTrainingSession(
  id: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase
    .from('training_sessions')
    .update({ status: 'archived', event_id: null })
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
  if (error) return { data: null, error: error.message };
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
  },
): Promise<{ data: TrainingSessionExerciseRow | null; error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.phase !== undefined) payload.phase = patch.phase;
  if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;
  if (patch.durationMinutes !== undefined) payload.duration_minutes = patch.durationMinutes;
  if (patch.coachNotes !== undefined) payload.coach_notes = nullIfEmpty(patch.coachNotes);
  const { data, error } = await supabase
    .from('training_session_exercises')
    .update(payload)
    .eq('id', id)
    .select(ITEM_SELECT)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  const row = data ? mapItem(data as Record<string, unknown>) : null;
  if (row) await refreshPlannedDuration(row.training_session_id);
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
