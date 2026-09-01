/**
 * Übungsbibliothek – Karten, Suche/Filter, Detail, Anlegen/Bearbeiten, Skizzen-Upload.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileDown, FileUp, ImagePlus, PackageOpen, Plus, RotateCw, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { resolveClubIdForTeamSeason } from '../lib/venues';
import {
  archiveTrainingExercise,
  countExerciseUsage,
  createTrainingExercise,
  formatPlayerCountRange,
  getTrainingExerciseSketchUrl,
  listTrainingExercises,
  removeTrainingExerciseSketch,
  TRAINING_EXERCISE_SKETCH_MAX_BYTES,
  updateTrainingExercise,
  uploadTrainingExerciseSketch,
  type TrainingExerciseRow,
  type TrainingExerciseVisibility,
} from '../lib/trainingExercises';
import { analyzeTrainingExercisePdf } from '../lib/trainingExercisePdfImport';
import {
  createTrainingExerciseOriginalText,
  TRAINING_SHORT_TEXT_LIMITS,
  type TrainingExerciseShortText,
  type TrainingExerciseShortTextInput,
} from '../lib/trainingExerciseShortText';
import { createTrainingExerciseAiShortText } from '../lib/trainingExerciseAiShortText';
import { measureTrainingExamPhaseTextFit, type TrainingExamTextFit } from '../lib/trainingExamPdfExport';
import { addExerciseToSession, updateSessionExercise } from '../lib/trainingSessions';
import {
  EXERCISE_DIFFICULTY_LABELS,
  EXERCISE_FOCUS_LABELS,
  TRAINING_PHASE_LABELS,
  TRAINING_PHASES,
  type ExerciseDifficulty,
  type ExerciseFocus,
  type TrainingPhase,
} from '../lib/trainingPhases';
import { TrainingExerciseDetailModal } from '../components/training/TrainingExerciseDetailModal';
import { TrainingExerciseImage } from '../components/training/TrainingExerciseImage';
import { TrainingExerciseMetaChip } from '../components/training/TrainingExerciseMetaChip';
import { createTrainingExerciseHandoutHtml } from '../lib/trainingExerciseHandout';
import {
  createTrainingExercisePackage,
  parseTrainingExercisePackage,
  TRAINING_EXERCISE_PACKAGE_ACCEPT,
} from '../lib/trainingExercisePackage';

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
  shortContent: string;
  shortMaterials: string;
  shortCoaching: string;
  sourceType: 'club' | 'import';
  sourceReference: string;
  visibility: TrainingExerciseVisibility;
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
  shortContent: '',
  shortMaterials: '',
  shortCoaching: '',
  sourceType: 'club',
  sourceReference: '',
  visibility: 'club',
});

function formFromRow(row: TrainingExerciseRow): FormState {
  const originalText = createTrainingExerciseOriginalText({
    description: row.description,
    organization: row.organization,
    materials: row.materials,
    coachingPoints: row.coaching_points,
    variations: row.variations,
  });
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
    // Der rote Bereich startet bewusst immer mit den unveränderten Originalfeldern.
    // Eine gespeicherte Alt-Kurzfassung darf den Ausgangstext für einen neuen
    // Prüfvorgang nicht verdecken.
    shortContent: originalText.content,
    shortMaterials: originalText.materials,
    shortCoaching: originalText.coaching,
    sourceType: row.source_type === 'import' ? 'import' : 'club',
    sourceReference: row.source_reference ?? '',
    visibility: row.visibility === 'private' ? 'private' : 'club',
  };
}

function originalTextFitsPdf(title: string, text: TrainingExerciseShortText): boolean {
  if (
    text.content.length > TRAINING_SHORT_TEXT_LIMITS.content
    || text.materials.length > TRAINING_SHORT_TEXT_LIMITS.materials
    || text.coaching.length > TRAINING_SHORT_TEXT_LIMITS.coaching
  ) return false;
  const fit = measureTrainingExamPhaseTextFit({ title, ...text });
  return !Object.values(fit).includes('too-long');
}

export function ManagerTrainingLibraryPage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedTeamSeasonId, selectedTeamSeason, viewTeamSeason } = useSession();
  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;

  const selectionSessionId = searchParams.get('session');
  const selectionPhaseValue = searchParams.get('phase');
  const selectionPhase = TRAINING_PHASES.includes(selectionPhaseValue as TrainingPhase)
    ? (selectionPhaseValue as TrainingPhase)
    : null;
  const replaceItemId = searchParams.get('replace');
  const quickReplace = searchParams.get('quick') === '1';
  const editExerciseId = searchParams.get('edit');
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo =
    requestedReturnTo?.startsWith('/manager/training/einheiten/')
      ? requestedReturnTo
      : selectionSessionId
        ? `/manager/training/einheiten/${selectionSessionId}`
        : null;
  const editReturnTo = requestedReturnTo?.startsWith('/manager/training/einheiten/')
    ? requestedReturnTo
    : null;
  const selectionMode = Boolean(selectionSessionId && selectionPhase && returnTo);

  const [clubId, setClubId] = useState<string | null>(null);
  const [rows, setRows] = useState<TrainingExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>(selectionPhase ?? '');
  const [focusFilter, setFocusFilter] = useState<string>('');
  const [ageFilter, setAgeFilter] = useState('');
  const [durationMax, setDurationMax] = useState('');

  const [detail, setDetail] = useState<TrainingExerciseRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImportKind, setEditorImportKind] = useState<'pdf' | 'package' | null>(null);
  const [editing, setEditing] = useState<TrainingExerciseRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [exportingExerciseId, setExportingExerciseId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [shortTextError, setShortTextError] = useState<string | null>(null);
  const [shortTextWarning, setShortTextWarning] = useState<string | null>(null);
  const [shorteningWithAi, setShorteningWithAi] = useState(false);
  const [importing, setImporting] = useState(false);
  const [packageImporting, setPackageImporting] = useState(false);
  const [exportingPackageExerciseId, setExportingPackageExerciseId] = useState<string | null>(null);
  const [sketchProcessing] = useState(false);
  const [pendingSketch, setPendingSketch] = useState<Blob | null>(null);
  const [pendingSketchUrl, setPendingSketchUrl] = useState<string | null>(null);
  const [currentSketchUrl, setCurrentSketchUrl] = useState<string | null>(null);
  const [removeCurrentSketch, setRemoveCurrentSketch] = useState(false);
  const [cropSource, setCropSource] = useState<{ url: string; owned: boolean } | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropRotation, setCropRotation] = useState(0);
  const [cropReplaceGrass, setCropReplaceGrass] = useState(false);
  const [cropUnifyGrass, setCropUnifyGrass] = useState(false);
  const [cropWhiteStrength, setCropWhiteStrength] = useState(55);
  const [cropGreenStrength, setCropGreenStrength] = useState(55);
  const [cropGrassCompare, setCropGrassCompare] = useState<'original' | 'grass'>('grass');
  const [cropSaving, setCropSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const packageInputRef = useRef<HTMLInputElement>(null);
  const sketchInputRef = useRef<HTMLInputElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const openedRequestedEditorRef = useRef<string | null>(null);

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
    if (selectionPhase) setPhaseFilter(selectionPhase);
  }, [selectionPhase]);

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

  useEffect(() => {
    if (!cropSource || !cropCanvasRef.current) return;
    let active = true;
    const showGrass = (cropReplaceGrass || cropUnifyGrass) && cropGrassCompare === 'grass';
    void renderExerciseCrop(cropCanvasRef.current, cropSource.url, {
      zoom: cropZoom,
      x: cropX,
      y: cropY,
      rotation: cropRotation,
      replaceWhiteWithGrass: showGrass && cropReplaceGrass,
      unifyGrass: showGrass && cropUnifyGrass,
      whiteStrength: cropWhiteStrength,
      greenStrength: cropGreenStrength,
    }).catch(() => {
      if (active) setFormError('Die Zuschneidevorschau konnte nicht geladen werden.');
    });
    return () => {
      active = false;
    };
  }, [cropGrassCompare, cropGreenStrength, cropReplaceGrass, cropRotation, cropSource, cropUnifyGrass, cropWhiteStrength, cropX, cropY, cropZoom]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const age = ageFilter.trim().toLowerCase();
    const maxMin = durationMax.trim() ? Number(durationMax) : null;
    return rows.filter((r) => {
      if (query) {
        const hay = `${r.title} ${r.description ?? ''} ${r.materials ?? ''} ${r.organization ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (phaseFilter && !r.suitable_phases.includes(phaseFilter as TrainingPhase)) return false;
      if (focusFilter && r.focus !== focusFilter) return false;
      if (age && !(r.age_group ?? '').toLowerCase().includes(age)) return false;
      if (maxMin != null && !Number.isNaN(maxMin) && r.duration_minutes > maxMin) return false;
      return true;
    });
  }, [rows, q, phaseFilter, focusFilter, ageFilter, durationMax]);

  const resetSketchState = () => {
    setPendingSketch(null);
    setPendingSketchUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCurrentSketchUrl(null);
    setRemoveCurrentSketch(false);
  };

  const openCreate = () => {
    setDetail(null);
    setEditing(null);
    setEditorImportKind(null);
    setForm(emptyForm());
    resetSketchState();
    setFormError(null);
    setShortTextError(null);
    setShortTextWarning(null);
    setEditorOpen(true);
  };

  const openEdit = (row: TrainingExerciseRow) => {
    setDetail(null);
    setEditing(row);
    setEditorImportKind(null);
    setForm(formFromRow(row));
    resetSketchState();
    setFormError(null);
    setShortTextError(null);
    setShortTextWarning(null);
    setEditorOpen(true);
    if (row.image_path) {
      void getTrainingExerciseSketchUrl(row.image_path).then((url) => setCurrentSketchUrl(url));
    }
  };

  useEffect(() => {
    if (!editExerciseId || loading || openedRequestedEditorRef.current === editExerciseId) return;
    openedRequestedEditorRef.current = editExerciseId;
    const row = rows.find((candidate) => candidate.id === editExerciseId);
    if (!row) {
      setToast('Die gewählte Übung wurde nicht gefunden.');
      return;
    }
    openEdit(row);
  }, [editExerciseId, loading, rows]);

  const openDetail = (row: TrainingExerciseRow) => {
    setDetail(row);
  };

  const printExercise = async (row: TrainingExerciseRow) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setToast('Die PDF-Vorschau wurde blockiert. Bitte Pop-ups für diese Seite erlauben.');
      return;
    }
    printWindow.document.write('<p style="font-family:Arial;padding:24px">Einzelübungs-PDF wird erstellt…</p>');
    setExportingExerciseId(row.id);
    try {
      const sketchUrl = row.image_path ? await getTrainingExerciseSketchUrl(row.image_path) : null;
      const team = (contextSeason?.team?.name ?? '').trim();
      const ageGroup = (contextSeason?.age_group ?? contextSeason?.team?.age_group ?? '').trim();
      const teamName = [team, ageGroup && !team.toLowerCase().includes(ageGroup.toLowerCase()) ? ageGroup : '']
        .filter(Boolean)
        .join(' · ');
      const html = createTrainingExerciseHandoutHtml({
        exercise: row,
        sketchUrl,
        teamName,
        seasonName: contextSeason?.season?.name ?? '',
      });
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      setToast('Einzelübungs-PDF wurde geöffnet.');
    } catch (cause) {
      printWindow.close();
      setToast(cause instanceof Error ? cause.message : 'Einzelübungs-PDF konnte nicht erstellt werden.');
    } finally {
      setExportingExerciseId(null);
    }
  };

  const exportExercisePackage = async (row: TrainingExerciseRow) => {
    setExportingPackageExerciseId(row.id);
    try {
      const sketchUrl = row.image_path ? await getTrainingExerciseSketchUrl(row.image_path) : null;
      const result = await createTrainingExercisePackage(row, sketchUrl);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setToast('Übung wurde für die Übertragung heruntergeladen.');
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'Übung konnte nicht für die Übertragung erstellt werden.');
    } finally {
      setExportingPackageExerciseId(null);
    }
  };

  const closeCrop = () => {
    setCropSource((current) => {
      if (current?.owned) URL.revokeObjectURL(current.url);
      return null;
    });
    setCropSaving(false);
  };

  const openCrop = (url: string, owned = false) => {
    setFormError(null);
    setCropZoom(1);
    setCropX(0);
    setCropY(0);
    setCropRotation(0);
    setCropReplaceGrass(false);
    setCropUnifyGrass(false);
    setCropWhiteStrength(55);
    setCropGreenStrength(55);
    setCropGrassCompare('grass');
    setCropSource({ url, owned });
  };

  const selectSketch = async (file: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setFormError('Bitte ein PNG-, JPG- oder WebP-Bild auswählen.');
      return;
    }
    if (file.size > TRAINING_EXERCISE_SKETCH_MAX_BYTES) {
      setFormError('Das Bild darf höchstens 8 MB groß sein.');
      return;
    }
    if (cropSource?.owned) URL.revokeObjectURL(cropSource.url);
    openCrop(URL.createObjectURL(file), true);
    if (sketchInputRef.current) sketchInputRef.current.value = '';
  };

  const applyCrop = async (useOriginal = false) => {
    if (!cropSource) return;
    setCropSaving(true);
    setFormError(null);
    try {
      const sketch = useOriginal
        ? await imageUrlToWebp(cropSource.url)
        : await cropExerciseImageToWebp(cropSource.url, {
            zoom: cropZoom,
            x: cropX,
            y: cropY,
            rotation: cropRotation,
            replaceWhiteWithGrass: cropReplaceGrass,
            unifyGrass: cropUnifyGrass,
            whiteStrength: cropWhiteStrength,
            greenStrength: cropGreenStrength,
          });
      setPendingSketchUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(sketch);
      });
      setPendingSketch(sketch);
      setRemoveCurrentSketch(false);
      closeCrop();
    } catch {
      setCropSaving(false);
      setFormError('Die Skizze konnte nicht zugeschnitten werden.');
    }
  };

  const removeSketchWithConfirm = () => {
    if (!window.confirm('Skizze wirklich entfernen? Die Änderung wird beim Speichern übernommen.')) return;
    setPendingSketch(null);
    setPendingSketchUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRemoveCurrentSketch(true);
  };

  const importPdf = async (file: File) => {
    setImporting(true);
    setError(null);
    try {
      const draft = await analyzeTrainingExercisePdf(file);
      const originalText = createTrainingExerciseOriginalText({
        description: draft.description,
        organization: draft.organization,
        materials: draft.materials,
        coachingPoints: draft.coachingPoints,
        variations: draft.variations,
      });
      setDetail(null);
      setEditing(null);
      setEditorImportKind('pdf');
      setForm((current) => ({
        ...current,
        ...draft,
        difficulty: 'medium',
        visibility: 'club',
        sourceType: 'import',
        shortContent: originalText.content,
        shortMaterials: originalText.materials,
        shortCoaching: originalText.coaching,
      }));
      setPendingSketch(draft.sketch);
      setPendingSketchUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return draft.sketch ? URL.createObjectURL(draft.sketch) : null;
      });
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

  const importExercisePackage = async (file: File) => {
    setPackageImporting(true);
    setError(null);
    try {
      const draft = await parseTrainingExercisePackage(file);
      setDetail(null);
      setEditing(null);
      setEditorImportKind('package');
      setForm((current) => ({ ...current, ...draft }));
      setPendingSketch(draft.sketch);
      setPendingSketchUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return draft.sketch ? URL.createObjectURL(draft.sketch) : null;
      });
      setCurrentSketchUrl(null);
      setRemoveCurrentSketch(false);
      setFormError(null);
      setShortTextError(null);
      setShortTextWarning(null);
      setEditorOpen(true);
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'SpielzeitApp-Übung konnte nicht importiert werden.');
    } finally {
      setPackageImporting(false);
      if (packageInputRef.current) packageInputRef.current.value = '';
    }
  };

  const togglePhase = (phase: TrainingPhase) => {
    setForm((f) => {
      const has = f.suitablePhases.includes(phase);
      const next = has ? f.suitablePhases.filter((p) => p !== phase) : [...f.suitablePhases, phase];
      return { ...f, suitablePhases: next.length ? next : f.suitablePhases };
    });
  };

  const generateShortText = () => {
    const original = createTrainingExerciseOriginalText({
      description: form.description,
      organization: form.organization,
      materials: form.materials,
      coachingPoints: form.coachingPoints,
      variations: form.variations,
    });
    setForm((current) => ({
      ...current,
      shortContent: original.content,
      shortMaterials: original.materials,
      shortCoaching: original.coaching,
    }));
    setShortTextError(null);
    setShortTextWarning(null);
    setToast('Originaltext übernommen. Zu lange Felder können jetzt manuell oder mit KI gekürzt werden.');
  };

  const generateAiShortText = async () => {
    if (shorteningWithAi) return;
    const input = {
      description: form.description,
      organization: form.organization,
      materials: form.materials,
      coachingPoints: form.coachingPoints,
      variations: form.variations,
    };
    const original = createTrainingExerciseOriginalText(input);
    // Eine bereits manuell bearbeitete und vom Trainer geprüfte Fassung bleibt
    // während des KI-Versuchs sichtbar. Nur ein erfolgreich erzeugter Entwurf
    // darf sie ersetzen; ein Fehler setzt sie niemals auf das Original zurück.
    if (originalTextFitsPdf(form.title, original)) {
      setFormError(null);
      setShortTextError(null);
      setShortTextWarning(null);
      setToast('Der vollständige Text passt. Es wurde keine KI verwendet.');
      return;
    }
    if (!clubId) return;
    setShorteningWithAi(true);
    setFormError(null);
    setShortTextError(null);
    setShortTextWarning(null);
    const result = await createTrainingExerciseAiShortText(clubId, input);
    setShorteningWithAi(false);
    if (!result.data) {
      const message = result.error ?? 'KI-Kurzfassung fehlgeschlagen.';
      setShortTextError(`${message} Deine aktuell angezeigte Fassung bleibt unverändert.`);
      setShortTextWarning(null);
      return;
    }
    const generated = result.data;
    setForm((current) => ({
      ...current,
      shortContent: generated.content,
      shortMaterials: generated.materials,
      shortCoaching: generated.coaching,
    }));
    setShortTextError(null);
    if (result.warnings.length > 0) {
      setShortTextWarning(`KI-Entwurf übernommen. Bitte prüfen und bei Bedarf ergänzen: ${result.warnings.join(' · ')}`);
      setToast('Bester KI-Entwurf übernommen – bitte die Hinweise prüfen.');
    } else {
      setShortTextWarning('Bitte vor dem Speichern mit dem Original vergleichen – besonders Spieleranzahl, Maße, Rollen, Reihenfolge und Variationen.');
      setToast('KI-Kurzfassung erstellt – bitte prüfen und anschließend speichern.');
    }
  };

  const save = async () => {
    if (!clubId) return;
    const returnAfterSave = editing?.id === editExerciseId ? editReturnTo : null;
    setSaving(true);
    setFormError(null);

    const basePayload = {
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
      shortContent: form.shortContent,
      shortMaterials: form.shortMaterials,
      shortCoaching: form.shortCoaching,
      sourceType: form.sourceType,
      sourceReference: form.sourceReference,
      visibility: form.visibility,
    };

    // Zuerst Stammdaten speichern (ohne neuen Upload), damit exercise_id für Storage-Pfad verfügbar ist.
    const initialImagePath = removeCurrentSketch ? null : editing?.image_path ?? null;
    const saveRes = editing
      ? await updateTrainingExercise(editing.id, {
          ...basePayload,
          imagePath: pendingSketch ? editing.image_path : initialImagePath,
        })
      : await createTrainingExercise({
          ...basePayload,
          imagePath: null,
        });

    if (saveRes.error || !saveRes.data) {
      setSaving(false);
      setFormError(saveRes.error ?? 'Speichern fehlgeschlagen.');
      return;
    }

    const saved = saveRes.data;
    let uploadedPath: string | null = null;
    const previousPath = editing?.image_path ?? null;

    if (pendingSketch) {
      const upload = await uploadTrainingExerciseSketch(clubId, pendingSketch, saved.id);
      if (upload.error || !upload.path) {
        setSaving(false);
        setFormError(
          `Übung gespeichert, Skizze fehlgeschlagen: ${upload.error ?? 'Unbekannter Fehler'}. Bitte Skizze erneut hochladen.`,
        );
        setEditing(saved);
        setDetail(null);
        await reload();
        return;
      }
      uploadedPath = upload.path;
      const imageUpdate = await updateTrainingExercise(saved.id, { imagePath: uploadedPath });
      if (imageUpdate.error || !imageUpdate.data) {
        await removeTrainingExerciseSketch(uploadedPath);
        setSaving(false);
        setFormError(
          `Übung gespeichert, Skizzen-Pfad fehlgeschlagen: ${imageUpdate.error ?? 'Unbekannter Fehler'}.`,
        );
        setEditing(saved);
        await reload();
        return;
      }
      if (previousPath && previousPath !== uploadedPath) {
        await removeTrainingExerciseSketch(previousPath);
      }
    } else if (removeCurrentSketch && previousPath) {
      await removeTrainingExerciseSketch(previousPath);
    }

    setSaving(false);
    setEditorOpen(false);
    resetSketchState();
    setToast(
      editing
        ? 'Übung aktualisiert.'
        : editorImportKind === 'package'
          ? 'SpielzeitApp-Übung importiert.'
          : editorImportKind === 'pdf'
            ? 'PDF-Übung importiert.'
            : 'Übung angelegt.',
    );
    setEditorImportKind(null);
    await reload();
    if (returnAfterSave) navigate(returnAfterSave);
  };

  const selectForSession = async (row: TrainingExerciseRow) => {
    if (!selectionMode || !selectionSessionId || !selectionPhase || !returnTo) return;
    setSelectingId(row.id);
    setError(null);

    const result = replaceItemId
      ? await updateSessionExercise(
          replaceItemId,
          quickReplace
            ? {
                exerciseId: row.id,
                coachNotes: null,
                wasCompleted: null,
                actualDurationMinutes: null,
                reviewStatus: null,
                reviewNotes: null,
                repeatRecommended: false,
              }
            : { exerciseId: row.id },
        )
      : await addExerciseToSession({
          sessionId: selectionSessionId,
          exerciseId: row.id,
          phase: selectionPhase,
          durationMinutes: row.duration_minutes,
        });

    if (result.error) {
      setError(result.error);
      setSelectingId(null);
      return;
    }

    navigate(returnTo, { replace: true });
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
    setDetail(null);
    setToast('Übung archiviert.');
    await reload();
  };

  const hasSketchPreview = Boolean(pendingSketchUrl || (currentSketchUrl && !removeCurrentSketch));
  const sketchButtonLabel = hasSketchPreview ? 'Skizze ersetzen' : 'Skizze hochladen';
  const shortTextPdfFit = measureTrainingExamPhaseTextFit({
    title: form.title,
    content: form.shortContent,
    materials: form.shortMaterials,
    coaching: form.shortCoaching,
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Sport</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Übungsbibliothek</h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Vereinsübungen für Trainingseinheiten · {filtered.length} von {rows.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={packageInputRef}
            type="file"
            accept={TRAINING_EXERCISE_PACKAGE_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importExercisePackage(file);
            }}
          />
          <button
            type="button"
            disabled={packageImporting || !clubId}
            onClick={() => packageInputRef.current?.click()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 text-[13px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            <PackageOpen className="h-4 w-4" aria-hidden />
            {packageImporting ? 'Übung wird gelesen…' : 'SpielzeitApp-Übung importieren'}
          </button>
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
            {importing ? 'PDF wird gelesen…' : 'Externe PDF importieren'}
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

      {selectionMode && selectionPhase && returnTo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold text-red-900">
              {quickReplace ? 'Schnelltausch' : replaceItemId ? 'Übung austauschen' : 'Übung auswählen'} · {TRAINING_PHASE_LABELS[selectionPhase]}
            </p>
            <p className="mt-0.5 text-[12px] text-red-800">
              Passende Übungen sind vorgefiltert. Öffne „Ansehen“ für Details oder übernimm die Übung direkt.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="min-h-[40px] rounded-full border border-red-200 bg-white px-4 py-2 text-[13px] font-semibold text-red-800 hover:bg-red-100"
          >
            Zurück zur Planung
          </button>
        </div>
      ) : null}

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
          aria-label="Trainingsphase filtern"
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
          <p className="mt-1 text-[13px] text-slate-500">
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
          {filtered.map((row) => {
            const players = formatPlayerCountRange(row.player_count_min, row.player_count_max);
            return (
              <li
                key={row.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <button
                  type="button"
                  onClick={() => openDetail(row)}
                  className="flex flex-1 flex-col p-3 text-left touch-manipulation sm:p-4"
                >
                  <TrainingExerciseImage path={row.image_path} title={row.title} variant="library" />
                  <h2 className="mt-3 text-[15px] font-semibold leading-snug text-slate-900">{row.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <TrainingExerciseMetaChip>{EXERCISE_FOCUS_LABELS[row.focus] ?? row.focus}</TrainingExerciseMetaChip>
                    {row.suitable_phases.map((p) => (
                      <TrainingExerciseMetaChip key={p}>{TRAINING_PHASE_LABELS[p] ?? p}</TrainingExerciseMetaChip>
                    ))}
                    {row.visibility === 'private' ? (
                      <TrainingExerciseMetaChip tone="private">Privat</TrainingExerciseMetaChip>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[12px] text-slate-500">
                    {row.duration_minutes} Min.
                    {players ? ` · ${players}` : ''}
                    {row.age_group ? ` · ${row.age_group}` : ''}
                  </p>
                </button>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2.5 sm:px-4">
                  {selectionMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openDetail(row)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Ansehen
                      </button>
                      <button
                        type="button"
                        disabled={selectingId === row.id}
                        onClick={() => void selectForSession(row)}
                        className="rounded-full bg-red-700 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                      >
                        {selectingId === row.id
                          ? 'Wird übernommen…'
                          : replaceItemId
                            ? 'Austauschen'
                            : 'Auswählen'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={exportingExerciseId === row.id}
                        onClick={() => void printExercise(row)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
                      >
                        <FileDown className="h-3.5 w-3.5" aria-hidden />
                        {exportingExerciseId === row.id ? 'PDF…' : 'PDF'}
                      </button>
                      <button
                        type="button"
                        disabled={exportingPackageExerciseId === row.id}
                        onClick={() => void exportExercisePackage(row)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        title="Übung vollständig in eine andere SpielzeitApp-Umgebung übertragen"
                      >
                        <PackageOpen className="h-3.5 w-3.5" aria-hidden />
                        {exportingPackageExerciseId === row.id ? 'Übertragen…' : 'Übertragen'}
                      </button>
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
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {detail ? (
        <TrainingExerciseDetailModal
          row={detail}
          onClose={() => setDetail(null)}
          footer={
            selectionMode ? (
              <>
                <button
                  type="button"
                  disabled={exportingExerciseId === detail.id}
                  onClick={() => void printExercise(detail)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <FileDown className="h-4 w-4" aria-hidden />
                  {exportingExerciseId === detail.id ? 'PDF wird erstellt…' : 'Übung als PDF'}
                </button>
                <button
                  type="button"
                  disabled={exportingPackageExerciseId === detail.id}
                  onClick={() => void exportExercisePackage(detail)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <PackageOpen className="h-4 w-4" aria-hidden />
                  {exportingPackageExerciseId === detail.id ? 'Übertragung wird erstellt…' : 'Übung übertragen'}
                </button>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="min-h-[40px] rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Zurück
                </button>
                <button
                  type="button"
                  disabled={selectingId === detail.id}
                  onClick={() => void selectForSession(detail)}
                  className="min-h-[40px] rounded-full bg-red-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  {selectingId === detail.id
                    ? 'Wird übernommen…'
                    : replaceItemId
                      ? 'Diese Übung austauschen'
                      : 'Diese Übung auswählen'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={exportingExerciseId === detail.id}
                  onClick={() => void printExercise(detail)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <FileDown className="h-4 w-4" aria-hidden />
                  {exportingExerciseId === detail.id ? 'PDF wird erstellt…' : 'Übung als PDF'}
                </button>
                <button
                  type="button"
                  disabled={exportingPackageExerciseId === detail.id}
                  onClick={() => void exportExercisePackage(detail)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <PackageOpen className="h-4 w-4" aria-hidden />
                  {exportingPackageExerciseId === detail.id ? 'Übertragung wird erstellt…' : 'Übung übertragen'}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(detail)}
                  className="min-h-[40px] rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  onClick={() => void archive(detail)}
                  className="min-h-[40px] rounded-full px-4 py-2 text-[13px] font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Archivieren
                </button>
                <Link
                  to={`/manager/training/einheiten/neu?exercise=${encodeURIComponent(detail.id)}`}
                  className="inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-800"
                >
                  Zur Einheit
                </Link>
              </>
            )
          }
        />
      ) : null}

      {editorOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-editor-title"
          >
            <h2 id="exercise-editor-title" className="text-[16px] font-semibold text-slate-900">
              {editing
                ? 'Übung bearbeiten'
                : editorImportKind === 'package'
                  ? 'SpielzeitApp-Übung prüfen'
                  : editorImportKind === 'pdf'
                    ? 'PDF-Import prüfen'
                    : 'Neue Übung'}
            </h2>
            {!editing && editorImportKind === 'package' ? (
              <p className="mt-1 text-[12px] text-emerald-700">
                Alle Übungsdaten und die Skizze wurden übernommen. Bitte kurz prüfen und anschließend speichern.
              </p>
            ) : !editing && editorImportKind === 'pdf' ? (
              <p className="mt-1 text-[12px] text-amber-700">
                Vorschlag aus der PDF: Bitte alle Angaben und besonders die Trainingsphase prüfen. Die erkannte
                Skizze kannst du durch eine eigene Datei ersetzen.
              </p>
            ) : null}
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-slate-700">Skizze / Bild</span>
                  <span className="text-[11px] text-slate-400">PNG, JPG oder WebP · max. 8 MB</span>
                </div>
                {sketchProcessing ? (
                  <div className="mt-2 flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-[12px] text-slate-500">
                    Skizze wird verarbeitet…
                  </div>
                ) : hasSketchPreview ? (
                  <img
                    src={pendingSketchUrl ?? currentSketchUrl ?? ''}
                    alt="Vorschau der Übungsskizze"
                    className="mt-2 max-h-56 w-full rounded-xl border border-slate-200 bg-white object-contain"
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
                    disabled={sketchProcessing || saving}
                    onClick={() => sketchInputRef.current?.click()}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ImagePlus className="h-4 w-4" aria-hidden />
                    {sketchButtonLabel}
                  </button>
                  {hasSketchPreview ? (
                    <>
                      <button
                        type="button"
                        disabled={sketchProcessing || saving}
                        onClick={() => {
                          const url = pendingSketchUrl ?? currentSketchUrl;
                          if (url) openCrop(url);
                        }}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Skizze zuschneiden
                      </button>
                      <button
                        type="button"
                        disabled={sketchProcessing || saving}
                        onClick={removeSketchWithConfirm}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Skizze entfernen
                      </button>
                    </>
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                        {TRAINING_PHASE_LABELS[p]}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              <Field label="Freigabe">
                <select
                  value={form.visibility}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      visibility: e.target.value === 'private' ? 'private' : 'club',
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                >
                  <option value="club">Verein (Trainer des Vereins)</option>
                  <option value="private">Nur für mich (privat)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Private Übungen werden nicht für andere Vereinstrainer freigegeben.
                </p>
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
              <section className="rounded-xl border border-red-100 bg-red-50/50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-slate-900">
                      Kurzfassung für Handout &amp; optionale Trainer-PDF
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                      Zuerst wird hier der vollständige Originaltext aus Aufbau, Ablauf und Variationen angezeigt. Ist er länger als 760 Zeichen, kann er manuell oder mit KI gekürzt werden. Coachingpunkte bleiben getrennt. Nur ein erfolgreich erzeugter KI-Entwurf ersetzt die aktuell angezeigte Fassung.
                    </p>
                    <p className="mt-1 text-[11px] font-medium leading-4 text-amber-800">
                      KI-Kurzfassungen sind Entwürfe. Bitte Zahlen, Spieleranzahl, Rollen, Reihenfolge und Variationen vor dem Speichern mit dem Original kontrollieren.
                    </p>
                    <p className="mt-1 text-[11px] font-medium leading-4 text-slate-600">
                      Hinweise der KI sind Empfehlungen. Du kannst den Text manuell ändern, Hinweise bewusst verwerfen und deine freigegebene Fassung jederzeit speichern.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void generateAiShortText()}
                      disabled={shorteningWithAi}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-red-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${shorteningWithAi ? 'animate-pulse' : ''}`} aria-hidden />
                      {shorteningWithAi ? 'KI kürzt…' : 'Prüfen & bei Bedarf KI kürzen'}
                    </button>
                    <button
                      type="button"
                      onClick={generateShortText}
                      disabled={shorteningWithAi}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
                    >
                      <RotateCw className="h-3.5 w-3.5" aria-hidden />
                      Original neu übernehmen
                    </button>
                  </div>
                </div>
                {shortTextError ? (
                  <p className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-[12px] font-medium leading-5 text-red-800" role="alert">
                    <strong>KI-Versuch abgelehnt:</strong> {shortTextError}
                  </p>
                ) : null}
                {shortTextWarning ? (
                  <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-medium leading-5 text-amber-900" role="status">
                    <strong>KI-Entwurf prüfen:</strong> {shortTextWarning}
                  </p>
                ) : null}
                <div className="mt-3 space-y-3">
                  <ShortTextField
                    label="Inhalte: Aufbau, Ablauf & Variationen"
                    value={form.shortContent}
                    max={TRAINING_SHORT_TEXT_LIMITS.content}
                    rows={5}
                    pdfFit={shortTextPdfFit.content}
                    onChange={(value) => setForm((current) => ({ ...current, shortContent: value }))}
                  />
                  <ShortTextField
                    label="Geräte"
                    value={form.shortMaterials}
                    max={TRAINING_SHORT_TEXT_LIMITS.materials}
                    rows={2}
                    pdfFit={shortTextPdfFit.materials}
                    onChange={(value) => setForm((current) => ({ ...current, shortMaterials: value }))}
                  />
                  <ShortTextField
                    label="Coachingpunkte"
                    value={form.shortCoaching}
                    max={TRAINING_SHORT_TEXT_LIMITS.coaching}
                    rows={5}
                    pdfFit={shortTextPdfFit.coaching}
                    onChange={(value) => setForm((current) => ({ ...current, shortCoaching: value }))}
                  />
                </div>
              </section>
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
                onClick={() => {
                  if (editing?.id === editExerciseId && editReturnTo) {
                    navigate(editReturnTo);
                    return;
                  }
                  setEditorOpen(false);
                  setEditorImportKind(null);
                  resetSketchState();
                }}
                className="min-h-[40px] rounded-full border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={saving || sketchProcessing}
                onClick={() => void save()}
                className="min-h-[40px] rounded-full bg-red-700 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cropSource ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/60 p-3 sm:items-center">
          <div
            className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-crop-title"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="exercise-crop-title" className="text-[17px] font-semibold text-slate-900">
                  Skizze zuschneiden
                </h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Einheitliches 4:3-Format für Bibliothek, Word und A4-Handout
                </p>
              </div>
              <button
                type="button"
                disabled={cropSaving}
                onClick={closeCrop}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Zuschneiden schließen"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <canvas
                ref={cropCanvasRef}
                width={800}
                height={600}
                className="aspect-[4/3] w-full bg-white object-contain"
                aria-label="Vorschau des 4:3-Zuschnitts"
              />
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-slate-800">
                  Weißen Hintergrund durch Rasen ersetzen
                </span>
                <input
                  type="checkbox"
                  checked={cropReplaceGrass}
                  disabled={cropSaving}
                  onChange={(e) => {
                    setCropReplaceGrass(e.target.checked);
                    if (e.target.checked) setCropUnifyGrass(false);
                  }}
                  className="h-5 w-5 rounded border-slate-300 text-red-700 focus:ring-red-600"
                />
              </label>
              <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 border-t border-slate-200 pt-2">
                <span>
                  <span className="block text-[13px] font-semibold text-slate-800">
                    Gesamten Rasen vereinheitlichen
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                    Ersetzt vorhandene Grüntöne und Rasenstreifen durch ein einfarbiges Grün.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={cropUnifyGrass}
                  disabled={cropSaving}
                  onChange={(e) => {
                    setCropUnifyGrass(e.target.checked);
                    if (e.target.checked) setCropReplaceGrass(false);
                  }}
                  className="h-5 w-5 shrink-0 rounded border-slate-300 text-red-700 focus:ring-red-600"
                />
              </label>
              {cropReplaceGrass ? (
                <>
                  <CropRange
                    label="Weiß-Erkennung"
                    min={0}
                    max={100}
                    value={cropWhiteStrength}
                    onChange={setCropWhiteStrength}
                    suffix=" %"
                  />
                  <p className="text-[11px] leading-4 text-slate-500">
                    Höhere Werte entfernen auch hellgraue Flächen. Linien und Symbole bleiben erhalten.
                  </p>
                </>
              ) : null}
              {cropUnifyGrass ? (
                <>
                  <CropRange
                    label="Grün-Erkennung"
                    min={0}
                    max={100}
                    value={cropGreenStrength}
                    onChange={setCropGreenStrength}
                    suffix=" %"
                  />
                  <p className="text-[11px] leading-4 text-slate-500">
                    Höhere Werte erfassen mehr Grüntöne. Linien, Tore, Pfeile und Spielermarkierungen bleiben erhalten.
                  </p>
                </>
              ) : null}
              {cropReplaceGrass || cropUnifyGrass ? (
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Vergleich Hintergrund">
                    <button
                      type="button"
                      disabled={cropSaving}
                      onClick={() => setCropGrassCompare('original')}
                      className={`min-h-[40px] rounded-xl px-3 text-[13px] font-semibold disabled:opacity-50 ${
                        cropGrassCompare === 'original'
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      disabled={cropSaving}
                      onClick={() => setCropGrassCompare('grass')}
                      className={`min-h-[40px] rounded-xl px-3 text-[13px] font-semibold disabled:opacity-50 ${
                        cropGrassCompare === 'grass'
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {cropUnifyGrass ? 'Einfarbig grün' : 'Mit Rasen'}
                    </button>
                  </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <CropRange label="Bildgröße / Zoom" min={40} max={250} value={Math.round(cropZoom * 100)} onChange={(value) => setCropZoom(value / 100)} suffix=" %" />
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  Unter 100 % wird das ganze Bild kleiner und mit{' '}
                  {cropUnifyGrass
                    ? 'einfarbig grünem Rand'
                    : cropReplaceGrass
                      ? 'Rasenrand'
                      : 'weißem Rand'}{' '}
                  eingepasst.
                </p>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={cropSaving}
                  onClick={() => setCropRotation((value) => (value + 90) % 360)}
                  className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RotateCw className="h-4 w-4" aria-hidden />
                  90° drehen
                </button>
              </div>
              <CropRange label="Horizontal verschieben" min={-100} max={100} value={cropX} onChange={setCropX} />
              <CropRange label="Vertikal verschieben" min={-100} max={100} value={cropY} onChange={setCropY} />
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={cropSaving}
                onClick={() => void applyCrop(true)}
                className="min-h-[42px] rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-700 disabled:opacity-50"
              >
                Original verwenden
              </button>
              <button
                type="button"
                disabled={cropSaving}
                onClick={() => void applyCrop(false)}
                className="min-h-[42px] rounded-full bg-red-700 px-5 text-[13px] font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {cropSaving ? 'Wird verarbeitet…' : 'Zuschnitt übernehmen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-[90] max-w-[min(92vw,28rem)] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-center text-[13px] text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function CropRange({
  label,
  min,
  max,
  value,
  onChange,
  suffix = '',
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}): React.ReactElement {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 text-[12px] font-medium text-slate-600">
        <span>{label}</span>
        <span className="tabular-nums text-slate-400">{value}{suffix}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-red-700"
      />
    </label>
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

function ShortTextField({
  label,
  value,
  max,
  rows,
  pdfFit,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  rows: number;
  pdfFit: TrainingExamTextFit;
  onChange: (value: string) => void;
}): React.ReactElement {
  const length = value.length;
  const fit = length > max || pdfFit === 'too-long'
    ? 'Zu lang'
    : pdfFit === 'tight'
      ? 'Knapp'
      : 'Passt';
  const fitClass =
    fit === 'Passt'
      ? 'bg-emerald-50 text-emerald-700'
      : fit === 'Knapp'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-red-100 text-red-800';
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 text-[12px] font-medium text-slate-600">
        <span>{label}</span>
        <span className="flex items-center gap-2 text-[10px]">
          <span className="tabular-nums text-slate-400">{length}/{max}</span>
          <span className={`rounded-full px-2 py-0.5 font-bold ${fitClass}`}>{fit}</span>
        </span>
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder="• Kurzer, verständlicher Stichpunkt"
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5"
      />
    </label>
  );
}

type ExerciseCropOptions = {
  zoom: number;
  x: number;
  y: number;
  rotation: number;
  replaceWhiteWithGrass?: boolean;
  unifyGrass?: boolean;
  whiteStrength?: number;
  greenStrength?: number;
};

async function loadCropImage(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
    image.src = url;
  });
}

function rotatedImageCanvas(image: HTMLImageElement, rotation: number): HTMLCanvasElement {
  const normalized = ((rotation % 360) + 360) % 360;
  const swap = normalized === 90 || normalized === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? image.naturalHeight : image.naturalWidth;
  canvas.height = swap ? image.naturalWidth : image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Bildverarbeitung nicht verfügbar.');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((normalized * Math.PI) / 180);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return canvas;
}

function drawTrainingGrass(context: CanvasRenderingContext2D, width: number, height: number): void {
  const stripeCount = 8;
  const colors = ['#66ad55', '#80bd6f'] as const;
  const stripeHeight = height / stripeCount;
  for (let index = 0; index < stripeCount; index += 1) {
    context.fillStyle = colors[index % 2];
    const top = Math.floor(index * stripeHeight);
    const bottom = Math.floor((index + 1) * stripeHeight);
    context.fillRect(0, top, width, Math.max(1, bottom - top));
  }
}

function removeWhiteBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
): void {
  const clamped = Math.max(0, Math.min(100, strength));
  const threshold = 252 - Math.round((clamped / 100) * 57);
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (r >= threshold && g >= threshold && b >= threshold && max - min <= 22) {
      data[i + 3] = 0;
    }
  }
  context.putImageData(imageData, 0, 0);
}

type GrassColorBin = {
  count: number;
  red: number;
  green: number;
  blue: number;
};

function isLikelyGrassPixel(red: number, green: number, blue: number): boolean {
  return green >= 50 && green - red >= 8 && green - blue >= 5;
}

/**
 * Replaces only the dominant green colour clusters. Small saturated green
 * objects (for example player markers) do not become a dominant cluster and
 * therefore remain untouched.
 */
function unifyGrassBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
): string {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const bins = new Map<number, GrassColorBin>();
  let greenPixelCount = 0;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    if (!isLikelyGrassPixel(red, green, blue)) continue;
    greenPixelCount += 1;
    const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4);
    const bin = bins.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bin.count += 1;
    bin.red += red;
    bin.green += green;
    bin.blue += blue;
    bins.set(key, bin);
  }

  const minimumClusterSize = Math.max(12, Math.round(greenPixelCount * 0.006));
  const dominantBins = [...bins.values()]
    .filter((bin) => bin.count >= minimumClusterSize)
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);

  if (dominantBins.length === 0) return '#72b963';

  const dominantColors = dominantBins.map((bin) => ({
    red: bin.red / bin.count,
    green: bin.green / bin.count,
    blue: bin.blue / bin.count,
    count: bin.count,
  }));
  const dominantCount = dominantColors.reduce((sum, color) => sum + color.count, 0);
  const target = dominantColors.reduce(
    (color, value) => ({
      red: color.red + value.red * value.count,
      green: color.green + value.green * value.count,
      blue: color.blue + value.blue * value.count,
    }),
    { red: 0, green: 0, blue: 0 },
  );
  const targetRed = Math.round(target.red / dominantCount);
  const targetGreen = Math.round(target.green / dominantCount);
  const targetBlue = Math.round(target.blue / dominantCount);
  const clampedStrength = Math.max(0, Math.min(100, strength));
  const tolerance = 18 + clampedStrength * 0.62;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    if (!isLikelyGrassPixel(red, green, blue)) continue;
    const matchesGrass = dominantColors.some((color) => {
      const redDelta = red - color.red;
      const greenDelta = green - color.green;
      const blueDelta = blue - color.blue;
      return Math.sqrt(redDelta ** 2 + greenDelta ** 2 + blueDelta ** 2) <= tolerance;
    });
    if (!matchesGrass) continue;
    data[index] = targetRed;
    data[index + 1] = targetGreen;
    data[index + 2] = targetBlue;
  }

  context.putImageData(imageData, 0, 0);
  return `rgb(${targetRed}, ${targetGreen}, ${targetBlue})`;
}

