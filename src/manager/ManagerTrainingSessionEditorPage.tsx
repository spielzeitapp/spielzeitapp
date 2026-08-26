/**
 * STEP 3A: Trainingseinheit-Editor (Desktop/Tablet) + mobile Trainingsansicht.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { useEvents } from '../hooks/useEvents';
import { supabase } from '../lib/supabaseClient';
import { resolveClubIdForTeamSeason, listVenuesForClub } from '../lib/venues';
import { getAssignmentForEvent } from '../lib/eventFieldAssignments';
import { listVenueFields, listFieldZones } from '../lib/venueFields';
import {
  addExerciseToSession,
  archiveTrainingSession,
  createTrainingSession,
  getTrainingSession,
  listTrainingSessionsForSeason,
  listSessionExercises,
  removeExerciseFromSession,
  unlinkSessionFromEvent,
  updateSessionExercise,
  updateTrainingSession,
  type TrainingSessionExerciseRow,
  type TrainingSessionRow,
} from '../lib/trainingSessions';
import {
  getTrainingExerciseSketchUrl,
  listTrainingExercises,
  type TrainingExerciseRow,
} from '../lib/trainingExercises';
import {
  TRAINING_PHASES,
  TRAINING_PHASE_LABELS,
  TRAINING_PHASE_SHORT,
  TRAINING_SESSION_STATUS_LABELS,
  type TrainingPhase,
  type TrainingSessionStatus,
} from '../lib/trainingPhases';
import { isSeasonArchived } from '../lib/seasonLifecycle';
import { VIENNA_TZ } from '../lib/viennaTime';
import { ManagerTrainingCopyDialog } from './ManagerTrainingCopyDialog';
import { ManagerTrainingPlanPickerDialog } from './ManagerTrainingPlanPickerDialog';
import { ManagerTrainingAttendanceReadOnly } from './ManagerTrainingAttendanceReadOnly';
import { ManagerTrainingDocumentationPanel } from './ManagerTrainingDocumentationPanel';
import { listTrainingTemplates, updateExerciseReview } from '../lib/trainingSessionOps';
import { TRAINING_EXERCISE_REVIEW_LABELS, type TrainingExerciseReviewStatus } from '../lib/trainingPhases';
import { downloadTrainingSessionWord } from '../lib/trainingSessionWordExport';
import { createTrainingSessionHandoutHtml } from '../lib/trainingSessionHandout';
import { TrainingExerciseDetailModal } from '../components/training/TrainingExerciseDetailModal';
import { TrainingSessionExerciseCard } from '../components/training/TrainingSessionExerciseCard';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: VIENNA_TZ,
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

type PitchInfo = { label: string; missing: boolean };

export function ManagerTrainingSessionEditorPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'neu';
  const [searchParams] = useSearchParams();
  const eventFromQuery = searchParams.get('event');
  const startsFromQuery = searchParams.get('starts');
  const exerciseFromQuery = searchParams.get('exercise');
  const viewFromQuery = searchParams.get('view');
  const exerciseItemFromQuery = searchParams.get('exerciseItem');
  const returnToFromQuery = searchParams.get('returnTo');
  const navigate = useNavigate();

  const { user, selectedTeamSeasonId, selectedTeamSeason, viewTeamSeason } = useSession();
  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;
  const seasonArchived = contextSeason ? isSeasonArchived(contextSeason.status) : false;
  const { events } = useEvents(teamSeasonId);

  const [session, setSession] = useState<TrainingSessionRow | null>(null);
  const [items, setItems] = useState<TrainingSessionExerciseRow[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<string, TrainingExerciseRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pitch, setPitch] = useState<PitchInfo | null>(null);
  const [eventMeta, setEventMeta] = useState<{ starts_at: string; ends_at: string | null } | null>(
    null,
  );

  const [title, setTitle] = useState('Trainingseinheit');
  const [objective, setObjective] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<TrainingSessionStatus>('draft');
  const [eventId, setEventId] = useState<string | null>(eventFromQuery);

  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [requestedExercise, setRequestedExercise] = useState<TrainingExerciseRow | null>(null);
  const [requestedExerciseLoading, setRequestedExerciseLoading] = useState(false);
  const handledExerciseQueryRef = useRef<string | null>(null);
  const openedTrainingViewRef = useRef(false);
  const [mobileExerciseId, setMobileExerciseId] = useState<string | null>(null);
  const [mobileSketchUrls, setMobileSketchUrls] = useState<Record<string, string | null>>({});
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [docMode, setDocMode] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingHandout, setExportingHandout] = useState(false);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [planChangeLoading, setPlanChangeLoading] = useState(false);
  const [replacementPlans, setReplacementPlans] = useState<TrainingSessionRow[]>([]);
  const [replacementTemplates, setReplacementTemplates] = useState<TrainingSessionRow[]>([]);

  const totalMinutes = useMemo(
    () => items.reduce((sum, it) => sum + (it.duration_minutes || 0), 0),
    [items],
  );

  const byPhase = useMemo(() => {
    const map: Record<TrainingPhase, TrainingSessionExerciseRow[]> = {
      AW: [],
      HT1: [],
      HT2: [],
      AK: [],
    };
    for (const it of items) {
      if (map[it.phase]) map[it.phase].push(it);
    }
    for (const p of TRAINING_PHASES) {
      map[p].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [items]);

  const loadPitch = useCallback(async (eid: string | null, clubId: string | null) => {
    if (!eid) {
      setPitch(null);
      setEventMeta(null);
      return;
    }
    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('starts_at, ends_at')
      .eq('id', eid)
      .maybeSingle();
    if (ev) {
      setEventMeta({
        starts_at: ev.starts_at as string,
        ends_at: (ev.ends_at as string | null) ?? null,
      });
    } else if (startsFromQuery && eid === eventFromQuery) {
      setEventMeta({ starts_at: startsFromQuery, ends_at: null });
    } else if (evErr) {
      setEventMeta(null);
    }
    const a = await getAssignmentForEvent(eid);
    if (!a.data) {
      setPitch({ label: 'Platz noch nicht zugeordnet', missing: true });
      return;
    }
    let venueName = '';
    if (clubId) {
      const venues = await listVenuesForClub(clubId);
      venueName = venues.data.find((v) => v.id === a.data!.venue_id)?.name ?? '';
    }
    const fields = await listVenueFields(a.data.venue_id);
    const field = fields.data.find((f) => f.id === a.data!.field_id);
    let zoneName = 'Gesamter Platz';
    if (a.data.zone_id) {
      const zones = await listFieldZones(a.data.field_id);
      zoneName = zones.data.find((z) => z.id === a.data!.zone_id)?.name ?? 'Teilfläche';
    }
    setPitch({
      label: [venueName, field?.name, zoneName].filter(Boolean).join(' · '),
      missing: false,
    });
  }, [startsFromQuery, eventFromQuery]);

  const reload = useCallback(async () => {
    if (!teamSeasonId) {
      setLoading(false);
      setError('Keine Mannschaft/Saison gewählt.');
      return;
    }
    setLoading(true);
    setError(null);
    const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
    if (!clubRes.clubId) {
      setError(clubRes.error ?? 'Kein Vereinskontext.');
      setLoading(false);
      return;
    }

    if (isNew) {
      setSession(null);
      setItems([]);
      setTitle('Trainingseinheit');
      setObjective('');
      setNotes('');
      setStatus('draft');
      setEventId(eventFromQuery);
      await loadPitch(eventFromQuery, clubRes.clubId);
      setLoading(false);
      return;
    }

    const sRes = await getTrainingSession(id!);
    if (sRes.error || !sRes.data) {
      setError(sRes.error ?? 'Einheit nicht gefunden.');
      setLoading(false);
      return;
    }
    setSession(sRes.data);
    setTitle(sRes.data.title);
    setObjective(sRes.data.objective ?? '');
    setNotes(sRes.data.notes ?? '');
    setStatus(sRes.data.status);
    setEventId(sRes.data.event_id);
    await loadPitch(sRes.data.event_id, clubRes.clubId);

    const iRes = await listSessionExercises(sRes.data.id);
    if (iRes.error) setError(iRes.error);
    setItems(iRes.data);

    const map: Record<string, TrainingExerciseRow> = {};
    for (const it of iRes.data) {
      if (it.exercise) map[it.exercise_id] = it.exercise;
    }
    if (Object.keys(map).length < iRes.data.length) {
      const all = await listTrainingExercises(clubRes.clubId, { includeInactive: true });
      for (const ex of all.data) {
        if (iRes.data.some((x) => x.exercise_id === ex.id)) map[ex.id] = ex;
      }
    }
    setExerciseMap(map);
    setDirty(false);
    setLoading(false);
  }, [teamSeasonId, isNew, id, eventFromQuery, loadPitch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let active = true;
    const exercisesWithSketch = Object.values(exerciseMap).filter((exercise) => exercise.image_path);
    if (exercisesWithSketch.length === 0) {
      setMobileSketchUrls({});
      return () => {
        active = false;
      };
    }
    void Promise.all(
      exercisesWithSketch.map(async (exercise) => [
        exercise.id,
        await getTrainingExerciseSketchUrl(exercise.image_path!),
      ] as const),
    ).then((entries) => {
      if (active) setMobileSketchUrls(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [exerciseMap]);

  useEffect(() => {
    if (!isNew || !exerciseFromQuery || !teamSeasonId) return;
    if (handledExerciseQueryRef.current === exerciseFromQuery) return;
    handledExerciseQueryRef.current = exerciseFromQuery;
    let cancelled = false;
    setRequestedExerciseLoading(true);
    setError(null);
    void (async () => {
      const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
      if (!clubRes.clubId || cancelled) {
        if (!cancelled) {
          setError(clubRes.error ?? 'Kein Verein.');
          setRequestedExerciseLoading(false);
        }
        return;
      }
      const res = await listTrainingExercises(clubRes.clubId);
      if (cancelled) return;
      const exercise = res.data.find((candidate) => candidate.id === exerciseFromQuery) ?? null;
      if (!exercise) {
        setError(res.error ?? 'Die ausgewählte Übung wurde nicht gefunden.');
      } else {
        setRequestedExercise(exercise);
      }
      setRequestedExerciseLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseFromQuery, isNew, teamSeasonId]);

  async function ensureSessionId(): Promise<string | null> {
    if (session?.id) return session.id;
    if (!teamSeasonId) {
      setError('Saison fehlt.');
      return null;
    }
    const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
    if (!clubRes.clubId) {
      setError(clubRes.error ?? 'Kein Verein.');
      return null;
    }
    const teamId = contextSeason?.team_id ?? null;
    if (!teamId) {
      setError('Keine Mannschaft im Kontext.');
      return null;
    }
    const created = await createTrainingSession({
      clubId: clubRes.clubId,
      teamId,
      teamSeasonId,
      eventId,
      title: title.trim() || 'Trainingseinheit',
      objective: objective.trim() || null,
      notes: notes.trim() || null,
      status: 'draft',
    });
    if (created.error || !created.data) {
      setError(created.error ?? 'Anlegen fehlgeschlagen.');
      return null;
    }
    setSession(created.data);
    navigate(`/manager/training/einheiten/${created.data.id}`, { replace: true });
    return created.data.id;
  }

  async function saveMeta(nextStatus: TrainingSessionStatus = status) {
    if (nextStatus === 'ready' && items.length === 0) {
      setError('Für eine fertige Planung muss mindestens eine Übung enthalten sein.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const sid = await ensureSessionId();
    if (!sid) {
      setSaving(false);
      return;
    }
    const res = await updateTrainingSession(sid, {
      title: title.trim() || 'Trainingseinheit',
      objective: objective.trim() || null,
      notes: notes.trim() || null,
      status: nextStatus,
      plannedDurationMinutes: totalMinutes || null,
    });
    if (res.error) setError(res.error);
    else {
      setStatus(nextStatus);
      setSuccess(
        nextStatus === 'ready'
          ? 'Planung fertiggestellt. Der Termin wird in der Übersicht grün angezeigt.'
          : nextStatus === 'draft'
            ? 'Entwurf gespeichert.'
            : 'Gespeichert.',
      );
      setDirty(false);
      if (res.data) setSession(res.data);
    }
    setSaving(false);
  }

  async function unlinkEvent() {
    if (!session?.id) return;
    setSaving(true);
    setError(null);
    const res = await unlinkSessionFromEvent(session.id);
    if (res.error) setError(res.error);
    else {
      setSuccess('Verbindung zum Termin entfernt. Termin bleibt bestehen.');
      setSession(res.data);
      setEventId(null);
      setPitch(null);
      setEventMeta(null);
      setConfirmUnlink(false);
    }
    setSaving(false);
  }

  async function openPlanChange() {
    if (!eventId || !teamSeasonId) return;
    setPlanChangeLoading(true);
    setError(null);
    const [sessionResult, clubResult] = await Promise.all([
      listTrainingSessionsForSeason(teamSeasonId),
      resolveClubIdForTeamSeason(teamSeasonId),
    ]);
    if (sessionResult.error) {
      setError(sessionResult.error);
      setPlanChangeLoading(false);
      return;
    }
    let templates: TrainingSessionRow[] = [];
    if (clubResult.clubId) {
      const templateResult = await listTrainingTemplates({ clubId: clubResult.clubId });
      if (templateResult.error) {
        setError(templateResult.error);
        setPlanChangeLoading(false);
        return;
      }
      templates = templateResult.data;
    }
    setReplacementPlans(
      sessionResult.data.filter(
        (candidate) =>
          candidate.id !== session?.id &&
          candidate.record_type !== 'template' &&
          (candidate.status === 'ready' || candidate.status === 'completed'),
      ),
    );
    setReplacementTemplates(templates);
    setPlanChangeOpen(true);
    setPlanChangeLoading(false);
  }

  async function archiveCurrentPlan() {
    if (!session?.id) return;
    const warning = eventId
      ? 'Der Plan wird vom Trainingstermin entfernt und im Archiv abgelegt. Der Termin selbst bleibt bestehen. Fortfahren?'
      : 'Diesen Plan im Archiv ablegen?';
    if (!window.confirm(warning)) return;
    setSaving(true);
    setError(null);
    const result = await archiveTrainingSession(session.id, user?.id ?? null);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate('/manager/training/einheiten');
  }

  async function addExercise(ex: TrainingExerciseRow, phase: TrainingPhase) {
    setSaving(true);
    setError(null);
    const sid = await ensureSessionId();
    if (!sid) {
      setSaving(false);
      return;
    }
    const res = await addExerciseToSession({
      sessionId: sid,
      exerciseId: ex.id,
      phase,
      durationMinutes: ex.duration_minutes,
      sortOrder: byPhase[phase].length,
    });
    if (res.error) setError(res.error);
    else {
      setExerciseMap((m) => ({ ...m, [ex.id]: ex }));
      if (res.data) setItems((current) => [...current, res.data!]);
      setRequestedExercise(null);
      setSuccess('Übung hinzugefügt.');
    }
    setSaving(false);
  }

  async function openExerciseLibrary(
    phase: TrainingPhase,
    replaceItemId?: string,
  ): Promise<void> {
    setSaving(true);
    setError(null);
    const sid = await ensureSessionId();
    setSaving(false);
    if (!sid) return;

    const returnTo = `/manager/training/einheiten/${sid}`;
    const params = new URLSearchParams({
      session: sid,
      phase,
      returnTo,
    });
    if (replaceItemId) params.set('replace', replaceItemId);
    navigate(`/manager/training/bibliothek?${params.toString()}`);
  }

  function openPickerForPhase(phase: TrainingPhase) {
    void openExerciseLibrary(phase);
  }

  function openReplacePicker(item: TrainingSessionExerciseRow) {
    void openExerciseLibrary(item.phase, item.id);
  }

  function cancelRequestedExercise() {
    setRequestedExercise(null);
    navigate('/manager/training/einheiten/neu', { replace: true });
  }

  async function exportWord() {
    if (!session || items.length === 0) {
      setError('Bitte zuerst mindestens eine Übung zur Einheit hinzufügen.');
      return;
    }
    setExportingWord(true);
    setError(null);
    setSuccess(null);
    try {
      const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
      const trainerName =
        String(metadata.full_name ?? metadata.name ?? '').trim() || user?.email?.split('@')[0] || '';
      const teamName =
        (contextSeason?.display_name ?? '').trim() ||
        (contextSeason?.age_group ?? '').trim() ||
        contextSeason?.team?.name ||
        '';
      await downloadTrainingSessionWord({
        session,
        items,
        exerciseMap,
        trainerName,
        teamName,
        dateIso: eventMeta?.starts_at ?? session.created_at ?? null,
      });
      setSuccess('Word-Datei wurde erstellt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Word-Export fehlgeschlagen.');
    } finally {
      setExportingWord(false);
    }
  }

  async function printHandout() {
    if (!session || items.length === 0) {
      setError('Bitte zuerst mindestens eine Übung zur Einheit hinzufügen.');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Das Handout konnte nicht geöffnet werden. Bitte Pop-ups für diese Seite erlauben.');
      return;
    }
    printWindow.document.write('<p style="font-family:Arial;padding:24px">A4-Handout wird erstellt…</p>');
    setExportingHandout(true);
    setError(null);
    setSuccess(null);
    try {
      const sketchEntries = await Promise.all(
        Object.values(exerciseMap).map(async (exercise) => [
          exercise.id,
          exercise.image_path ? await getTrainingExerciseSketchUrl(exercise.image_path) : null,
        ] as const),
      );
      const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
      const trainerName =
        String(metadata.full_name ?? metadata.name ?? '').trim() || user?.email?.split('@')[0] || '';
      const teamName =
        (contextSeason?.display_name ?? '').trim() ||
        (contextSeason?.age_group ?? '').trim() ||
        contextSeason?.team?.name ||
        '';
      const html = createTrainingSessionHandoutHtml({
        session,
        items,
        exerciseMap,
        sketchUrls: Object.fromEntries(sketchEntries),
        trainerName,
        teamName,
        dateIso: eventMeta?.starts_at ?? session.created_at ?? null,
      });
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      setSuccess('A4-Handout wurde geöffnet.');
    } catch (err) {
      printWindow.close();
      setError(err instanceof Error ? err.message : 'A4-Handout konnte nicht erstellt werden.');
    } finally {
      setExportingHandout(false);
    }
  }

  async function moveItem(item: TrainingSessionExerciseRow, dir: -1 | 1) {
    const list = byPhase[item.phase];
    const idx = list.findIndex((x) => x.id === item.id);
    const swap = list[idx + dir];
    if (!swap) return;
    setSaving(true);
    await updateSessionExercise(item.id, { sortOrder: swap.sort_order });
    await updateSessionExercise(swap.id, { sortOrder: item.sort_order });
    await reload();
    setSaving(false);
  }

  async function changeDuration(item: TrainingSessionExerciseRow, minutes: number) {
    const m = Math.max(1, Math.min(300, Math.round(minutes) || 1));
    await updateSessionExercise(item.id, { durationMinutes: m });
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, duration_minutes: m } : x)));
    setDirty(true);
  }

  async function changeNotes(item: TrainingSessionExerciseRow, text: string) {
    await updateSessionExercise(item.id, { coachNotes: text.trim() || null });
    setItems((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, coach_notes: text.trim() || null } : x)),
    );
  }

  async function removeItem(item: TrainingSessionExerciseRow) {
    if (!window.confirm('Übung aus dieser Einheit entfernen? Die Übung bleibt in der Bibliothek.')) {
      return;
    }
    setSaving(true);
    const res = await removeExerciseFromSession(item.id, item.training_session_id);
    if (res.error) setError(res.error);
    else await reload();
    setSaving(false);
  }

  const mobileItems = useMemo(() => {
    const ordered: TrainingSessionExerciseRow[] = [];
    for (const p of TRAINING_PHASES) ordered.push(...byPhase[p]);
    return ordered;
  }, [byPhase]);

  const mobileIndex = mobileExerciseId
    ? mobileItems.findIndex((x) => x.id === mobileExerciseId)
    : -1;

  const safeReturnTo = returnToFromQuery?.startsWith('/app/events/') ? returnToFromQuery : null;
  const safeManagerReturnTo = returnToFromQuery === '/manager/training/einheiten?tab=exam'
    ? returnToFromQuery
    : null;

  const openExerciseEditor = (item: TrainingSessionExerciseRow, returnToTrainingView = false) => {
    if (!session?.id || seasonArchived) return;
    const returnParams = returnToTrainingView
      ? new URLSearchParams({
          view: 'training',
          exerciseItem: item.id,
          ...(safeReturnTo ? { returnTo: safeReturnTo } : {}),
        })
      : null;
    const editorReturnTo = `/manager/training/einheiten/${session.id}${
      returnParams ? `?${returnParams.toString()}` : ''
    }`;
    const libraryParams = new URLSearchParams({
      edit: item.exercise_id,
      returnTo: editorReturnTo,
    });
    navigate(`/manager/training/bibliothek?${libraryParams.toString()}`);
  };

  const closeTrainingView = () => {
    if (safeReturnTo) {
      navigate(safeReturnTo);
      return;
    }
    setMobileExerciseId(null);
  };

  const openQuickReplace = (item: TrainingSessionExerciseRow) => {
    if (!session?.id || seasonArchived) return;
    const trainingViewParams = new URLSearchParams({
      view: 'training',
      exerciseItem: item.id,
      ...(safeReturnTo ? { returnTo: safeReturnTo } : {}),
    });
    const libraryReturnTo = `/manager/training/einheiten/${session.id}?${trainingViewParams.toString()}`;
    const libraryParams = new URLSearchParams({
      session: session.id,
      phase: item.phase,
      replace: item.id,
      quick: '1',
      returnTo: libraryReturnTo,
    });
    navigate(`/manager/training/bibliothek?${libraryParams.toString()}`);
  };

  useEffect(() => {
    if (viewFromQuery !== 'training' || openedTrainingViewRef.current || mobileItems.length === 0) return;
    openedTrainingViewRef.current = true;
    const requestedItem = exerciseItemFromQuery
      ? mobileItems.find((item) => item.id === exerciseItemFromQuery)
      : null;
    setMobileExerciseId(requestedItem?.id ?? mobileItems[0].id);
  }, [exerciseItemFromQuery, mobileItems, viewFromQuery]);

  const trainingEvents = useMemo(
    () =>
      events
        .filter((e) => e.kind === 'training' || e.type === 'training')
        .filter((e) => String(e.status ?? '').toLowerCase() !== 'canceled'),
    [events],
  );

  const eventPastOrNow = useMemo(() => {
    if (!eventMeta?.starts_at) return false;
    return new Date(eventMeta.starts_at).getTime() <= Date.now() + 30 * 60 * 1000;
  }, [eventMeta?.starts_at]);

  const linkedTrainingEvent = useMemo(() => {
    if (!eventId) return null;
    const knownEvent = trainingEvents.find((candidate) => candidate.id === eventId);
    if (knownEvent) return { id: knownEvent.id, starts_at: knownEvent.starts_at };
    if (eventMeta?.starts_at) return { id: eventId, starts_at: eventMeta.starts_at };
    return null;
  }, [eventId, eventMeta?.starts_at, trainingEvents]);

  const replacementLastSession = useMemo(
    () =>
      [...replacementPlans].sort((a, b) =>
        String(b.completed_at ?? b.updated_at ?? b.created_at ?? '').localeCompare(
          String(a.completed_at ?? a.updated_at ?? a.created_at ?? ''),
        ),
      )[0] ?? null,
    [replacementPlans],
  );

  if (loading) {
    return <p className="text-[13px] text-slate-400">Einheit wird geladen…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Link to="/manager/training/einheiten" className="hover:text-red-700">
              Trainingsplanung
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {isNew && !session ? 'Neue Trainingseinheit' : title || 'Trainingseinheit'}
          </h1>
          {dirty ? (
            <p className="mt-1 text-[12px] font-medium text-amber-700">Ungespeicherte Änderungen</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={safeManagerReturnTo ?? safeReturnTo ?? '/manager/training/einheiten'}
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800"
          >
            {safeManagerReturnTo ? 'Zur Trainerprüfung' : safeReturnTo ? 'Zum Trainingscenter' : 'Zurück'}
          </Link>
          {session?.id ? (
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => setMobileExerciseId(mobileItems[0]?.id ?? null)}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 disabled:opacity-50"
            >
              Training ansehen
            </button>
          ) : null}
          {session?.id ? (
            <button
              type="button"
              onClick={() => setCopyOpen(true)}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800"
            >
              Einheit kopieren
            </button>
          ) : null}
          {eventId && status !== 'completed' && status !== 'archived' ? (
            <button
              type="button"
              disabled={saving || planChangeLoading || seasonArchived}
              onClick={() => void openPlanChange()}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 disabled:opacity-50"
            >
              {planChangeLoading
                ? 'Pläne werden geladen…'
                : session?.id
                  ? 'Plan wechseln'
                  : 'Plan oder Vorlage auswählen'}
            </button>
          ) : null}
          {session?.id ? (
            <button
              type="button"
              disabled={exportingWord || saving || items.length === 0}
              onClick={() => void exportWord()}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 disabled:opacity-50"
            >
              {exportingWord ? 'Word wird erstellt…' : 'Word exportieren'}
            </button>
          ) : null}
          {session?.id ? (
            <button
              type="button"
              disabled={exportingHandout || saving || items.length === 0}
              onClick={() => void printHandout()}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 disabled:opacity-50"
            >
              {exportingHandout ? 'Handout wird erstellt…' : 'A4-Handout drucken'}
            </button>
          ) : null}
          {session?.id && session.record_type === 'session' && (eventPastOrNow || session.status === 'completed') ? (
            <a
              href="#training-doc"
              onClick={() => setDocMode(true)}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800"
            >
              Training dokumentieren
            </a>
          ) : null}
          {status === 'draft' ? (
            <button
              type="button"
              disabled={saving || seasonArchived}
              onClick={() => void saveMeta('draft')}
              className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 disabled:opacity-50"
            >
              {saving ? 'Speichern…' : 'Entwurf speichern'}
            </button>
          ) : null}
          {status !== 'completed' && status !== 'archived' ? (
            <button
              type="button"
              disabled={saving || seasonArchived || (status === 'draft' && items.length === 0)}
              onClick={() => void saveMeta(status === 'draft' ? 'ready' : status)}
              className="inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? 'Speichern…'
                : status === 'draft'
                  ? eventId
                    ? 'Planung fertigstellen'
                    : 'Als fertigen Plan speichern'
                  : 'Änderungen speichern'}
            </button>
          ) : null}
          {session?.id && status !== 'completed' ? (
            <details className="relative">
              <summary className="inline-flex min-h-[40px] cursor-pointer list-none items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800">
                Mehr
              </summary>
              <div className="absolute right-0 z-20 mt-2 min-w-[190px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {status === 'archived' ? (
                  <button
                    type="button"
                    disabled={saving || seasonArchived}
                    onClick={() => void saveMeta('draft')}
                    className="w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Wiederherstellen
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving || seasonArchived}
                    onClick={() => void archiveCurrentPlan()}
                    className="w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Archivieren
                  </button>
                )}
              </div>
            </details>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          {success}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-semibold text-slate-600 sm:col-span-2">
            Titel
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900"
            />
          </label>
          <label className="block text-[12px] font-semibold text-slate-600 sm:col-span-2">
            Trainingsziel
            <textarea
              value={objective}
              onChange={(e) => {
                setObjective(e.target.value);
                setDirty(true);
              }}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900"
            />
          </label>
          <label className="block text-[12px] font-semibold text-slate-600">
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as TrainingSessionStatus);
                setDirty(true);
              }}
              disabled={status === 'completed' || status === 'archived'}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] disabled:bg-slate-50"
            >
              <option value="draft">{TRAINING_SESSION_STATUS_LABELS.draft}</option>
              <option value="ready">{TRAINING_SESSION_STATUS_LABELS.ready}</option>
              {status === 'completed' ? (
                <option value="completed">{TRAINING_SESSION_STATUS_LABELS.completed}</option>
              ) : null}
              {status === 'archived' ? (
                <option value="archived">{TRAINING_SESSION_STATUS_LABELS.archived}</option>
              ) : null}
            </select>
            <span className="mt-1 block text-[11px] font-normal text-slate-500">
              Entwurf bleibt gelb. „Planung fertigstellen“ setzt den Termin auf grün.
            </span>
          </label>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-slate-400">Gesamtdauer</p>
            <p className="text-lg font-semibold text-slate-900">{totalMinutes} Min.</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <p className="text-[12px] font-semibold text-slate-700">Verknüpfter Trainingstermin</p>
          {eventMeta ? (
            <p className="text-[14px] text-slate-800">{formatWhen(eventMeta.starts_at)}</p>
          ) : eventId ? (
            <p className="text-[13px] text-slate-600">
              Termin verknüpft (Details werden geladen oder sind eingeschränkt sichtbar).
            </p>
          ) : (
            <p className="text-[13px] text-slate-500">Kein Termin verknüpft (Entwurf möglich).</p>
          )}
          {pitch ? (
            <p className="text-[13px] text-slate-600">
              {pitch.label}
              {pitch.missing ? (
                <>
                  {' · '}
                  <Link to="/manager/platzbelegung" className="font-semibold text-red-700">
                    Zur Platzbelegung
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {!eventId ? (
              <p className="text-[12px] text-slate-400">
                Termin über „Training planen“ in der Übersicht verknüpfen.
              </p>
            ) : !session?.id ? (
              <p className="text-[12px] text-slate-500">
                Termin wird beim Speichern mit dieser Einheit verbunden.
              </p>
            ) : !confirmUnlink ? (
              <button
                type="button"
                onClick={() => setConfirmUnlink(true)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700"
              >
                Verbindung entfernen
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-amber-800">Termin bleibt erhalten. Verbindung wirklich lösen?</span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void unlinkEvent()}
                  className="rounded-full bg-red-700 px-3 py-1 text-white"
                >
                  Ja, lösen
                </button>
                <button type="button" onClick={() => setConfirmUnlink(false)} className="text-slate-600">
                  Abbrechen
                </button>
              </div>
            )}
          </div>
        </div>

        <label className="mt-4 block text-[12px] font-semibold text-slate-600">
          Notizen
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setDirty(true);
            }}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px]"
          />
        </label>
      </section>

      {session?.id && session.record_type === 'session' ? (
        <ManagerTrainingAttendanceReadOnly eventId={eventId} teamSeasonId={teamSeasonId} />
      ) : null}

      {session?.id && (docMode || eventPastOrNow || session.status === 'completed') ? (
        <ManagerTrainingDocumentationPanel
          session={session}
          items={items}
          exerciseMap={exerciseMap}
          userId={user?.id}
          readOnlyCompleted={session.status === 'completed'}
          onUpdated={(s) => {
            setSession(s);
            setStatus(s.status);
          }}
          onItemsChanged={() => void reload()}
          onError={setError}
          onSuccess={setSuccess}
        />
      ) : null}

      <div className="space-y-4">
        {TRAINING_PHASES.map((phase) => {
          const list = byPhase[phase];
          const sub = list.reduce((s, it) => s + it.duration_minutes, 0);
          return (
            <section
              key={phase}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-slate-900">
                  {TRAINING_PHASE_LABELS[phase]}
                  <span className="ml-2 text-[13px] font-normal text-slate-500">{sub} Min.</span>
                </h2>
                <button
                  type="button"
                  disabled={seasonArchived}
                  onClick={() => openPickerForPhase(phase)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Übung hinzufügen
                </button>
              </div>
              {list.length === 0 ? (
                <p className="text-[13px] text-slate-400">Noch keine Übungen in dieser Phase.</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((it, idx) => {
                    const ex = exerciseMap[it.exercise_id];
                    return (
                      <li key={it.id}>
                        <TrainingSessionExerciseCard
                          item={it}
                          exercise={ex}
                          sketchUrl={ex ? mobileSketchUrls[ex.id] : null}
                          onView={() => setDetailItemId(it.id)}
                          onEdit={() => openExerciseEditor(it)}
                          onReplace={() => openReplacePicker(it)}
                          onRemove={() => void removeItem(it)}
                          onDurationChange={(minutes) => void changeDuration(it, minutes)}
                          onNotesChange={(text) => void changeNotes(it, text)}
                          onMoveUp={() => void moveItem(it, -1)}
                          onMoveDown={() => void moveItem(it, 1)}
                          canMoveUp={idx > 0}
                          canMoveDown={idx < list.length - 1}
                          saving={saving}
                          readOnly={seasonArchived}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="space-y-3 md:hidden">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          Am Trainingsplatz
        </p>
        {mobileItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-[13px] text-slate-500">
            Noch keine Übungen – am Desktop oder Tablet hinzufügen.
          </p>
        ) : (
          TRAINING_PHASES.map((phase) => {
            const list = byPhase[phase];
            if (!list.length) return null;
            return (
              <details key={phase} open className="rounded-2xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-[15px] font-semibold text-slate-900">
                  {TRAINING_PHASE_LABELS[phase]}
                </summary>
                <ul className="space-y-2 border-t border-slate-100 px-3 py-3">
                  {list.map((it) => {
                    const ex = exerciseMap[it.exercise_id];
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => setMobileExerciseId(it.id)}
                          className="flex w-full min-h-[52px] items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-3 text-left"
                        >
                          <span className="font-semibold text-slate-900">{ex?.title ?? 'Übung'}</span>
                          <span className="text-[13px] text-slate-500">{it.duration_minutes}′</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })
        )}
      </div>

      {mobileExerciseId && mobileIndex >= 0 ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white sm:bg-slate-900/30 sm:p-4">
          <div className="flex min-h-0 flex-1 flex-col bg-white sm:mx-auto sm:max-w-3xl sm:rounded-2xl sm:shadow-xl">
          {(() => {
            const it = mobileItems[mobileIndex];
            const ex = exerciseMap[it.exercise_id];
            return (
              <>
                <div className="flex items-center justify-between border-b border-slate-200 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <button
                    type="button"
                    onClick={closeTrainingView}
                    className="text-[14px] font-semibold text-red-700"
                  >
                    {safeReturnTo ? '← Trainingscenter' : 'Schließen'}
                  </button>
                  <span className="text-[12px] text-slate-500">
                    {mobileIndex + 1} / {mobileItems.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    {TRAINING_PHASE_LABELS[it.phase]}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">{ex?.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] text-slate-600">{it.duration_minutes} Minuten</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving || seasonArchived}
                        onClick={() => openExerciseEditor(it, true)}
                        className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Übung bearbeiten
                      </button>
                      <button
                        type="button"
                        disabled={saving || seasonArchived}
                        onClick={() => openQuickReplace(it)}
                        className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 text-[13px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                      >
                        Übung austauschen
                      </button>
                    </div>
                  </div>
                  {ex?.image_path && mobileSketchUrls[ex.id] ? (
                    <figure className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
                      <img
                        src={mobileSketchUrls[ex.id] ?? undefined}
                        alt={`Skizze: ${ex.title}`}
                        className="max-h-[34vh] w-full rounded-xl bg-white object-contain"
                      />
                    </figure>
                  ) : ex?.image_path ? (
                    <div className="mt-4 flex min-h-40 items-center justify-center rounded-2xl bg-slate-100 text-[13px] text-slate-500">
                      Skizze wird geladen…
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-[13px] text-slate-500">
                      Für diese Übung ist noch keine Skizze hinterlegt.
                    </div>
                  )}
                  {ex?.organization ? (
                    <section className="mt-4">
                      <h3 className="text-[12px] font-semibold text-slate-500">Aufbau</h3>
                      <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
                        {ex.organization}
                      </p>
                    </section>
                  ) : null}
                  {ex?.materials ? (
                    <section className="mt-4">
                      <h3 className="text-[12px] font-semibold text-slate-500">Material</h3>
                      <p className="mt-1 whitespace-pre-wrap text-[15px] text-slate-800">{ex.materials}</p>
                    </section>
                  ) : null}
                  {ex?.coaching_points ? (
                    <section className="mt-4">
                      <h3 className="text-[12px] font-semibold text-slate-500">Coachingpunkte</h3>
                      <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
                        {ex.coaching_points}
                      </p>
                    </section>
                  ) : null}
                  {ex?.variations ? (
                    <section className="mt-4">
                      <h3 className="text-[12px] font-semibold text-slate-500">Variationen</h3>
                      <p className="mt-1 whitespace-pre-wrap text-[15px] text-slate-800">{ex.variations}</p>
                    </section>
                  ) : null}
                  {it.coach_notes || !seasonArchived ? (
                    <section className="mt-4 rounded-xl bg-amber-50 px-3 py-3">
                      <h3 className="text-[12px] font-semibold text-amber-800">
                        Praxisnotiz für diese Einheit
                      </h3>
                      {seasonArchived ? (
                        <p className="mt-1 whitespace-pre-wrap text-[15px] text-amber-950">{it.coach_notes}</p>
                      ) : (
                        <>
                          <textarea
                            defaultValue={it.coach_notes ?? ''}
                            onBlur={(event) => void changeNotes(it, event.target.value)}
                            rows={3}
                            placeholder="Was klappt nicht? Was beim nächsten Mal ändern?"
                            className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-[15px] leading-relaxed text-slate-900"
                          />
                          <p className="mt-1 text-[11px] text-amber-700">
                            Wird beim Verlassen des Feldes gespeichert und gilt nur für dieses Training.
                          </p>
                        </>
                      )}
                    </section>
                  ) : null}
                  {session?.record_type === 'session' ? (
                    <section className="mt-4 space-y-2">
                      <h3 className="text-[12px] font-semibold text-slate-500">Markierung</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(TRAINING_EXERCISE_REVIEW_LABELS) as TrainingExerciseReviewStatus[]).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                void updateExerciseReview(it.id, {
                                  reviewStatus: st,
                                  wasCompleted: st === 'not_done' ? false : true,
                                  repeatRecommended: st === 'repeat',
                                }).then((res) => {
                                  if (res.error) setError(res.error);
                                  else void reload();
                                });
                              }}
                              className={`min-h-[44px] rounded-full px-3 text-[12px] font-semibold ${
                                it.review_status === st
                                  ? 'bg-red-700 text-white'
                                  : 'border border-slate-200 bg-white text-slate-700'
                              }`}
                            >
                              {TRAINING_EXERCISE_REVIEW_LABELS[st]}
                            </button>
                          ),
                        )}
                      </div>
                    </section>
                  ) : null}
                </div>
                <div className="flex gap-2 border-t border-slate-200 p-3">
                  <button
                    type="button"
                    disabled={mobileIndex <= 0}
                    onClick={() => setMobileExerciseId(mobileItems[mobileIndex - 1].id)}
                    className="min-h-[48px] flex-1 rounded-xl border border-slate-200 font-semibold disabled:opacity-40"
                  >
                    Vorherige
                  </button>
                  <button
                    type="button"
                    disabled={mobileIndex >= mobileItems.length - 1}
                    onClick={() => setMobileExerciseId(mobileItems[mobileIndex + 1].id)}
                    className="min-h-[48px] flex-1 rounded-xl bg-red-700 font-semibold text-white disabled:opacity-40"
                  >
                    Nächste
                  </button>
                </div>
              </>
            );
          })()}
          </div>
        </div>
      ) : null}

      {detailItemId ? (() => {
        const detailItem = items.find((x) => x.id === detailItemId);
        const detailExercise = detailItem ? exerciseMap[detailItem.exercise_id] : undefined;
        if (!detailItem || !detailExercise) return null;
        return (
          <TrainingExerciseDetailModal
            row={detailExercise}
            phaseLabel={TRAINING_PHASE_LABELS[detailItem.phase]}
            onClose={() => setDetailItemId(null)}
          />
        );
      })() : null}

      {requestedExercise || requestedExerciseLoading ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="requested-exercise-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">
                  Zur Trainingseinheit
                </p>
                <h3 id="requested-exercise-title" className="mt-1 text-lg font-semibold text-slate-900">
                  {requestedExerciseLoading ? 'Übung wird geladen…' : requestedExercise?.title}
                </h3>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={cancelRequestedExercise}
                className="text-[13px] text-slate-600 disabled:opacity-50"
              >
                Abbrechen
              </button>
            </div>
            {requestedExercise ? (
              <>
                <p className="mt-3 text-[13px] text-slate-600">
                  In welchen Abschnitt möchtest du diese Übung einfügen?
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {TRAINING_PHASES.map((phase) => {
                    const recommended = requestedExercise.suitable_phases.includes(phase);
                    return (
                      <button
                        key={phase}
                        type="button"
                        disabled={saving}
                        onClick={() => void addExercise(requestedExercise, phase)}
                        className={`min-h-[58px] rounded-xl border px-3 py-2 text-left disabled:opacity-50 ${
                          recommended
                            ? 'border-red-200 bg-red-50 text-red-900'
                            : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-[13px] font-semibold">
                          {TRAINING_PHASE_LABELS[phase]}
                        </span>
                        <span className="text-[11px] opacity-70">
                          {recommended ? 'Empfohlen' : TRAINING_PHASE_SHORT[phase]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {session && copyOpen ? (
        <ManagerTrainingCopyDialog
          open={copyOpen}
          session={session}
          trainingEvents={trainingEvents}
          onClose={() => setCopyOpen(false)}
        />
      ) : null}

      {planChangeOpen ? (
        <ManagerTrainingPlanPickerDialog
          event={linkedTrainingEvent}
          savedPlans={replacementPlans}
          templates={replacementTemplates}
          lastSession={replacementLastSession}
          replaceTarget={session}
          userId={user?.id ?? null}
          onClose={() => setPlanChangeOpen(false)}
          onReplaced={(updated) => {
            setSession(updated);
            setTitle(updated.title);
            setObjective(updated.objective ?? '');
            setNotes(updated.notes ?? '');
            setStatus('draft');
            setDirty(false);
            setSuccess(
              'Plan ersetzt. Termin, Platz und Beteiligung wurden beibehalten. Bitte prüfen und Planung fertigstellen.',
            );
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}
