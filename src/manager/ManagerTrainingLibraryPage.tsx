/**
 * STEP 3A: Übungsbibliothek – Liste, Filter, Anlegen/Bearbeiten.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, ImagePlus, Plus, Search, Trash2 } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { resolveClubIdForTeamSeason } from '../lib/venues';
import {
  archiveTrainingExercise,
  countExerciseUsage,
  createTrainingExercise,
  getTrainingExerciseSketchUrl,
  listTrainingExercises,
  removeTrainingExerciseSketch,
  updateTrainingExercise,
  uploadTrainingExerciseSketch,
  type TrainingExerciseRow,
} from '../lib/trainingExercises';
import { analyzeTrainingExercisePdf } from '../lib/trainingExercisePdfImport';
import {
  EXERCISE_DIFFICULTY_LABELS,
  EXERCISE_FOCUS_LABELS,
  TRAINING_PHASE_LABELS,
  TRAINING_PHASES,
  type ExerciseDifficulty,
  type ExerciseFocus,
  type TrainingPhase,
} from '../lib/trainingPhases';

type FormState = {
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
  sourceReference: string;
};

const emptyForm = (): FormState => ({
  title: '',
  description: '',
  focus: 'technik',
  suitablePhases: ['HT1'],
  ageGroup: '',
  durationMinutes: 15,
  playerCountMin: '',
  playerCountMax: '',
  difficulty: 'medium',
  materials: '',
  organization: '',
  coachingPoints: '',
  variations: '',
  sourceReference: '',
});

function formFromRow(row: TrainingExerciseRow): FormState {
  return {
    title: row.title,
    description: row.description ?? '',
    focus: row.focus,
    suitablePhases: row.suitable_phases.length ? row.suitable_phases : ['HT1'],
    ageGroup: row.age_group ?? '',
    durationMinutes: row.duration_minutes,
    playerCountMin: row.player_count_min == null ? '' : String(row.player_count_min),
    playerCountMax: row.player_count_max == null ? '' : String(row.player_count_max),
    difficulty: row.difficulty,
    materials: row.materials ?? '',
    organization: row.organization ?? '',
    coachingPoints: row.coaching_points ?? '',
    variations: row.variations ?? '',
    sourceReference: row.source_reference ?? '',
  };
}

export function ManagerTrainingLibraryPage(): React.ReactElement {
  const { selectedTeamSeasonId, selectedTeamSeason, viewTeamSeason } = useSession();
  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;

  const [clubId, setClubId] = useState<string | null>(null);
  const [rows, setRows] = useState<TrainingExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('');
  const [focusFilter, setFocusFilter] = useState<string>('');
  const [ageFilter, setAgeFilter] = useState('');
  const [durationMax, setDurationMax] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingExerciseRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingSketch, setPendingSketch] = useState<Blob | null>(null);
  const [pendingSketchUrl, setPendingSketchUrl] = useState<string | null>(null);
  const [currentSketchUrl, setCurrentSketchUrl] = useState<string | null>(null);
  const [removeCurrentSketch, setRemoveCurrentSketch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sketchInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!teamSeasonId) {
      setClubId(null);
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
    if (clubRes.error || !clubRes.clubId) {
      setError(clubRes.error ?? 'Verein nicht ermittelbar.');
      setLoading(false);
      return;
    }
    setClubId(clubRes.clubId);
    const res = await listTrainingExercises(clubRes.clubId, { includeInactive: false });
    if (res.error) setError(res.error);
    setRows(res.data);
    setLoading(false);
  }, [teamSeasonId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(
    () => () => {
      if (pendingSketchUrl) URL.revokeObjectURL(pendingSketchUrl);
    },
    [pendingSketchUrl],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const age = ageFilter.trim().toLowerCase();
    const maxMin = durationMax.trim() ? Number(durationMax) : null;
    return rows.filter((r) => {
      if (query) {
        const hay = `${r.title} ${r.description ?? ''} ${r.materials ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (phaseFilter && !r.suitable_phases.includes(phaseFilter as TrainingPhase)) return false;
      if (focusFilter && r.focus !== focusFilter) return false;
      if (age && !(r.age_group ?? '').toLowerCase().includes(age)) return false;
      if (maxMin != null && !Number.isNaN(maxMin) && r.duration_minutes > maxMin) return false;
      return true;
    });
  }, [rows, q, phaseFilter, focusFilter, ageFilter, durationMax]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setPendingSketch(null);
    setPendingSketchUrl(null);
    setCurrentSketchUrl(null);
    setRemoveCurrentSketch(false);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (row: TrainingExerciseRow) => {
    setEditing(row);
    setForm(formFromRow(row));
    setPendingSketch(null);
    setPendingSketchUrl(null);
    setCurrentSketchUrl(null);
    setRemoveCurrentSketch(false);
    setFormError(null);
    setEditorOpen(true);
    if (row.image_path) {
      void getTrainingExerciseSketchUrl(row.image_path).then((url) => setCurrentSketchUrl(url));
    }
  };

  const selectSketch = async (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setFormError('Bitte ein PNG-, JPG- oder WebP-Bild auswählen.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormError('Das Bild darf höchstens 10 MB groß sein.');
      return;
    }
    try {
      const sketch = await imageFileToWebp(file);
      setPendingSketch(sketch);
      setPendingSketchUrl(URL.createObjectURL(sketch));
      setRemoveCurrentSketch(false);
      setFormError(null);
    } catch {
      setFormError('Das Bild konnte nicht verarbeitet werden.');
    } finally {
      if (sketchInputRef.current) sketchInputRef.current.value = '';
    }
  };

  const importPdf = async (file: File) => {
    setImporting(true);
    setError(null);
    try {
      const draft = await analyzeTrainingExercisePdf(file);
      setEditing(null);
      setForm((current) => ({ ...current, ...draft, difficulty: 'medium' }));
      setPendingSketch(draft.sketch);
      setPendingSketchUrl(draft.sketch ? URL.createObjectURL(draft.sketch) : null);
      setCurrentSketchUrl(null);
      setRemoveCurrentSketch(false);
      setFormError(null);
      setEditorOpen(true);
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'PDF konnte nicht analysiert werden.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const togglePhase = (phase: TrainingPhase) => {
    setForm((f) => {
      const has = f.suitablePhases.includes(phase);
      const next = has ? f.suitablePhases.filter((p) => p !== phase) : [...f.suitablePhases, phase];
      return { ...f, suitablePhases: next.length ? next : f.suitablePhases };
    });
  };

  const save = async () => {
    if (!clubId) return;
    setSaving(true);
    setFormError(null);
    let uploadedPath: string | null = null;
    if (pendingSketch) {
      const upload = await uploadTrainingExerciseSketch(clubId, pendingSketch);
      if (upload.error || !upload.path) {
        setSaving(false);
        setFormError(`Skizze konnte nicht gespeichert werden: ${upload.error ?? 'Unbekannter Fehler'}`);
        return;
      }
      uploadedPath = upload.path;
    }
    const payload = {
      clubId,
      title: form.title,
      description: form.description,
      focus: form.focus,
      suitablePhases: form.suitablePhases,
      ageGroup: form.ageGroup,
      durationMinutes: form.durationMinutes,
      playerCountMin: form.playerCountMin.trim() ? Number(form.playerCountMin) : null,
      playerCountMax: form.playerCountMax.trim() ? Number(form.playerCountMax) : null,
      difficulty: form.difficulty,
      materials: form.materials,
      organization: form.organization,
      coachingPoints: form.coachingPoints,
      variations: form.variations,
      imagePath: uploadedPath ?? (removeCurrentSketch ? null : editing?.image_path ?? null),
      sourceType: (form.sourceReference ? 'import' : editing?.source_type === 'import' ? 'import' : 'club') as
        | 'club'
        | 'import',
      sourceReference: form.sourceReference,
    };
    const res = editing
      ? await updateTrainingExercise(editing.id, payload)
      : await createTrainingExercise(payload);
    setSaving(false);
    if (res.error || !res.data) {
      if (uploadedPath) await removeTrainingExerciseSketch(uploadedPath);
      setFormError(res.error ?? 'Speichern fehlgeschlagen.');
      return;
    }
    if (editing?.image_path && (uploadedPath || removeCurrentSketch)) {
      await removeTrainingExerciseSketch(editing.image_path);
    }
    setEditorOpen(false);
    setPendingSketch(null);
    setPendingSketchUrl(null);
    setCurrentSketchUrl(null);
    setRemoveCurrentSketch(false);
    setToast(editing ? 'Übung aktualisiert.' : form.sourceReference ? 'PDF-Übung importiert.' : 'Übung angelegt.');
    await reload();
  };

  const archive = async (row: TrainingExerciseRow) => {
    const usage = await countExerciseUsage(row.id);
    const msg =
      usage.count > 0
        ? `Übung wird in ${usage.count} Einheit(en) verwendet. Archivieren (nicht löschen)?`
        : 'Übung archivieren?';
    if (!window.confirm(msg)) return;
    const res = await archiveTrainingExercise(row.id);
    if (res.error) {
      setToast(res.error);
      return;
    }
    setToast('Übung archiviert.');
    await reload();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Sport</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Übungsbibliothek</h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Vereinsübungen für Trainingseinheiten · {filtered.length} von {rows.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importPdf(file);
            }}
          />
          <button
            type="button"
            disabled={importing || !clubId}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileUp className="h-4 w-4" aria-hidden />
            {importing ? 'PDF wird gelesen…' : 'PDF importieren'}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Neue Übung
          </button>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6">
        <label className="relative sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suche…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-[13px]"
          />
        </label>
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px]"
          aria-label="Phase filtern"
        >
          <option value="">Alle Phasen</option>
          {TRAINING_PHASES.map((p) => (
            <option key={p} value={p}>
              {p} · {TRAINING_PHASE_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          value={focusFilter}
          onChange={(e) => setFocusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px]"
          aria-label="Schwerpunkt filtern"
        >
          <option value="">Alle Schwerpunkte</option>
          {Object.entries(EXERCISE_FOCUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value)}
            placeholder="Alter z. B. U12"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px]"
          />
          <input
            value={durationMax}
            onChange={(e) => setDurationMax(e.target.value)}
            placeholder="Max. Min."
            inputMode="numeric"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px]"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</div>
      ) : null}
      {loading ? <p className="text-[13px] text-slate-400">Bibliothek wird geladen…</p> : null}

      {!loading && filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
          <p className="text-[14px] font-medium text-slate-700">
            {rows.length === 0 ? 'Noch keine Übungen vorhanden.' : 'Keine passenden Suchergebnisse.'}
          </p>
          <p className="mt-1 text-[13px] text-slate-450 text-slate-500">
            {rows.length === 0
              ? 'Lege die erste Vereinsübung an – oder importiere später den eigenen Katalog.'
              : 'Filter zurücksetzen oder andere Suche versuchen.'}
          </p>
          {rows.length === 0 ? (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex rounded-full bg-red-700 px-4 py-2 text-[13px] font-semibold text-white"
            >
              Erste Übung anlegen
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((row) => (
            <li
              key={row.id}
              className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <TrainingExerciseImage path={row.image_path} title={row.title} />
              <h2 className="text-[15px] font-semibold text-slate-900">{row.title}</h2>
              <p className="mt-1 text-[12px] text-slate-500">
                {EXERCISE_FOCUS_LABELS[row.focus] ?? row.focus} · {row.duration_minutes} Min.
                {row.age_group ? ` · ${row.age_group}` : ''}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Phasen: {row.suitable_phases.join(', ')}
                {row.player_count_min != null || row.player_count_max != null
                  ? ` · ${row.player_count_min ?? '?'}–${row.player_count_max ?? '?'} Spieler`
                  : ''}
              </p>
              {row.materials ? (
                <p className="mt-2 line-clamp-2 text-[12px] text-slate-600">Material: {row.materials}</p>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  onClick={() => void archive(row)}
                  className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Archivieren
                </button>
                <Link
                  to={`/manager/training/einheiten/neu?exercise=${encodeURIComponent(row.id)}`}
                  className="rounded-full bg-red-700/10 px-3 py-1.5 text-[12px] font-semibold text-red-800 hover:bg-red-700/15"
                >
                  Zur Einheit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editorOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-editor-title"
          >
            <h2 id="exercise-editor-title" className="text-[16px] font-semibold text-slate-900">
              {editing ? 'Übung bearbeiten' : form.sourceReference ? 'PDF-Import prüfen' : 'Neue Übung'}
            </h2>
            {!editing && form.sourceReference ? (
              <p className="mt-1 text-[12px] text-amber-700">
                Vorschlag aus der PDF: Bitte alle Angaben und besonders die Trainingsphase prüfen.
              </p>
            ) : null}
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-slate-700">Skizze / Bild</span>
                  <span className="text-[11px] text-slate-400">PNG, JPG oder WebP · max. 10 MB</span>
                </div>
                {pendingSketchUrl || (currentSketchUrl && !removeCurrentSketch) ? (
                  <img
                    src={pendingSketchUrl ?? currentSketchUrl ?? ''}
                    alt="Vorschau der Übungsskizze"
                    className="mt-2 max-h-52 w-full rounded-xl border border-slate-200 bg-white object-contain"
                  />
                ) : (
                  <div className="mt-2 flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-[12px] text-slate-400">
                    Noch keine Skizze hinterlegt
                  </div>
                )}
                <input
                  ref={sketchInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void selectSketch(file);
                  }}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => sketchInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ImagePlus className="h-4 w-4" aria-hidden />
                    {pendingSketchUrl || (currentSketchUrl && !removeCurrentSketch)
                      ? 'Bild austauschen'
                      : 'Bild hochladen'}
                  </button>
                  {pendingSketchUrl || (currentSketchUrl && !removeCurrentSketch) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingSketch(null);
                        setPendingSketchUrl(null);
                        setRemoveCurrentSketch(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Bild entfernen
                    </button>
                  ) : null}
                </div>
              </div>
              <Field label="Titel *">
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                />
              </Field>
              <Field label="Kurzbeschreibung">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Schwerpunkt *">
                  <select
                    value={form.focus}
                    onChange={(e) => setForm((f) => ({ ...f, focus: e.target.value as ExerciseFocus }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                  >
                    {Object.entries(EXERCISE_FOCUS_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Schwierigkeit">
                  <select
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, difficulty: e.target.value as ExerciseDifficulty }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                  >
                    {Object.entries(EXERCISE_DIFFICULTY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Geeignete Phasen *">
                <div className="flex flex-wrap gap-2">
                  {TRAINING_PHASES.map((p) => {
                    const on = form.suitablePhases.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePhase(p)}
                        className={[
                          'rounded-full px-3 py-1.5 text-[12px] font-semibold',
                          on ? 'bg-red-700 text-white' : 'border border-slate-200 text-slate-600',
                        ].join(' ')}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Dauer (Min) *">
                  <input
                    type="number"
                    min={1}
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) || 0 }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                  />
                </Field>
                <Field label="Spieler min">
                  <input
                    value={form.playerCountMin}
                    onChange={(e) => setForm((f) => ({ ...f, playerCountMin: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                  />
                </Field>
                <Field label="Spieler max">
                  <input
                    value={form.playerCountMax}
                    onChange={(e) => setForm((f) => ({ ...f, playerCountMax: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                  />
                </Field>
              </div>
              <Field label="Altersklasse">
                <input
                  value={form.ageGroup}
                  onChange={(e) => setForm((f) => ({ ...f, ageGroup: e.target.value }))}
                  placeholder="z. B. U10–U12"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                />
              </Field>
              <Field label="Material">
                <input
                  value={form.materials}
                  onChange={(e) => setForm((f) => ({ ...f, materials: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                />
              </Field>
              <Field label="Organisation / Aufbau">
                <textarea
                  value={form.organization}
                  onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                />
              </Field>
              <Field label="Coachingpunkte">
                <textarea
                  value={form.coachingPoints}
                  onChange={(e) => setForm((f) => ({ ...f, coachingPoints: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                />
              </Field>
              <Field label="Variationen">
                <textarea
                  value={form.variations}
                  onChange={(e) => setForm((f) => ({ ...f, variations: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                />
              </Field>
              {form.sourceReference ? (
                <Field label="Quelle">
                  <textarea
                    value={form.sourceReference}
                    onChange={(e) => setForm((f) => ({ ...f, sourceReference: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                  />
                </Field>
              ) : null}
              {formError ? <p className="text-[13px] text-red-700">{formError}</p> : null}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-full bg-red-700 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-[13px] text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function TrainingExerciseImage({ path, title }: { path: string | null; title: string }): React.ReactElement {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (path) {
      void getTrainingExerciseSketchUrl(path).then((nextUrl) => {
        if (active) setUrl(nextUrl);
      });
    }
    return () => {
      active = false;
    };
  }, [path]);

  if (url) {
    return (
      <img
        src={url}
        alt={`Skizze: ${title}`}
        className="mb-3 h-28 w-full rounded-xl border border-slate-100 bg-white object-contain"
      />
    );
  }
  return (
    <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
      Übung
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <label className="block space-y-1">
      <span className="text-[12px] font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

async function imageFileToWebp(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
      next.src = objectUrl;
    });
    const maxEdge = 2400;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Bildverarbeitung nicht verfügbar.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
    if (!blob) throw new Error('Bild konnte nicht konvertiert werden.');
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