async function renderExerciseCrop(
  canvas: HTMLCanvasElement,
  url: string,
  options: ExerciseCropOptions,
): Promise<void> {
  const image = await loadCropImage(url);
  const rotated = rotatedImageCanvas(image, options.rotation);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Bildverarbeitung nicht verfügbar.');
  const scale = Math.max(canvas.width / rotated.width, canvas.height / rotated.height) * options.zoom;
  const width = rotated.width * scale;
  const height = rotated.height * scale;
  const overflowX = Math.max(0, width - canvas.width);
  const overflowY = Math.max(0, height - canvas.height);
  const left = (canvas.width - width) / 2 - (options.x / 100) * (overflowX / 2);
  const top = (canvas.height - height) / 2 - (options.y / 100) * (overflowY / 2);

  if (options.unifyGrass) {
    const layer = document.createElement('canvas');
    layer.width = canvas.width;
    layer.height = canvas.height;
    const layerContext = layer.getContext('2d', { willReadFrequently: true });
    if (!layerContext) throw new Error('Bildverarbeitung nicht verfügbar.');
    layerContext.clearRect(0, 0, layer.width, layer.height);
    layerContext.drawImage(rotated, left, top, width, height);
    const solidGrassColor = unifyGrassBackground(
      layerContext,
      layer.width,
      layer.height,
      options.greenStrength ?? 55,
    );
    context.fillStyle = solidGrassColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(layer, 0, 0);
    return;
  }

  if (options.replaceWhiteWithGrass) {
    const layer = document.createElement('canvas');
    layer.width = canvas.width;
    layer.height = canvas.height;
    const layerContext = layer.getContext('2d', { willReadFrequently: true });
    if (!layerContext) throw new Error('Bildverarbeitung nicht verfügbar.');
    layerContext.clearRect(0, 0, layer.width, layer.height);
    layerContext.drawImage(rotated, left, top, width, height);
    removeWhiteBackground(layerContext, layer.width, layer.height, options.whiteStrength ?? 55);
    drawTrainingGrass(context, canvas.width, canvas.height);
    context.drawImage(layer, 0, 0);
    return;
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(rotated, left, top, width, height);
}

async function cropExerciseImageToWebp(url: string, options: ExerciseCropOptions): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1200;
  await renderExerciseCrop(canvas, url, options);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (!blob) throw new Error('Bild konnte nicht konvertiert werden.');
  return blob;
}

async function imageUrlToWebp(url: string): Promise<Blob> {
  const image = await loadCropImage(url);
  const maxEdge = 2400;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Bildverarbeitung nicht verfügbar.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (!blob) throw new Error('Bild konnte nicht konvertiert werden.');
  return blob;
}
