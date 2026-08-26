import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Eye, FileDown, Loader2, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { supabase } from '../lib/supabaseClient';
import {
  addTrainingExamSession,
  getOrCreateTrainingExamDocumentation,
  markTrainingExamExported,
  removeTrainingExamSession,
  reorderTrainingExamSessions,
  updateTrainingExamSessionMetadata,
  updateTrainingExamTrainerName,
  type TrainingExamDocumentationBundle,
  type TrainingExamDocumentationItemRow,
  type TrainingExamPhaseText,
} from '../lib/trainingExamDocumentation';
import {
  createTrainingExamPdf,
  downloadBlob,
  trainingExamPdfFilename,
  type TrainingExamPdfSession,
} from '../lib/trainingExamPdfExport';
import { getTrainingExerciseSketchUrl, type TrainingExerciseRow } from '../lib/trainingExercises';
import { listSessionExercises, type TrainingSessionExerciseRow, type TrainingSessionRow } from '../lib/trainingSessions';
import { TRAINING_PHASES, type TrainingPhase } from '../lib/trainingPhases';
import {
  createTrainingExerciseOriginalText,
  resolveTrainingExerciseShortText,
  TRAINING_SHORT_TEXT_LIMITS,
} from '../lib/trainingExerciseShortText';
import { resolveClubIdForTeamSeason } from '../lib/venues';

