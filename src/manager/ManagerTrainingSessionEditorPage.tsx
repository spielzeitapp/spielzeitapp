/**
 * STEP 3A: Trainingseinheit-Editor (Desktop/Tablet) + mobile Trainingsansicht.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { supabase } from '../lib/supabaseClient';
import { resolveClubIdForTeamSeason, listVenuesForClub } from '../lib/venues';
import { getAssignmentForEvent } from '../lib/eventFieldAssignments';
import { listVenueFields, listFieldZones } from '../lib/venueFields';
import {
  addExerciseToSession,
  createTrainingSession,
  getTrainingSession,
  listSessionExercises,
  removeExerciseFromSession,
  unlinkSessionFromEvent,
  updateSessionExercise,
  updateTrainingSession,
  type TrainingSessionExerciseRow,
  type TrainingSessionRow,
} from '../lib/trainingSessions';
import { listTrainingExercises, type TrainingExerciseRow } from '../lib/trainingExercises';
import {
  TRAINING_PHASES,
  TRAINING_PHASE_LABELS,
  TRAINING_SESSION_STATUS_LABELS,
  type TrainingPhase,
  type TrainingSessionStatus,
} from '../lib/trainingPhases';
import { isSeasonArchived } from '../lib/seasonLifecycle';
import { VIENNA_TZ } from '../lib/viennaTime';

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
  const navigate = useNavigate();

  const { selectedTeamSeasonId, selectedTeamSeason, viewTeamSeason } = useSession();
  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;
  const seasonArchived = contextSeason ? isSeasonArchived(contextSeason.status) : false;

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

  const [pickerPhase, setPickerPhase] = useState<TrainingPhase | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [library, setLibrary] = useState<TrainingExerciseRow[]>([]);
  const [mobileExerciseId, setMobileExerciseId] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

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
    const { data: ev } = await supabase.from('events').select('starts_at, ends_at').eq('id', eid).maybeSingle();
    if (ev) {
      setEventMeta({
        starts_at: ev.starts_at as string,
        ends_at: (ev.ends_at as string | null) ?? null,
      });
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
  }, []);

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
    if (!pickerPhase || !teamSeasonId) return;
    let cancelled = false;
    (async () => {
      const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
      if (!clubRes.clubId || cancelled) return;
      const res = await listTrainingExercises(clubRes.clubId);
      if (cancelled) return;
      const q = pickerQuery.trim().toLowerCase();
      setLibrary(
        res.data.filter((ex) => {
          if (!ex.suitable_phases.includes(pickerPhase)) return false;
          if (!q) return true;
          return (
            ex.title.toLowerCase().includes(q) ||
            (ex.focus ?? '').toLowerCase().includes(q) ||
            (ex.description ?? '').toLowerCase().includes(q)
          );
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [pickerPhase, pickerQuery, teamSeasonId]);

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

  async function saveMeta() {
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
      status,
      plannedDurationMinutes: totalMinutes || null,
    });
    if (res.error) setError(res.error);
    else {
      setSuccess('Gespeichert.');
      setDirty(false);
      if (res.data) setSession(res.data);
    }
    setSaving(false);
  }

  async function linkEventFromQuery() {
    if (!eventFromQuery?.trim()) return;
    setSaving(true);
    setError(null);
    setEventId(eventFromQuery);
    const sid = await ensureSessionId();
    if (!sid) {
      setSaving(false);
      return;
    }
    const res = await updateTrainingSession(sid, { eventId: eventFromQuery.trim() });
    if (res.error) setError(res.error);
    else {
      setSuccess('Mit Termin verbunden.');
      setSession(res.data);
      setEventId(res.data?.event_id ?? eventFromQuery);
      const clubRes = await resolveClubIdForTeamSeason(teamSeasonId!);
      await loadPitch(eventFromQuery.trim(), clubRes.clubId);
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
      setPickerPhase(null);
      await reload();
      setSuccess('Übung hinzugefügt.');
    }
    setSaving(false);
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
            to="/manager/training/einheiten"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800"
          >
            Zurück
          </Link>
          <button
            type="button"
            disabled={saving || seasonArchived}
            onClick={() => void saveMeta()}
            className="inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
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
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px]"
            >
              <option value="draft">{TRAINING_SESSION_STATUS_LABELS.draft}</option>
              <option value="ready">{TRAINING_SESSION_STATUS_LABELS.ready}</option>
              <option value="archived">{TRAINING_SESSION_STATUS_LABELS.archived}</option>
            </select>
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
              eventFromQuery ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void linkEventFromQuery()}
                  className="rounded-full bg-red-700 px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  Termin verbinden
                </button>
              ) : (
                <p className="text-[12px] text-slate-400">
                  Termin über „Training planen“ in der Übersicht verknüpfen.
                </p>
              )
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

      <div className="hidden space-y-4 md:block">
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
                  onClick={() => setPickerPhase(phase)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Übung hinzufügen
                </button>
              </div>
              {list.length === 0 ? (
                <p className="text-[13px] text-slate-400">Noch keine Übungen in dieser Phase.</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((it, idx) => {
                    const ex = exerciseMap[it.exercise_id];
                    return (
                      <li key={it.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900">{ex?.title ?? 'Übung'}</p>
                            <p className="text-[12px] text-slate-500">{ex?.focus ?? ''}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0 || saving}
                              onClick={() => void moveItem(it, -1)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] disabled:opacity-40"
                              aria-label="Nach oben"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={idx >= list.length - 1 || saving}
                              onClick={() => void moveItem(it, 1)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] disabled:opacity-40"
                              aria-label="Nach unten"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeItem(it)}
                              className="rounded-lg px-2 py-1 text-[12px] text-red-700"
                            >
                              Entfernen
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <label className="text-[12px] text-slate-600">
                            Dauer (Min.)
                            <input
                              type="number"
                              min={1}
                              max={300}
                              value={it.duration_minutes}
                              onChange={(e) => void changeDuration(it, Number(e.target.value))}
                              className="ml-2 w-16 rounded-lg border border-slate-200 px-2 py-1"
                            />
                          </label>
                        </div>
                        <label className="mt-2 block text-[12px] text-slate-600">
                          Trainerhinweise
                          <textarea
                            defaultValue={it.coach_notes ?? ''}
                            onBlur={(e) => void changeNotes(it, e.target.value)}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px]"
                          />
                        </label>
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
        <div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden">
          {(() => {
            const it = mobileItems[mobileIndex];
            const ex = exerciseMap[it.exercise_id];
            return (
              <>
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setMobileExerciseId(null)}
                    className="text-[14px] font-semibold text-red-700"
                  >
                    Schließen
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
                  <p className="mt-1 text-[14px] text-slate-600">{it.duration_minutes} Minuten</p>
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
                  {it.coach_notes ? (
                    <section className="mt-4 rounded-xl bg-amber-50 px-3 py-3">
                      <h3 className="text-[12px] font-semibold text-amber-800">Trainerhinweise</h3>
                      <p className="mt-1 whitespace-pre-wrap text-[15px] text-amber-950">{it.coach_notes}</p>
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
      ) : null}

      {pickerPhase ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-900">
                Übung für {TRAINING_PHASE_LABELS[pickerPhase]}
              </h3>
              <button type="button" onClick={() => setPickerPhase(null)} className="text-[13px] text-slate-600">
                Schließen
              </button>
            </div>
            <div className="border-b border-slate-100 px-4 py-2">
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Suchen…"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px]"
              />
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {library.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px] text-slate-400">
                  Keine passenden Übungen.{' '}
                  <Link to="/manager/training/bibliothek" className="text-red-700">
                    Bibliothek
                  </Link>
                </li>
              ) : (
                library.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void addExercise(ex, pickerPhase)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left hover:bg-slate-50"
                    >
                      <span>
                        <span className="block font-semibold text-slate-900">{ex.title}</span>
                        <span className="text-[12px] text-slate-500">
                          {ex.focus} · {ex.duration_minutes} Min.
                        </span>
                      </span>
                      <span className="text-[12px] font-semibold text-red-700">Hinzufügen</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
