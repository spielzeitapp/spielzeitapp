/**
 * STEP 3A: Trainingsplanung – Termine + Einheiten-Übersicht.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { useEvents, type EventRow } from '../hooks/useEvents';
import { resolveClubIdForTeamSeason } from '../lib/venues';
import {
  getAssignmentForEvent,
} from '../lib/eventFieldAssignments';
import { listVenueFields, listFieldZones } from '../lib/venueFields';
import { listVenuesForClub } from '../lib/venues';
import {
  listTrainingSessionsForSeason,
  type TrainingSessionRow,
} from '../lib/trainingSessions';
import { TRAINING_SESSION_STATUS_LABELS } from '../lib/trainingPhases';
import { isSeasonArchived } from '../lib/seasonLifecycle';
import { VIENNA_TZ } from '../lib/viennaTime';

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: VIENNA_TZ,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

type FieldLabelMap = Record<string, string>;

export function ManagerTrainingSessionsPage(): React.ReactElement {
  const { selectedTeamSeasonId, selectedTeamSeason, viewTeamSeason } = useSession();
  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;
  const seasonArchived = contextSeason ? isSeasonArchived(contextSeason.status) : false;

  const { events, loading: eventsLoading, error: eventsError } = useEvents(teamSeasonId);
  const [sessions, setSessions] = useState<TrainingSessionRow[]>([]);
  const [sessionByEvent, setSessionByEvent] = useState<Record<string, TrainingSessionRow>>({});
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldLabels, setFieldLabels] = useState<FieldLabelMap>({});

  const trainings = useMemo(
    () =>
      events
        .filter((e) => e.kind === 'training' || e.type === 'training')
        .filter((e) => String(e.status ?? '').toLowerCase() !== 'canceled')
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [events],
  );

  const upcomingTrainings = useMemo(() => {
    const now = Date.now();
    return trainings.filter((e) => new Date(e.starts_at).getTime() >= now - 2 * 60 * 60 * 1000);
  }, [trainings]);

  const drafts = useMemo(
    () => sessions.filter((s) => !s.event_id && s.status === 'draft'),
    [sessions],
  );
  const readyPlans = useMemo(
    () => sessions.filter((s) => s.status === 'ready' && s.record_type !== 'template'),
    [sessions],
  );
  const recentCompleted = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'completed')
        .sort((a, b) => String(b.completed_at ?? '').localeCompare(String(a.completed_at ?? '')))
        .slice(0, 5),
    [sessions],
  );

  const reloadSessions = useCallback(async () => {
    if (!teamSeasonId) {
      setSessions([]);
      setSessionByEvent({});
      setLoadingSessions(false);
      return;
    }
    setLoadingSessions(true);
    setError(null);
    const res = await listTrainingSessionsForSeason(teamSeasonId);
    if (res.error) setError(res.error);
    setSessions(res.data);
    const map: Record<string, TrainingSessionRow> = {};
    for (const s of res.data) {
      if (s.event_id) map[s.event_id] = s;
    }
    setSessionByEvent(map);
    setLoadingSessions(false);
  }, [teamSeasonId]);

  useEffect(() => {
    void reloadSessions();
  }, [reloadSessions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!teamSeasonId || upcomingTrainings.length === 0) {
        setFieldLabels({});
        return;
      }
      const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
      if (!clubRes.clubId || cancelled) return;
      const venues = await listVenuesForClub(clubRes.clubId);
      const labels: FieldLabelMap = {};
      for (const e of upcomingTrainings.slice(0, 12)) {
        const a = await getAssignmentForEvent(e.id);
        if (!a.data) {
          labels[e.id] = 'Platz noch nicht zugeordnet';
          continue;
        }
        const venue = venues.data.find((v) => v.id === a.data!.venue_id);
        const fields = await listVenueFields(a.data.venue_id);
        const field = fields.data.find((f) => f.id === a.data!.field_id);
        let zoneName = 'Gesamter Platz';
        if (a.data.zone_id) {
          const zones = await listFieldZones(a.data.field_id);
          zoneName = zones.data.find((z) => z.id === a.data!.zone_id)?.name ?? 'Teilfläche';
        }
        labels[e.id] = [venue?.name, field?.name, zoneName].filter(Boolean).join(' · ');
      }
      if (!cancelled) setFieldLabels(labels);
    })();
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId, upcomingTrainings]);

  const loading = eventsLoading || loadingSessions;
  const pageError = eventsError || error;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Sport</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Trainingsplanung</h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Einheiten aus AW · HT1 · HT2 · AK – verknüpft mit bestehenden Terminen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/manager/training/vorlagen"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Vorlagen
          </Link>
          <Link
            to="/manager/training/chronik"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Chronik
          </Link>
          <Link
            to="/manager/training/bibliothek"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Übungsbibliothek
          </Link>
          <Link
            to="/manager/training/einheiten/neu"
            className="inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800"
          >
            Neue Einheit
          </Link>
        </div>
      </header>

      {seasonArchived ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700">
          Archivierte Saison – Anzeige möglich, Planung bevorzugt in einer aktiven Saison.
        </div>
      ) : null}

      {pageError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {pageError}
        </div>
      ) : null}
      {loading ? <p className="text-[13px] text-slate-400">Trainingsplanung wird geladen…</p> : null}

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold text-slate-800">Kommende Trainingstermine</h2>
        {!loading && upcomingTrainings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-[13px] text-slate-500">
            Keine kommenden Trainingstermine in dieser Saison.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcomingTrainings.map((e) => (
              <TrainingRow
                key={e.id}
                event={e}
                session={sessionByEvent[e.id] ?? null}
                fieldLabel={fieldLabels[e.id]}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold text-slate-800">Entwürfe ohne Termin</h2>
        {drafts.length === 0 ? (
          <p className="text-[13px] text-slate-400">Keine Entwürfe ohne Termin.</p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div>
                  <p className="font-semibold text-slate-900">{s.title}</p>
                  <p className="text-[12px] text-slate-500">
                    {TRAINING_SESSION_STATUS_LABELS[s.status]}
                    {s.planned_duration_minutes != null
                      ? ` · ${s.planned_duration_minutes} Min.`
                      : ''}
                  </p>
                </div>
                <Link
                  to={`/manager/training/einheiten/${encodeURIComponent(s.id)}`}
                  className="rounded-full bg-red-700 px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  Öffnen
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold text-slate-800">Fertige Pläne</h2>
        {readyPlans.length === 0 ? (
          <p className="text-[13px] text-slate-400">Keine Pläne mit Status „Bereit“.</p>
        ) : (
          <ul className="space-y-2">
            {readyPlans.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">{s.title}</p>
                  <p className="text-[12px] text-slate-500">
                    Bereit
                    {s.planned_duration_minutes != null ? ` · ${s.planned_duration_minutes} Min.` : ''}
                  </p>
                </div>
                <Link
                  to={`/manager/training/einheiten/${encodeURIComponent(s.id)}`}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-800"
                >
                  Öffnen
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-slate-800">Zuletzt durchgeführt</h2>
          <Link to="/manager/training/chronik" className="text-[12px] font-semibold text-red-700">
            Chronik
          </Link>
        </div>
        {recentCompleted.length === 0 ? (
          <p className="text-[13px] text-slate-400">Noch keine durchgeführten Trainings.</p>
        ) : (
          <ul className="space-y-2">
            {recentCompleted.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">{s.title}</p>
                  <p className="text-[12px] text-slate-500">Durchgeführt</p>
                </div>
                <Link
                  to={`/manager/training/einheiten/${encodeURIComponent(s.id)}`}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-800"
                >
                  Dokumentation
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TrainingRow({
  event,
  session,
  fieldLabel,
}: {
  event: EventRow;
  session: TrainingSessionRow | null;
  fieldLabel?: string;
}): React.ReactElement {
  const planLabel = !session
    ? 'Noch nicht geplant'
    : session.status === 'completed'
      ? 'Durchgeführt'
      : session.status === 'ready'
        ? `Bereit${session.planned_duration_minutes != null ? ` · ${session.planned_duration_minutes} Min.` : ''}`
        : session.status === 'archived'
          ? 'Archiviert'
          : `Entwurf${session.planned_duration_minutes != null ? ` · ${session.planned_duration_minutes} Min.` : ''}`;

  return (
    <li className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{formatWhen(event.starts_at)}</p>
          <p className="text-[13px] text-slate-600">{planLabel}</p>
          <p className="mt-1 text-[12px] text-slate-500">
            {fieldLabel ?? 'Platzinfo wird geladen…'}
            {!fieldLabel || fieldLabel === 'Platz noch nicht zugeordnet' ? (
              <>
                {' · '}
                <Link to="/manager/platzbelegung" className="font-semibold text-red-700 hover:text-red-800">
                  Platzbelegung
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {session ? (
            <Link
              to={`/manager/training/einheiten/${encodeURIComponent(session.id)}`}
              className="rounded-full bg-red-700 px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              Plan öffnen
            </Link>
          ) : (
            <Link
                  to={`/manager/training/einheiten/neu?event=${encodeURIComponent(event.id)}&starts=${encodeURIComponent(event.starts_at)}`}
                  className="rounded-full bg-red-700 px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  Training planen
                </Link>
          )}
        </div>
      </div>
    </li>
  );
}
