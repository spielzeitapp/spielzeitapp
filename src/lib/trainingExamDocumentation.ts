import { supabase } from './supabaseClient';
import type { TrainingPhase } from './trainingPhases';

export type TrainingExamPhaseText = {
  content?: string;
  materials?: string;
  coaching?: string;
  useOriginal?: boolean;
};

export type TrainingExamPhaseTextOverrides = Partial<Record<TrainingPhase, TrainingExamPhaseText>>;

export type TrainingExamDocumentationRow = {
  id: string;
  club_id: string;
  team_season_id: string;
  title: string;
  required_units: number;
  deadline: string | null;
  export_version: number;
  last_exported_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  trainer_name: string;
};

export type TrainingExamDocumentationItemRow = {
  id: string;
  documentation_id: string;
  training_session_id: string;
  sort_order: number;
  created_at: string;
  focus_override: string | null;
  team_name_override: string | null;
  training_date_override: string | null;
  phase_text_overrides: TrainingExamPhaseTextOverrides;
  included_in_pdf: boolean;
  updated_at: string;
};

export type TrainingExamDocumentationBundle = {
  documentation: TrainingExamDocumentationRow;
  items: TrainingExamDocumentationItemRow[];
};

const DOCUMENT_SELECT =
  'id, club_id, team_season_id, title, required_units, deadline, export_version, last_exported_at, created_by, created_at, updated_at, trainer_name';
const ITEM_SELECT = 'id, documentation_id, training_session_id, sort_order, created_at, updated_at, focus_override, team_name_override, training_date_override, phase_text_overrides, included_in_pdf';

function mapPhaseTextOverrides(raw: unknown): TrainingExamPhaseTextOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const result: TrainingExamPhaseTextOverrides = {};
  for (const phase of ['AW', 'HT1', 'HT2', 'AK'] as TrainingPhase[]) {
    const value = source[phase];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const fields = value as Record<string, unknown>;
    result[phase] = {
      ...(typeof fields.content === 'string' ? { content: fields.content } : {}),
      ...(typeof fields.materials === 'string' ? { materials: fields.materials } : {}),
      ...(typeof fields.coaching === 'string' ? { coaching: fields.coaching } : {}),
      ...(typeof fields.useOriginal === 'boolean' ? { useOriginal: fields.useOriginal } : {}),
    };
  }
  return result;
}

function mapDocument(raw: Record<string, unknown>): TrainingExamDocumentationRow {
  return {
    id: String(raw.id),
    club_id: String(raw.club_id),
    team_season_id: String(raw.team_season_id),
    title: String(raw.title ?? 'ÖFB-D-Diplom Dokumentation'),
    required_units: Number(raw.required_units) || 10,
    deadline: (raw.deadline as string | null) ?? null,
    export_version: Number(raw.export_version) || 0,
    last_exported_at: (raw.last_exported_at as string | null) ?? null,
    created_by: String(raw.created_by),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    trainer_name: String(raw.trainer_name ?? ''),
  };
}

function mapItem(raw: Record<string, unknown>): TrainingExamDocumentationItemRow {
  return {
    id: String(raw.id),
    documentation_id: String(raw.documentation_id),
    training_session_id: String(raw.training_session_id),
    sort_order: Number(raw.sort_order) || 0,
    created_at: String(raw.created_at),
    focus_override: (raw.focus_override as string | null) ?? null,
    team_name_override: (raw.team_name_override as string | null) ?? null,
    training_date_override: (raw.training_date_override as string | null) ?? null,
    phase_text_overrides: mapPhaseTextOverrides(raw.phase_text_overrides),
    included_in_pdf: raw.included_in_pdf !== false,
    updated_at: String(raw.updated_at ?? raw.created_at),
  };
}

export async function getOrCreateTrainingExamDocumentation(input: {
  clubId: string;
  teamSeasonId: string;
  deadline?: string | null;
}): Promise<{ data: TrainingExamDocumentationBundle | null; error: string | null }> {
  const existing = await supabase
    .from('training_exam_documentations')
    .select(DOCUMENT_SELECT)
    .eq('team_season_id', input.teamSeasonId)
    .maybeSingle();
  if (existing.error) return { data: null, error: existing.error.message };

  let documentation = existing.data
    ? mapDocument(existing.data as Record<string, unknown>)
    : null;
  if (!documentation) {
    const created = await supabase
      .from('training_exam_documentations')
      .insert({
        club_id: input.clubId,
        team_season_id: input.teamSeasonId,
        title: 'ÖFB-D-Diplom Dokumentation',
        required_units: 10,
        deadline: input.deadline ?? '2026-09-07',
      })
      .select(DOCUMENT_SELECT)
      .single();
    if (created.error || !created.data) {
      return { data: null, error: created.error?.message ?? 'Dokumentation konnte nicht angelegt werden.' };
    }
    documentation = mapDocument(created.data as Record<string, unknown>);
  }

  const itemResult = await supabase
    .from('training_exam_documentation_items')
    .select(ITEM_SELECT)
    .eq('documentation_id', documentation.id)
    .order('sort_order', { ascending: true });
  if (itemResult.error) return { data: null, error: itemResult.error.message };
  return {
    data: {
      documentation,
      items: (itemResult.data ?? []).map((row) => mapItem(row as Record<string, unknown>)),
    },
    error: null,
  };
}