type SessionDetails = {
  items: TrainingSessionExerciseRow[];
  exerciseMap: Record<string, TrainingExerciseRow>;
  missing: string[];
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('de-AT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function inspectSession(items: TrainingSessionExerciseRow[]): SessionDetails {
  const exerciseMap: Record<string, TrainingExerciseRow> = {};
  for (const item of items) {
    if (item.exercise) exerciseMap[item.exercise_id] = item.exercise;
  }
  const missing: string[] = [];
  for (const phase of TRAINING_PHASES) {
    if (!items.some((item) => item.phase === phase)) missing.push(`${phase} fehlt`);
  }
  for (const item of items) {
    const exercise = exerciseMap[item.exercise_id];
    if (!exercise) {
      missing.push('Übungsdaten fehlen');
      continue;
    }
    if (!exercise.image_path) missing.push(`Skizze fehlt: ${exercise.title}`);
    if (!String(exercise.organization ?? '').trim()) missing.push(`Aufbau fehlt: ${exercise.title}`);
    if (!String(exercise.materials ?? '').trim()) missing.push(`Geräte fehlen: ${exercise.title}`);
    if (!String(exercise.coaching_points ?? '').trim()) missing.push(`Coachingpunkte fehlen: ${exercise.title}`);
  }
  return { items, exerciseMap, missing: [...new Set(missing)] };
}

function cleanExamText(value: unknown): string {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function withoutExamVideo(value: unknown): string {
  return cleanExamText(value)
    .split('\n')
    .filter((line) => !/^video\s*:/i.test(line.trim()) && !/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)/i.test(line))
    .join('\n')
    .trim();
}

type ExamPhaseTextValues = { content: string; materials: string; coaching: string };

function defaultPhaseText(details: SessionDetails | undefined, phase: TrainingPhase): ExamPhaseTextValues {
  const content: string[] = [];
  const materials: string[] = [];
  const coaching: string[] = [];
  const phaseItems = (details?.items ?? [])
    .filter((item) => item.phase === phase)
    .sort((left, right) => left.sort_order - right.sort_order);
  for (const item of phaseItems) {
    const exercise = details?.exerciseMap[item.exercise_id] ?? item.exercise ?? null;
    if (!exercise) continue;
    const shortText = resolveTrainingExerciseShortText({
      description: exercise.description,
      organization: exercise.organization,
      materials: exercise.materials,
      coachingPoints: exercise.coaching_points,
      variations: exercise.variations,
      shortContent: exercise.short_content,
      shortMaterials: exercise.short_materials,
      shortCoaching: exercise.short_coaching,
    });
    if (shortText.content) content.push(shortText.content);
    if (shortText.materials) materials.push(shortText.materials);
    if (shortText.coaching) coaching.push(withoutExamVideo(shortText.coaching));
  }
  return {
    content: content.filter(Boolean).join('\n\n'),
    materials: materials.filter(Boolean).join('\n'),
    coaching: coaching.filter(Boolean).join('\n\n'),
  };
}

function originalPhaseText(details: SessionDetails | undefined, phase: TrainingPhase): ExamPhaseTextValues {
  const content: string[] = [];
  const materials: string[] = [];
  const coaching: string[] = [];
  const phaseItems = (details?.items ?? [])
    .filter((item) => item.phase === phase)
    .sort((left, right) => left.sort_order - right.sort_order);
  for (const item of phaseItems) {
    const exercise = details?.exerciseMap[item.exercise_id] ?? item.exercise ?? null;
    if (!exercise) continue;
    const original = createTrainingExerciseOriginalText({
      description: exercise.description,
      organization: exercise.organization,
      materials: exercise.materials,
      coachingPoints: exercise.coaching_points,
      variations: exercise.variations,
    });
    if (original.content) content.push(original.content);
    if (original.materials) materials.push(original.materials);
    if (original.coaching) coaching.push(withoutExamVideo(original.coaching));
  }
  return {
    content: content.join('\n\n'),
    materials: materials.join('\n'),
    coaching: coaching.join('\n\n'),
  };
}

function textFitLabel(length: number, recommended: number): { label: string; className: string } {
  if (length <= recommended) return { label: 'Passt', className: 'bg-emerald-50 text-emerald-700' };
  if (length <= Math.round(recommended * 1.2)) return { label: 'Knapp', className: 'bg-amber-50 text-amber-800' };
  return { label: 'Zu lang', className: 'bg-red-50 text-red-700' };
}

export function ManagerTrainingExamPanel({
  sessions,
  teamSeasonId,
}: {
  sessions: TrainingSessionRow[];
  teamSeasonId: string | null | undefined;
  seasonArchived: boolean;
}): React.ReactElement {
  const { user, selectedTeamSeason, viewTeamSeason } = useSession();
  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const [bundle, setBundle] = useState<TrainingExamDocumentationBundle | null>(null);
  const [details, setDetails] = useState<Record<string, SessionDetails>>({});
  const [eventDates, setEventDates] = useState<Record<string, string>>({});
  const [candidateId, setCandidateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<'preview' | 'download' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const defaultTrainerName =
    String(metadata.full_name ?? metadata.name ?? '').trim() || user?.email?.split('@')[0] || '';
  const defaultTeamName =
    String(contextSeason?.display_name ?? contextSeason?.age_group ?? contextSeason?.team?.name ?? '').trim();

  const sessionById = useMemo(
    () => Object.fromEntries(sessions.map((session) => [session.id, session])),
    [sessions],
  );
  const selectedItems = useMemo(() => bundle?.items ?? [], [bundle?.items]);
  const selectedSessions = useMemo(
    () => selectedItems.map((item) => sessionById[item.training_session_id]).filter(Boolean),
    [selectedItems, sessionById],
  );
  const candidates = useMemo(() => {
    const selected = new Set(selectedItems.map((item) => item.training_session_id));
    return sessions
      .filter((session) => session.record_type !== 'template')
      .filter((session) => !selected.has(session.id))
      .sort((left, right) => String(right.updated_at ?? '').localeCompare(String(left.updated_at ?? '')));
  }, [selectedItems, sessions]);

  const load = useCallback(async () => {
    if (!teamSeasonId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const club = await resolveClubIdForTeamSeason(teamSeasonId);
    if (!club.clubId) {
      setError(club.error ?? 'Verein konnte nicht ermittelt werden.');
      setLoading(false);
      return;
    }
    const result = await getOrCreateTrainingExamDocumentation({
      clubId: club.clubId,
      teamSeasonId,
      deadline: '2026-09-07',
    });
    if (result.error || !result.data) {
      setError(
        result.error?.includes('training_exam_')
          ? 'Die Trainerprüfungs-Migration ist auf dieser Umgebung noch nicht angewendet.'
          : result.error ?? 'Dokumentation konnte nicht geladen werden.',
      );
      setBundle(null);
      setLoading(false);
      return;
    }
    setBundle(result.data);
    setLoading(false);
  }, [teamSeasonId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    const ids = selectedItems.map((item) => item.training_session_id);
    if (ids.length === 0) {
      setDetails({});
      return () => {
        active = false;
      };
    }
    void Promise.all(
      ids.map(async (sessionId) => {
        const result = await listSessionExercises(sessionId);
        return [sessionId, inspectSession(result.data)] as const;
      }),
    ).then((entries) => {
      if (active) setDetails(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [selectedItems]);

  useEffect(() => {
    let active = true;
    const eventIds = selectedSessions.map((session) => session.event_id).filter((id): id is string => Boolean(id));
    if (eventIds.length === 0) {
      setEventDates({});
      return () => {
        active = false;
      };
    }
    void supabase
      .from('events')
      .select('id, starts_at')
      .in('id', eventIds)
      .then(({ data }) => {
        if (active) {
          setEventDates(Object.fromEntries((data ?? []).map((row) => [String(row.id), String(row.starts_at)])));
        }
      });
    return () => {
      active = false;
    };
  }, [selectedSessions]);

  async function addCandidate() {
    if (!bundle || !candidateId) return;
    if (bundle.items.length >= bundle.documentation.required_units) {
      setError(`Es können höchstens ${bundle.documentation.required_units} Einheiten ausgewählt werden.`);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const result = await addTrainingExamSession(bundle.documentation.id, candidateId, bundle.items.length);
    setSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? 'Einheit konnte nicht hinzugefügt werden.');
      return;
    }
    setBundle({ ...bundle, items: [...bundle.items, result.data] });
    setCandidateId('');
    setSuccess('Trainingseinheit zur Prüfungsdokumentation hinzugefügt.');
  }

  async function removeItem(item: TrainingExamDocumentationItemRow) {
    if (!bundle || !window.confirm('Diese Einheit aus der Prüfungsdokumentation entfernen? Die Trainingseinheit selbst bleibt erhalten.')) return;
    setSaving(true);
    setError(null);
    const removed = await removeTrainingExamSession(item.id);
    if (removed.error) {
      setSaving(false);
      setError(removed.error);
      return;
    }
    const remaining = bundle.items.filter((candidate) => candidate.id !== item.id);
    const reordered = await reorderTrainingExamSessions(bundle.documentation.id, remaining);
    setSaving(false);
    if (reordered.error) {
      setError(reordered.error);
      void load();
      return;
    }
    setBundle({ ...bundle, items: reordered.data });
  }

  async function moveItem(index: number, direction: -1 | 1) {
    if (!bundle) return;
    const target = index + direction;
    if (target < 0 || target >= bundle.items.length) return;
    const next = [...bundle.items];
    [next[index], next[target]] = [next[target], next[index]];
    setSaving(true);
    setError(null);
    const reordered = await reorderTrainingExamSessions(bundle.documentation.id, next);
    setSaving(false);
    if (reordered.error) {
      setError(reordered.error);
      return;
    }
    setBundle({ ...bundle, items: reordered.data });
  }

  function updateItemLocal(itemId: string, patch: Partial<TrainingExamDocumentationItemRow>) {
    setBundle((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
          }
        : current,
    );
  }

  function updatePhaseText(
    item: TrainingExamDocumentationItemRow,
    phase: TrainingPhase,
    field: 'content' | 'materials' | 'coaching',
    value: string,
  ) {
    updateItemLocal(item.id, {
      phase_text_overrides: {
        ...item.phase_text_overrides,
        [phase]: {
          ...item.phase_text_overrides[phase],
          [field]: value,
        },
      },
    });
  }

  function resetPhaseText(item: TrainingExamDocumentationItemRow, phase: TrainingPhase) {
    const next = { ...item.phase_text_overrides };
    const useOriginal = next[phase]?.useOriginal !== false;
    if (useOriginal) delete next[phase];
    else next[phase] = { useOriginal: false };
    updateItemLocal(item.id, { phase_text_overrides: next });
    void saveItemMetadata(item.id, next);
  }

  function setPhaseTextMode(item: TrainingExamDocumentationItemRow, phase: TrainingPhase, useOriginal: boolean) {
    const next = {
      ...item.phase_text_overrides,
      [phase]: {
        ...item.phase_text_overrides[phase],
        useOriginal,
      },
    };
    updateItemLocal(item.id, { phase_text_overrides: next });
    void saveItemMetadata(item.id, next);
  }

  async function saveItemMetadata(
    itemId: string,
    phaseTextOverrides?: TrainingExamDocumentationItemRow['phase_text_overrides'],
  ) {
    const current = bundle?.items.find((item) => item.id === itemId);
    if (!current) return;
    setSaving(true);
    setError(null);
    const result = await updateTrainingExamSessionMetadata(itemId, {
      focusOverride: current.focus_override,
      teamNameOverride: current.team_name_override,
      trainingDateOverride: current.training_date_override,
      phaseTextOverrides: phaseTextOverrides ?? current.phase_text_overrides,
    });
    setSaving(false);
    if (result.error || !result.data) {
      setError(result.error ?? 'Prüfungsangaben konnten nicht gespeichert werden.');
      return;
    }
    updateItemLocal(itemId, result.data);
    setSuccess('Prüfungsangaben gespeichert.');
  }

  async function saveTrainerName() {
    if (!bundle) return;
    const trainerName = bundle.documentation.trainer_name.trim() || defaultTrainerName;
    setSaving(true);
    setError(null);
    const result = await updateTrainingExamTrainerName(bundle.documentation.id, trainerName);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBundle({
      ...bundle,
      documentation: { ...bundle.documentation, trainer_name: trainerName },
    });
    setSuccess('Trainername gespeichert.');
  }

  async function buildPdfEntries(): Promise<TrainingExamPdfSession[]> {
    const result: TrainingExamPdfSession[] = [];
    for (const item of selectedItems) {
      const session = sessionById[item.training_session_id];
      if (!session) continue;
      const sessionDetails = details[session.id] ?? inspectSession((await listSessionExercises(session.id)).data);
      const sketchEntries = await Promise.all(
        Object.values(sessionDetails.exerciseMap).map(async (exercise) => [
          exercise.id,
          exercise.image_path ? await getTrainingExerciseSketchUrl(exercise.image_path) : null,
        ] as const),
      );
      result.push({
        session,
        items: sessionDetails.items,
        exerciseMap: sessionDetails.exerciseMap,
        eventDateIso: session.event_id ? eventDates[session.event_id] ?? null : session.created_at,
        sketchUrls: Object.fromEntries(sketchEntries),
        examFocus: item.focus_override?.trim() || session.objective?.trim() || session.title,
        examTeamName: item.team_name_override?.trim() || defaultTeamName,
        examDateIso:
          item.training_date_override ??
          (session.event_id ? eventDates[session.event_id] ?? null : session.created_at),
        examNumber: item.sort_order + 1,
        phaseTextOverrides: item.phase_text_overrides,
      });
    }
    return result;
  }

  async function exportPdf(mode: 'preview' | 'download') {
    if (!bundle || selectedItems.length === 0) return;
    const previewWindow = mode === 'preview' ? window.open('', '_blank') : null;
    if (mode === 'preview' && !previewWindow) {
      setError('PDF-Vorschau wurde blockiert. Bitte Pop-ups für diese Seite erlauben.');
      return;
    }
    if (previewWindow) previewWindow.document.write('<p style="font-family:Arial;padding:24px">Prüfungs-PDF wird erstellt…</p>');
    setExporting(mode);
    setError(null);
    setSuccess(null);
    try {
      const trainerName = bundle.documentation.trainer_name.trim() || defaultTrainerName;
      const entries = await buildPdfEntries();
      const blob = await createTrainingExamPdf({
        sessions: entries,
        trainerName,
        version: bundle.documentation.export_version + 1,
      });
      if (mode === 'preview' && previewWindow) {
        const url = URL.createObjectURL(blob);
        previewWindow.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const isFinal = selectedItems.length === bundle.documentation.required_units;
        if (isFinal) {
          const marked = await markTrainingExamExported(
            bundle.documentation.id,
            bundle.documentation.export_version,
          );
          if (marked.error) throw new Error(marked.error);
          downloadBlob(blob, trainingExamPdfFilename(marked.version, false, selectedItems.length));
          setBundle({
            ...bundle,
            documentation: {
              ...bundle.documentation,
              export_version: marked.version,
              last_exported_at: marked.exportedAt,
            },
          });
          setSuccess(`Finale PDF-Version ${marked.version} mit ${selectedItems.length} Einheiten wurde erstellt.`);
        } else {
          downloadBlob(
            blob,
            trainingExamPdfFilename(bundle.documentation.export_version + 1, true, selectedItems.length),
          );
          setSuccess(`Test-PDF mit ${selectedItems.length} ${selectedItems.length === 1 ? 'Einheit' : 'Einheiten'} wurde erstellt.`);
        }
      }
    } catch (cause) {
      previewWindow?.close();
      setError(cause instanceof Error ? cause.message : 'PDF konnte nicht erstellt werden.');
    } finally {
      setExporting(null);
    }
  }

  if (loading) return <p className="text-[13px] text-slate-500">Trainerprüfungs-Dokumentation wird geladen…</p>;
  if (!teamSeasonId) return <p className="text-[13px] text-slate-500">Bitte zuerst eine Mannschaft und Saison auswählen.</p>;

  const required = bundle?.documentation.required_units ?? 10;
  const completeCount = selectedItems.filter((item) => (details[item.training_session_id]?.missing.length ?? 1) === 0).length;
  const changedSinceExport = bundle?.documentation.last_exported_at
    ? selectedItems.filter((item) => {
        const session = sessionById[item.training_session_id];
        return Math.max(
          new Date(session?.updated_at ?? session?.created_at ?? 0).getTime(),
          new Date(item.updated_at ?? item.created_at ?? 0).getTime(),
        ) > new Date(bundle.documentation.last_exported_at!).getTime();
      }).length
    : 0;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-600">ÖFB-D-Diplom</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Trainerprüfungs-Dokumentation</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-slate-600">
              Wähle und sortiere deine zehn Trainingseinheiten. Die Einheiten bleiben vollständig bearbeitbar;
              Vorschau und Download werden immer neu aus dem aktuellen Stand erzeugt.
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Fortschritt</p>
              <p className="mt-1 text-xl font-bold text-slate-950">{selectedItems.length} von {required}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Prüfbereit</p>
              <p className="mt-1 text-xl font-bold text-slate-950">{completeCount}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-red-100 bg-red-50 p-3 text-[12px] text-red-900">
              Abgabetermin: <strong>{formatDate(bundle?.documentation.deadline)}</strong>
              {bundle?.documentation.export_version ? ` · letzte PDF: V${bundle.documentation.export_version}` : ' · noch kein finaler Export'}
            </div>
          </div>
        </div>
      </div>

      {bundle ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <label className="block text-[12px] font-bold text-slate-700" htmlFor="exam-trainer-name">
            Trainername für alle PDF-Seiten
          </label>
          <input
            id="exam-trainer-name"
            value={bundle.documentation.trainer_name || defaultTrainerName}
            onChange={(event) =>
              setBundle({
                ...bundle,
                documentation: { ...bundle.documentation, trainer_name: event.target.value },
              })
            }
            onBlur={() => void saveTrainerName()}
            placeholder="z. B. Johannes Baumann"
            className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-950 sm:max-w-md"
          />
          <p className="mt-2 text-[11px] text-slate-500">Änderungen werden beim Verlassen des Feldes gespeichert.</p>
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">{success}</div> : null}
      {changedSinceExport > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          {changedSinceExport} {changedSinceExport === 1 ? 'Einheit wurde' : 'Einheiten wurden'} seit dem letzten Export geändert. Bitte PDF neu erzeugen.
        </div>
      ) : null}

      {bundle ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={candidateId}
              onChange={(event) => setCandidateId(event.target.value)}
              disabled={saving || selectedItems.length >= required}
              className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900"
            >
              <option value="">Trainingseinheit auswählen…</option>
              {candidates.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} · {session.planned_duration_minutes ?? 0} Min. · {session.status === 'ready' ? 'fertig' : session.status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void addCandidate()}
              disabled={!candidateId || saving || selectedItems.length >= required}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              Hinzufügen
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {selectedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-[13px] text-slate-500">
            Noch keine Einheit ausgewählt. Füge deine erste fertige Trainingseinheit hinzu.
          </div>
        ) : null}
        {selectedItems.map((item, index) => {
          const session = sessionById[item.training_session_id];
          if (!session) return null;
          const sessionDetails = details[session.id];
          const missing = sessionDetails?.missing ?? ['Prüfung wird geladen'];
          const ready = missing.length === 0;
          const changed = Boolean(
            bundle?.documentation.last_exported_at &&
              Math.max(
                new Date(session.updated_at ?? session.created_at ?? 0).getTime(),
                new Date(item.updated_at ?? item.created_at ?? 0).getTime(),
              ) >
                new Date(bundle.documentation.last_exported_at).getTime(),
          );
          const phases = new Set((sessionDetails?.items ?? []).map((exercise) => exercise.phase as TrainingPhase));
          return (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-lg font-bold text-white">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[16px] font-bold text-slate-950">{session.title}</h3>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                      {ready ? 'Prüfbereit' : `${missing.length} Hinweise`}
                    </span>
                    {changed ? <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">Seit Export geändert</span> : null}
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {session.planned_duration_minutes ?? 0} Min. · {formatDate(session.event_id ? eventDates[session.event_id] : session.created_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {TRAINING_PHASES.map((phase) => (
                      <span key={phase} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${phases.has(phase) ? 'bg-slate-100 text-slate-700' : 'bg-red-50 text-red-700'}`}>
                        {phase}{phases.has(phase) ? ' ✓' : ' fehlt'}
                      </span>
                    ))}
                  </div>
                  {!ready && sessionDetails ? <p className="mt-2 text-[11px] leading-5 text-amber-800">{missing.slice(0, 4).join(' · ')}{missing.length > 4 ? ` · +${missing.length - 4} weitere` : ''}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/manager/training/einheiten/${session.id}`} className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">Bearbeiten</Link>
                  <button type="button" onClick={() => void moveItem(index, -1)} disabled={index === 0 || saving} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 disabled:opacity-30" aria-label="Nach oben"><ArrowUp className="h-4 w-4" aria-hidden /></button>
                  <button type="button" onClick={() => void moveItem(index, 1)} disabled={index === selectedItems.length - 1 || saving} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 disabled:opacity-30" aria-label="Nach unten"><ArrowDown className="h-4 w-4" aria-hidden /></button>
                  <button type="button" onClick={() => void removeItem(item)} disabled={saving} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600 disabled:opacity-30" aria-label="Aus Dokumentation entfernen"><Trash2 className="h-4 w-4" aria-hidden /></button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
                <label className="text-[11px] font-bold text-slate-600">
                  Schwerpunkt
                  <input
                    value={item.focus_override ?? session.objective ?? session.title}
                    onChange={(event) => updateItemLocal(item.id, { focus_override: event.target.value })}
                    onBlur={() => void saveItemMetadata(item.id)}
                    className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 px-3 text-[13px] font-normal text-slate-950"
                    placeholder="z. B. Ballkontrolle und Passspiel"
                  />
                </label>
                <label className="text-[11px] font-bold text-slate-600">
                  Mannschaft
                  <input
                    value={item.team_name_override ?? defaultTeamName}
                    onChange={(event) => updateItemLocal(item.id, { team_name_override: event.target.value })}
                    onBlur={() => void saveItemMetadata(item.id)}
                    className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 px-3 text-[13px] font-normal text-slate-950"
                    placeholder="z. B. U11 SPG Rohrbach"
                  />
                </label>
                <label className="text-[11px] font-bold text-slate-600">
                  Trainingsdatum
                  <input
                    type="date"
                    value={item.training_date_override ?? dateInputValue(session.event_id ? eventDates[session.event_id] : session.created_at)}
                    onChange={(event) => updateItemLocal(item.id, { training_date_override: event.target.value || null })}
                    onBlur={() => void saveItemMetadata(item.id)}
                    className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 px-3 text-[13px] font-normal text-slate-950"
                  />
                </label>
              </div>
              <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70">
                <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-bold text-slate-900 marker:hidden">
                  PDF-Prüfungstexte auswählen
                  <span className="ml-2 text-[11px] font-normal text-slate-500">Nur für diese Prüfungsseite</span>
                </summary>
                <div className="space-y-3 border-t border-slate-200 p-3 sm:p-4">
                  <p className="text-[12px] leading-5 text-slate-600">
                    Standard ist immer der Originaltext aus der Übung. Eine gespeicherte Kurzfassung wird nur verwendet, wenn du sie für die jeweilige Phase bewusst auswählst.
                  </p>
                  {TRAINING_PHASES.map((phase) => {
                    const defaults = defaultPhaseText(sessionDetails, phase);
                    const originals = originalPhaseText(sessionDetails, phase);
                    const overrides = item.phase_text_overrides[phase] ?? {};
                    const shortValues = {
                      content: typeof overrides.content === 'string' ? overrides.content : defaults.content,
                      materials: typeof overrides.materials === 'string' ? overrides.materials : defaults.materials,
                      coaching: typeof overrides.coaching === 'string' ? overrides.coaching : defaults.coaching,
                    };
                    const useOriginal = overrides.useOriginal !== false;
                    const values = useOriginal ? originals : shortValues;
                    const hasCustomShortText = ['content', 'materials', 'coaching'].some(
                      (field) => typeof overrides[field as 'content' | 'materials' | 'coaching'] === 'string',
                    );
                    const contentFit = textFitLabel(values.content.length, TRAINING_SHORT_TEXT_LIMITS.content);
                    const materialsFit = textFitLabel(values.materials.length, TRAINING_SHORT_TEXT_LIMITS.materials);
                    const coachingFit = textFitLabel(values.coaching.length, TRAINING_SHORT_TEXT_LIMITS.coaching);
                    return (
                      <section key={phase} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h4 className="inline-flex h-7 min-w-11 items-center justify-center rounded-lg bg-red-600 px-2 text-[12px] font-bold text-white">
                            {phase}
                          </h4>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" aria-label={`PDF-Textmodus ${phase}`}>
                              <button
                                type="button"
                                onClick={() => setPhaseTextMode(item, phase, false)}
                                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${!useOriginal ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}
                              >
                                Kurzfassung
                              </button>
                              <button
                                type="button"
                                onClick={() => setPhaseTextMode(item, phase, true)}
                                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${useOriginal ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'}`}
                              >
                                Originaltext
                              </button>
                            </div>
                            {hasCustomShortText ? (
                              <button
                                type="button"
                                onClick={() => resetPhaseText(item, phase)}
                                className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                              >
                                Eigene Kurzfassung zurücksetzen
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <p className="mb-3 text-[11px] leading-4 text-slate-500">
                          {useOriginal
                            ? 'Für die PDF wird der ausführliche Originaltext verwendet. Ist er zu lang, erhältst du vor dem Export einen Hinweis. Deine Kurzfassung bleibt gespeichert.'
                            : 'Für die PDF wird bewusst die kompakte Fassung verwendet und kann hier angepasst werden.'}
                        </p>
                        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.7fr_1.1fr]">
                          <label className="text-[11px] font-bold text-slate-600">
                            Inhalt / Ablauf
                            <textarea
                              value={values.content}
                              onChange={(event) => updatePhaseText(item, phase, 'content', event.target.value)}
                              onBlur={() => void saveItemMetadata(item.id)}
                              readOnly={useOriginal}
                              rows={5}
                              className={`mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 text-[13px] font-normal leading-5 text-slate-950 ${useOriginal ? 'bg-slate-50' : 'bg-white'}`}
                            />
                            <span className="mt-1 flex items-center justify-between gap-2 font-normal">
                              <span className="text-slate-400">{values.content.length} Zeichen</span>
                              <span className={`rounded-full px-2 py-0.5 font-bold ${contentFit.className}`}>{contentFit.label}</span>
                            </span>
                          </label>
                          <label className="text-[11px] font-bold text-slate-600">
                            Geräte
                            <textarea
                              value={values.materials}
                              onChange={(event) => updatePhaseText(item, phase, 'materials', event.target.value)}
                              onBlur={() => void saveItemMetadata(item.id)}
                              readOnly={useOriginal}
                              rows={5}
                              className={`mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 text-[13px] font-normal leading-5 text-slate-950 ${useOriginal ? 'bg-slate-50' : 'bg-white'}`}
                            />
                            <span className="mt-1 flex items-center justify-between gap-2 font-normal">
                              <span className="text-slate-400">{values.materials.length} Zeichen</span>
                              <span className={`rounded-full px-2 py-0.5 font-bold ${materialsFit.className}`}>{materialsFit.label}</span>
                            </span>
                          </label>
                          <label className="text-[11px] font-bold text-slate-600">
                            Coachingpunkte
                            <textarea
                              value={values.coaching}
                              onChange={(event) => updatePhaseText(item, phase, 'coaching', event.target.value)}
                              onBlur={() => void saveItemMetadata(item.id)}
                              readOnly={useOriginal}
                              rows={5}
                              className={`mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 text-[13px] font-normal leading-5 text-slate-950 ${useOriginal ? 'bg-slate-50' : 'bg-white'}`}
                            />
                            <span className="mt-1 flex items-center justify-between gap-2 font-normal">
                              <span className="text-slate-400">{values.coaching.length} Zeichen</span>
                              <span className={`rounded-full px-2 py-0.5 font-bold ${coachingFit.className}`}>{coachingFit.label}</span>
                            </span>
                          </label>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </details>
            </article>
          );
        })}
      </div>

      {bundle && selectedItems.length > 0 ? (
        <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[12px] text-slate-600">
            <CheckCircle2 className={`h-5 w-5 ${selectedItems.length === required ? 'text-emerald-600' : 'text-slate-400'}`} aria-hidden />
            {selectedItems.length === required
              ? '10 Einheiten ausgewählt – finale Einreichungs-PDF möglich.'
              : `Test-PDF mit ${selectedItems.length} ${selectedItems.length === 1 ? 'Einheit' : 'Einheiten'} möglich · ${required - selectedItems.length} fehlen bis zur Abgabe.`}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void exportPdf('preview')} disabled={Boolean(exporting)} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[13px] font-semibold text-slate-800 disabled:opacity-50">
              {exporting === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              PDF-Vorschau
            </button>
            <button type="button" onClick={() => void exportPdf('download')} disabled={Boolean(exporting)} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {exporting === 'download' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileDown className="h-4 w-4" aria-hidden />}
              {selectedItems.length === required
                ? 'Gesamtdokumentation herunterladen'
                : `Test-PDF herunterladen (${selectedItems.length} ${selectedItems.length === 1 ? 'Seite' : 'Seiten'})`}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
