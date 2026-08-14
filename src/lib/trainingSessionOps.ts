/**
 * STEP 3C: Kopieren, Vorlagen, Dokumentation, Chronik-Queries.
 */

import { supabase } from './supabaseClient';
import type { ExerciseFocus } from './trainingPhases';
import {
  isTrainingSessionStatus,
  type TrainingExerciseReviewStatus,
  type TrainingRecordType,
  type TrainingReviewRating,
  type TrainingSessionStatus,
} from './trainingPhases';
import {
  addExerciseToSession,
  createTrainingSession,
  getTrainingSession,
  listSessionExercises,
  updateSessionExercise,
  updateTrainingSession,
  type TrainingSessionExerciseRow,
  type TrainingSessionRow,
} from './trainingSessions';

export type CopyTrainingMode = 'draft' | 'event' | 'template';

function copyTitle(original: string, mode: CopyTrainingMode): string {
  const base = String(original ?? '').trim() || 'Training';
  if (mode === 'template') {
    if (/vorlage/i.test(base)) return base;
    return `Vorlage: ${base}`;
  }
  const stripped = base.replace(/\s*\(Kopie(?:\s*\d+)?\)\s*$/i, '').trim() || base;
  return `${stripped} (Kopie)`;
}

async function cloneExercises(
  sourceSessionId: string,
  targetSessionId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data: items, error } = await listSessionExercises(sourceSessionId);
  if (error) return { ok: false, error };
  for (const item of items) {
    const res = await addExerciseToSession({
      sessionId: targetSessionId,
      exerciseId: item.exercise_id,
      phase: item.phase,
      durationMinutes: item.duration_minutes,
      sortOrder: item.sort_order,
      coachNotes: item.coach_notes,
    });
    if (res.error) return { ok: false, error: res.error };
  }
  return { ok: true, error: null };
}

/**
 * Kopiert eine Einheit oder Vorlage.
 * - draft: ohne Termin, Status draft
 * - event: an bestehenden Termin (eventId Pflicht), Status draft
 * - template: als Vorlage (record_type=template), ohne Event/Nachbereitung
 * Nachbereitung wird nie übernommen.
 */
export async function copyTrainingSession(input: {
  sourceId: string;
  mode: CopyTrainingMode;
  eventId?: string | null;
  title?: string | null;
}): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  const src = await getTrainingSession(input.sourceId);
  if (src.error || !src.data) return { data: null, error: src.error ?? 'Einheit nicht gefunden.' };
  const source = src.data;

  if (input.mode === 'event') {
    const eid = String(input.eventId ?? '').trim();
    if (!eid) return { data: null, error: 'Bitte einen Trainingstermin wählen.' };
    const existing = await supabase
      .from('training_sessions')
      .select('id')
      .eq('event_id', eid)
      .eq('record_type', 'session')
      .in('status', ['draft', 'ready'])
      .maybeSingle();
    if (existing.data?.id) {
      return { data: null, error: 'Für diesen Termin besteht bereits ein Trainingsplan.' };
    }
  }

  const title = String(input.title ?? '').trim() || copyTitle(source.title, input.mode);
  const isTemplate = input.mode === 'template';

  const created = await createTrainingSession({
    clubId: source.club_id,
    teamId: source.team_id,
    teamSeasonId: source.team_season_id,
    eventId: input.mode === 'event' ? input.eventId ?? null : null,
    title,
    objective: source.objective,
    notes: source.notes,
    status: 'draft',
    recordType: isTemplate ? 'template' : 'session',
    sourceSessionId: source.id,
    templateId:
      source.record_type === 'template'
        ? source.id
        : input.mode === 'template'
          ? null
          : source.template_id,
    focus: source.focus,
    ageGroup: source.age_group,
  });
  if (created.error || !created.data) {
    return { data: null, error: created.error ?? 'Kopie fehlgeschlagen.' };
  }

  const clone = await cloneExercises(source.id, created.data.id);
  if (clone.error) {
    // Beste Bemühen: leere Kopie entfernen
    await supabase.from('training_sessions').delete().eq('id', created.data.id);
    return { data: null, error: clone.error };
  }

  const refreshed = await getTrainingSession(created.data.id);
  return { data: refreshed.data ?? created.data, error: refreshed.error };
}

/** Speichert eine bestehende Einheit als Vorlage (ohne Termin/Nachbereitung). */
export async function saveSessionAsTemplate(
  sessionId: string,
  titleOverride?: string | null,
): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  return copyTrainingSession({
    sourceId: sessionId,
    mode: 'template',
    title: titleOverride,
  });
}

/** Erzeugt eine Session aus einer Vorlage für einen bestehenden Termin. */
export async function applyTemplateToEvent(input: {
  templateId: string;
  eventId: string;
}): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  const tpl = await getTrainingSession(input.templateId);
  if (tpl.error || !tpl.data) return { data: null, error: tpl.error ?? 'Vorlage nicht gefunden.' };
  if (tpl.data.record_type !== 'template') {
    return { data: null, error: 'Die gewählte Einheit ist keine Vorlage.' };
  }
  return copyTrainingSession({
    sourceId: input.templateId,
    mode: 'event',
    eventId: input.eventId,
    title: tpl.data.title.replace(/^Vorlage:\s*/i, '').trim() || tpl.data.title,
  });
}

