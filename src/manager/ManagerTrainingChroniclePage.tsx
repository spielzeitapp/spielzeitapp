/**
 * STEP 3C: Trainingschronik – durchgeführte Einheiten.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { useEvents } from '../hooks/useEvents';
import { resolveClubIdForTeamSeason } from '../lib/venues';
import { listChronicleSessions } from '../lib/trainingSessionOps';
import { listSessionExercises, type TrainingSessionRow } from '../lib/trainingSessions';
import {
  EXERCISE_FOCUS_LABELS,
  TRAINING_REVIEW_RATING_LABELS,
  TRAINING_SESSION_STATUS_LABELS,
  type ExerciseFocus,
  type TrainingSessionStatus,
} from '../lib/trainingPhases';
import { ManagerTrainingCopyDialog } from './ManagerTrainingCopyDialog';
import { getAssignmentForEvent } from '../lib/eventFieldAssignments';
import { listVenueFields, listFieldZones } from '../lib/venueFields';
import { listVenuesForClub } from '../lib/venues';
import { VIENNA_TZ } from '../lib/viennaTime';
import { useEventsAttendance } from '../hooks/useEventsAttendance';

type ChronicleCard = TrainingSessionRow & {
  plannedExercises: number;
  doneExercises: number;
  pitchLabel: string | null;
  eventStartsAt: string | null;
};

function formatDay(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: VIENNA_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function ManagerTrainingChroniclePage(): React.ReactElement {
  const { selectedTeamSeasonId, selectedTeamSeason, viewTeamSeason, teamSeasons } = useSession();
  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;

  const { events } = useEvents(teamSeasonId);
  const [rows, setRows] = useState<ChronicleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<TrainingSessionStatus | 'all'>('completed');
  const [focus, setFocus] = useState<ExerciseFocus | 'all'>('all');
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterSeasonId, setFilterSeasonId] = useState<string>(teamSeasonId ?? '');
  const [copySession, setCopySession] = useState<TrainingSessionRow | null>(null);

  useEffect(() => {
    setFilterSeasonId(teamSeasonId ?? '');
  }, [teamSeasonId]);

  const trainings = useMemo(
    () => events.filter((e) => e.kind === 'training' || e.type === 'training'),
    [events],
  );

  const eventStarts = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of trainings) m[e.id] = e.starts_at;
    return m;
  }, [trainings]);

  const attendanceIds = useMemo(
    () => rows.map((r) => r.event_id).filter(Boolean) as string[],
    [rows],
  );
  const { byEventId: attendance } = useEventsAttendance(attendanceIds);

  const reload = useCallback(async () => {
    const seasonId = filterSeasonId || teamSeasonId;
    if (!seasonId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const clubRes = await resolveClubIdForTeamSeason(seasonId);
    const fromIso = fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : null;
    const toIso = toDate ? new Date(`${toDate}T23:59:59`).toISOString() : null;
    const res = await listChronicleSessions({
      teamSeasonId: seasonId,
      clubId: clubRes.clubId,
      status,
      focus,
      fromIso,
      toIso,
      repeatOnly,
    });
    if (res.error) {
      setError(res.error);
      setRows([]);
      setLoading(false);
      return;
    }

    const cards: ChronicleCard[] = [];
    for (const s of res.data) {
      const items = await listSessionExercises(s.id);
      let pitchLabel: string | null = null;
      if (s.event_id && clubRes.clubId) {
        const a = await getAssignmentForEvent(s.event_id);
        if (a.data) {
          const venues = await listVenuesForClub(clubRes.clubId);
          const venue = venues.data.find((v) => v.id === a.data!.venue_id);
          const fields = await listVenueFields(a.data.venue_id);
          const field = fields.data.find((f) => f.id === a.data!.field_id);
          let zoneName = 'Gesamter Platz';
          if (a.data.zone_id) {
            const zones = await listFieldZones(a.data.field_id);
            zoneName = zones.data.find((z) => z.id === a.data!.zone_id)?.name ?? 'Teilfläche';
          }
          pitchLabel = [venue?.name, field?.name, zoneName].filter(Boolean).join(' · ');
        } else {
          pitchLabel = 'Platz nicht zugeordnet';
        }
      }
      cards.push({
        ...s,
        plannedExercises: items.data.length,
        doneExercises: items.data.filter(
          (i) => i.was_completed === true || i.review_status === 'worked_well' || i.review_status === 'adapted',
        ).length,
        pitchLabel,
        eventStartsAt: s.event_id ? eventStarts[s.event_id] ?? s.completed_at : s.completed_at,
      });
    }
    setRows(cards);
    setLoading(false);
  }, [
    filterSeasonId,
    teamSeasonId,
    status,
    focus,
    fromDate,
    toDate,
    repeatOnly,
    eventStarts,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Sport</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Trainingschronik</h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Durchgeführte Einheiten inklusive Bewertung und Beteiligung.
          </p>
        </div>
        <Link
          to="/manager/training/einheiten"
          className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800"
        >
          Planung
        </Link>
      </header>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <label className="text-[12px] font-medium text-slate-600">
          Saison
          <select
            value={filterSeasonId}
            onChange={(e) => setFilterSeasonId(e.target.value)}
            className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
          >
            {teamSeasons.map((ts) => (
              <option key={ts.id} value={ts.id}>
                {ts.display_name || ts.age_group || ts.id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-medium text-slate-600">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TrainingSessionStatus | 'all')}
            className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
          >
            <option value="completed">Durchgeführt</option>
            <option value="all">Alle mit Abschluss</option>
          </select>
        </label>
        <label className="text-[12px] font-medium text-slate-600">
          Schwerpunkt
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value as ExerciseFocus | 'all')}
            className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
          >
            <option value="all">Alle</option>
            {Object.entries(EXERCISE_FOCUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-medium text-slate-600">
          Von
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
          />
        </label>
        <label className="text-[12px] font-medium text-slate-600">
          Bis
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-[13px] text-slate-700">
          <input
            type="checkbox"
            checked={repeatOnly}
            onChange={(e) => setRepeatOnly(e.target.checked)}
            className="accent-red-600"
          />
          Nur mit „Wiederholen“
        </label>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? <p className="text-[13px] text-slate-400">Chronik wird geladen…</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-[13px] text-slate-500">
          {fromDate || toDate || focus !== 'all' || repeatOnly
            ? 'Für diese Filter wurden keine Trainingseinheiten gefunden.'
            : 'Noch keine durchgeführten Trainings dokumentiert.'}
        </p>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3 2xl:items-stretch">
          {rows.map((r) => {
            const att = r.event_id ? attendance[r.event_id] : null;
            const attLine = att
              ? `${att.yes} zugesagt · ${att.no} abgesagt`
              : r.event_id
                ? 'Beteiligung laden…'
                : 'Ohne Termin';
            return (
              <li
                key={r.id}
                className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-1 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                      {formatDay(r.eventStartsAt ?? r.completed_at)}
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-900">{r.title}</p>
                    <p className="mt-1 text-[13px] text-slate-600">
                      {TRAINING_SESSION_STATUS_LABELS[r.status]}
                      {r.focus
                        ? ` · ${EXERCISE_FOCUS_LABELS[r.focus as ExerciseFocus] ?? r.focus}`
                        : ''}
                      {r.planned_duration_minutes != null
                        ? ` · geplant ${r.planned_duration_minutes}′`
                        : ''}
                      {r.actual_duration_minutes != null
                        ? ` · tatsächlich ${r.actual_duration_minutes}′`
                        : ''}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {r.plannedExercises} Übungen · {r.doneExercises} durchgeführt
                      {r.pitchLabel ? ` · ${r.pitchLabel}` : ''}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">{attLine}</p>
                    {r.review_rating ? (
                      <p className="mt-1 text-[13px] text-slate-700">
                        Bewertung: {TRAINING_REVIEW_RATING_LABELS[r.review_rating]}
                        {r.repeat_next_time ? ' · Wiederholen' : ''}
                      </p>
                    ) : r.repeat_next_time ? (
                      <p className="mt-1 text-[13px] text-amber-800">Wiederholung empfohlen</p>
                    ) : null}
                    {r.objective ? (
                      <p className="mt-2 line-clamp-2 text-[13px] text-slate-500">{r.objective}</p>
                    ) : null}
                  </div>
                  <div className="ml-auto flex flex-wrap justify-end gap-2">
                    <Link
                      to={`/manager/training/einheiten/${encodeURIComponent(r.id)}`}
                      className="inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-3 text-[12px] font-semibold text-white"
                    >
                      Dokumentation
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCopySession(r)}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-3 text-[12px] font-semibold text-slate-800"
                    >
                      Kopieren
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {copySession ? (
        <ManagerTrainingCopyDialog
          open
          session={copySession}
          trainingEvents={trainings}
          onClose={() => setCopySession(null)}
        />
      ) : null}
    </div>
  );
}