export async function addTrainingExamSession(
  documentationId: string,
  trainingSessionId: string,
  sortOrder: number,
  includedInPdf = true,
): Promise<{ data: TrainingExamDocumentationItemRow | null; error: string | null }> {
  const result = await supabase
    .from('training_exam_documentation_items')
    .insert({
      documentation_id: documentationId,
      training_session_id: trainingSessionId,
      sort_order: sortOrder,
      included_in_pdf: includedInPdf,
    })
    .select(ITEM_SELECT)
    .single();
  if (result.error) return { data: null, error: result.error.message };
  return { data: mapItem(result.data as Record<string, unknown>), error: null };
}

export async function updateTrainingExamRequiredUnits(
  documentationId: string,
  requiredUnits: number,
): Promise<{ requiredUnits: number; error: string | null }> {
  const normalized = Math.max(1, Math.min(10, Math.round(requiredUnits)));
  const result = await supabase
    .from('training_exam_documentations')
    .update({ required_units: normalized, updated_at: new Date().toISOString() })
    .eq('id', documentationId)
    .select('required_units')
    .single();
  if (result.error || !result.data) {
    return { requiredUnits, error: result.error?.message ?? 'Zielanzahl konnte nicht gespeichert werden.' };
  }
  return { requiredUnits: Number(result.data.required_units) || normalized, error: null };
}

export async function updateTrainingExamItemIncluded(
  itemId: string,
  includedInPdf: boolean,
): Promise<{ data: TrainingExamDocumentationItemRow | null; error: string | null }> {
  const result = await supabase
    .from('training_exam_documentation_items')
    .update({ included_in_pdf: includedInPdf, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select(ITEM_SELECT)
    .single();
  if (result.error || !result.data) {
    return { data: null, error: result.error?.message ?? 'PDF-Auswahl konnte nicht gespeichert werden.' };
  }
  return { data: mapItem(result.data as Record<string, unknown>), error: null };
}

export async function updateTrainingExamTrainerName(
  documentationId: string,
  trainerName: string,
): Promise<{ error: string | null }> {
  const result = await supabase
    .from('training_exam_documentations')
    .update({ trainer_name: trainerName.trim(), updated_at: new Date().toISOString() })
    .eq('id', documentationId);
  return { error: result.error?.message ?? null };
}

export async function updateTrainingExamSessionMetadata(
  itemId: string,
  values: {
    focusOverride: string | null;
    teamNameOverride: string | null;
    trainingDateOverride: string | null;
    phaseTextOverrides: TrainingExamPhaseTextOverrides;
  },
): Promise<{ data: TrainingExamDocumentationItemRow | null; error: string | null }> {
  const result = await supabase
    .from('training_exam_documentation_items')
    .update({
      focus_override: values.focusOverride?.trim() || null,
      team_name_override: values.teamNameOverride?.trim() || null,
      training_date_override: values.trainingDateOverride || null,
      phase_text_overrides: values.phaseTextOverrides,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select(ITEM_SELECT)
    .single();
  if (result.error || !result.data) return { data: null, error: result.error?.message ?? 'Prüfungsangaben konnten nicht gespeichert werden.' };
  return { data: mapItem(result.data as Record<string, unknown>), error: null };
}

export async function removeTrainingExamSession(itemId: string): Promise<{ error: string | null }> {
  const result = await supabase.from('training_exam_documentation_items').delete().eq('id', itemId);
  return { error: result.error?.message ?? null };
}

export async function reorderTrainingExamSessions(
  documentationId: string,
  orderedItems: TrainingExamDocumentationItemRow[],
): Promise<{ data: TrainingExamDocumentationItemRow[]; error: string | null }> {
  // Temporäre Werte verhindern Konflikte mit UNIQUE(documentation_id, sort_order).
  for (let index = 0; index < orderedItems.length; index += 1) {
    const temporary = await supabase
      .from('training_exam_documentation_items')
      .update({ sort_order: 10 + index })
      .eq('id', orderedItems[index].id)
      .eq('documentation_id', documentationId);
    if (temporary.error) return { data: orderedItems, error: temporary.error.message };
  }
  for (let index = 0; index < orderedItems.length; index += 1) {
    const saved = await supabase
      .from('training_exam_documentation_items')
      .update({ sort_order: index })
      .eq('id', orderedItems[index].id)
      .eq('documentation_id', documentationId);
    if (saved.error) return { data: orderedItems, error: saved.error.message };
  }
  return {
    data: orderedItems.map((item, index) => ({ ...item, sort_order: index })),
    error: null,
  };
}

export async function markTrainingExamExported(
  documentationId: string,
  currentVersion: number,
): Promise<{ version: number; exportedAt: string | null; error: string | null }> {
  const exportedAt = new Date().toISOString();
  const version = currentVersion + 1;
  const result = await supabase
    .from('training_exam_documentations')
    .update({ export_version: version, last_exported_at: exportedAt, updated_at: exportedAt })
    .eq('id', documentationId)
    .select('export_version, last_exported_at')
    .single();
  if (result.error) return { version: currentVersion, exportedAt: null, error: result.error.message };
  return {
    version: Number(result.data.export_version) || version,
    exportedAt: (result.data.last_exported_at as string | null) ?? exportedAt,
    error: null,
  };
}