export async function listTrainingTemplates(opts: {
  clubId: string;
  includeArchived?: boolean;
}): Promise<{ data: TrainingSessionRow[]; error: string | null }> {
  let q = supabase
    .from('training_sessions')
    .select('*')
    .eq('club_id', opts.clubId)
    .eq('record_type', 'template')
    .order('updated_at', { ascending: false });
  if (!opts.includeArchived) q = q.neq('status', 'archived');
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  // map via getTrainingSession path — use list helper from sessions after types updated
  const { mapSessionRow } = await import('./trainingSessions');
  return {
    data: (data ?? []).map((r) => mapSessionRow(r as Record<string, unknown>)),
    error: null,
  };
}

export async function countTemplateUsages(
  templateId: string,
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from('training_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId)
    .eq('record_type', 'session');
  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0, error: null };
}

export async function archiveTrainingTemplate(
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
    .eq('id', id)
    .eq('record_type', 'template');
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function saveTrainingDocumentation(
  sessionId: string,
  patch: {
    actualDurationMinutes?: number | null;
    reviewRating?: TrainingReviewRating | null;
    reviewNotes?: string | null;
    workedWell?: string | null;
    needsImprovement?: string | null;
    repeatNextTime?: boolean;
  },
): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  return updateTrainingSession(sessionId, {
    actualDurationMinutes: patch.actualDurationMinutes,
    reviewRating: patch.reviewRating,
    reviewNotes: patch.reviewNotes,
    workedWell: patch.workedWell,
    needsImprovement: patch.needsImprovement,
    repeatNextTime: patch.repeatNextTime,
  });
}

export async function updateExerciseReview(
  exerciseRowId: string,
  patch: {
    wasCompleted?: boolean | null;
    actualDurationMinutes?: number | null;
    reviewStatus?: TrainingExerciseReviewStatus | null;
    reviewNotes?: string | null;
    repeatRecommended?: boolean;
  },
): Promise<{ data: TrainingSessionExerciseRow | null; error: string | null }> {
  return updateSessionExercise(exerciseRowId, {
    wasCompleted: patch.wasCompleted,
    actualDurationMinutes: patch.actualDurationMinutes,
    reviewStatus: patch.reviewStatus,
    reviewNotes: patch.reviewNotes,
    repeatRecommended: patch.repeatRecommended,
  });
}

export async function completeTrainingSession(
  sessionId: string,
  userId: string,
  opts?: { actualDurationMinutes?: number | null },
): Promise<{ data: TrainingSessionRow | null; error: string | null }> {
  const cur = await getTrainingSession(sessionId);
  if (cur.error || !cur.data) return { data: null, error: cur.error ?? 'Einheit nicht gefunden.' };
  if (cur.data.record_type === 'template') {
    return { data: null, error: 'Vorlagen können nicht abgeschlossen werden.' };
  }
  if (cur.data.status === 'completed') {
    return { data: cur.data, error: null };
  }
  return updateTrainingSession(sessionId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    completedBy: userId,
    actualDurationMinutes:
      opts?.actualDurationMinutes !== undefined
        ? opts.actualDurationMinutes
        : cur.data.actual_duration_minutes,
  });
}

export type ChronicleFilters = {
  teamSeasonId?: string | null;
  clubId?: string | null;
  status?: TrainingSessionStatus | 'all';
  focus?: ExerciseFocus | 'all';
  fromIso?: string | null;
  toIso?: string | null;
  repeatOnly?: boolean;
  includeArchivedSeasons?: boolean;
};

export async function listChronicleSessions(
  filters: ChronicleFilters,
): Promise<{ data: TrainingSessionRow[]; error: string | null }> {
  let q = supabase
    .from('training_sessions')
    .select('*')
    .eq('record_type', 'session')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false });

  if (filters.teamSeasonId) q = q.eq('team_season_id', filters.teamSeasonId);
  if (filters.clubId) q = q.eq('club_id', filters.clubId);
  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  else q = q.in('status', ['completed', 'ready', 'draft']);
  if (filters.focus && filters.focus !== 'all') q = q.eq('focus', filters.focus);
  if (filters.repeatOnly) q = q.eq('repeat_next_time', true);
  if (filters.fromIso) q = q.gte('completed_at', filters.fromIso);
  if (filters.toIso) q = q.lte('completed_at', filters.toIso);

  const { data, error } = await q.limit(200);
  if (error) return { data: [], error: error.message };
  const { mapSessionRow } = await import('./trainingSessions');
  let rows = (data ?? []).map((r) => mapSessionRow(r as Record<string, unknown>));
  // Chronik: bevorzugt abgeschlossene; ready/draft nur wenn completed_at gesetzt oder Status completed
  rows = rows.filter((r) => r.status === 'completed' || Boolean(r.completed_at));
  return { data: rows, error: null };
}

export function isActivePlanStatus(status: TrainingSessionStatus): boolean {
  return status === 'draft' || status === 'ready';
}

export function parseReviewRating(v: unknown): TrainingReviewRating | null {
  const s = String(v ?? '');
  if (s === 'excellent' || s === 'good' || s === 'partial' || s === 'off_plan') return s;
  return null;
}

export function parseExerciseReviewStatus(v: unknown): TrainingExerciseReviewStatus | null {
  const s = String(v ?? '');
  if (s === 'worked_well' || s === 'adapted' || s === 'not_done' || s === 'repeat') return s;
  return null;
}

export function parseRecordType(v: unknown): TrainingRecordType {
  return String(v ?? '') === 'template' ? 'template' : 'session';
}

export { isTrainingSessionStatus };
