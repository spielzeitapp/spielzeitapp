/**
 * Trainingsplanung: Kalender-/Listenübersicht, gespeicherte Pläne und schneller Termin-Flow.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, List, Plus } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { useEvents, type EventRow } from '../hooks/useEvents';
import { getAssignmentForEvent } from '../lib/eventFieldAssignments';
import { listTrainingTemplates } from '../lib/trainingSessionOps';
import { listTrainingSessionsForSeason, type TrainingSessionRow } from '../lib/trainingSessions';
import { TRAINING_SESSION_STATUS_LABELS } from '../lib/trainingPhases';
import { isSeasonArchived } from '../lib/seasonLifecycle';
import { listFieldZones, listVenueFields } from '../lib/venueFields';
import { listVenuesForClub, resolveClubIdForTeamSeason } from '../lib/venues';
import { VIENNA_TZ } from '../lib/viennaTime';
import { ManagerTrainingPlanPickerDialog } from './ManagerTrainingPlanPickerDialog';
import { ManagerTrainingExamPanel } from './ManagerTrainingExamPanel';

type FieldLabelMap = Record<string, string>;
type MainTab = 'dates' | 'plans' | 'exam';
type CalendarView = 'week' | 'month' | 'list';
type PlanFilter = 'all' | 'open' | 'ready';

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

function dateKeyFromIso(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIENNA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const weekday = next.getDay() === 0 ? 7 : next.getDay();
  next.setDate(next.getDate() - (weekday - 1));
  return next;
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
}

function isPlanningReady(session: TrainingSessionRow | null): boolean {
  return session?.status === 'ready' || session?.status === 'completed';
}

function eventMatchesFilter(session: TrainingSessionRow | null, filter: PlanFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'ready') return isPlanningReady(session);
  return !isPlanningReady(session);
}

export function ManagerTrainingSessionsPage(): React.ReactElement {
  const { selectedTeamSeasonId, selectedTeamSeason, viewTeamSeason } = useSession();
  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;
  const seasonArchived = contextSeason ? isSeasonArchived(contextSeason.status) : false;

  const { events, loading: eventsLoading, error: eventsError } = useEvents(teamSeasonId);
  const [sessions, setSessions] = useState<TrainingSessionRow[]>([]);
  const [templates, setTemplates] = useState<TrainingSessionRow[]>([]);
  const [sessionByEvent, setSessionByEvent] = useState<Record<string, TrainingSessionRow>>({});
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldLabels, setFieldLabels] = useState<FieldLabelMap>({});
  const [mainTab, setMainTab] = useState<MainTab>('dates');
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [filter, setFilter] = useState<PlanFilter>('all');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [planningEvent, setPlanningEvent] = useState<EventRow | null>(null);

  const trainings = useMemo(
    () =>
      events
        .filter((event) => event.kind === 'training' || event.type === 'training')
        .filter((event) => String(event.status ?? '').toLowerCase() !== 'canceled')
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [events],
  );

  const upcomingTrainings = useMemo(() => {
    const now = Date.now();
    return trainings.filter((event) => new Date(event.starts_at).getTime() >= now - 2 * 60 * 60 * 1000);
  }, [trainings]);

  const drafts = useMemo(() => sessions.filter((session) => !session.event_id && session.status === 'draft'), [sessions]);
  const readyPlans = useMemo(
    () => sessions.filter((session) => session.status === 'ready' && session.record_type !== 'template'),
    [sessions],
  );
  const archivedPlans = useMemo(
    () => sessions.filter((session) => session.status === 'archived' && session.record_type !== 'template'),
    [sessions],
  );
  const lastSession = useMemo(
    () =>
      [...sessions]
        .filter((session) => session.record_type !== 'template' && (session.status === 'ready' || session.status === 'completed'))
        .sort((a, b) =>
          String(b.completed_at ?? b.updated_at ?? b.created_at ?? '').localeCompare(
            String(a.completed_at ?? a.updated_at ?? a.created_at ?? ''),
          ),
        )[0] ?? null,
    [sessions],
  );

  const reloadSessions = useCallback(async () => {
    if (!teamSeasonId) {
      setSessions([]);
      setTemplates([]);
      setSessionByEvent({});
      setLoadingSessions(false);
      return;
    }
    setLoadingSessions(true);
    setError(null);
    const [sessionResult, clubResult] = await Promise.all([
      listTrainingSessionsForSeason(teamSeasonId, { includeArchived: true }),
      resolveClubIdForTeamSeason(teamSeasonId),
    ]);
    if (sessionResult.error) setError(sessionResult.error);
    setSessions(sessionResult.data);
    const map: Record<string, TrainingSessionRow> = {};
    for (const session of sessionResult.data) {
      if (session.event_id) map[session.event_id] = session;
    }
    setSessionByEvent(map);
    if (clubResult.clubId) {
      const templateResult = await listTrainingTemplates({ clubId: clubResult.clubId });
      if (templateResult.error && !sessionResult.error) setError(templateResult.error);
      setTemplates(templateResult.data);
    } else {
      setTemplates([]);
    }
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
      const clubResult = await resolveClubIdForTeamSeason(teamSeasonId);
      if (!clubResult.clubId || cancelled) return;
      const venues = await listVenuesForClub(clubResult.clubId);
      const labels: FieldLabelMap = {};
      for (const event of upcomingTrainings.slice(0, 24)) {
        const assignment = await getAssignmentForEvent(event.id);
        if (!assignment.data) {
          labels[event.id] = 'Platz noch nicht zugeordnet';
          continue;
        }
        const venue = venues.data.find((item) => item.id === assignment.data!.venue_id);
        const fields = await listVenueFields(assignment.data.venue_id);
        const field = fields.data.find((item) => item.id === assignment.data!.field_id);
        let zoneName = 'Gesamter Platz';
        if (assignment.data.zone_id) {
          const zones = await listFieldZones(assignment.data.field_id);
          zoneName = zones.data.find((item) => item.id === assignment.data!.zone_id)?.name ?? 'Teilfläche';
        }
        labels[event.id] = [venue?.name, field?.name, zoneName].filter(Boolean).join(' · ');
      }
      if (!cancelled) setFieldLabels(labels);
    })();
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId, upcomingTrainings]);

  const counts = useMemo(() => {
    let ready = 0;
    for (const event of upcomingTrainings) {
      if (isPlanningReady(sessionByEvent[event.id] ?? null)) ready += 1;
    }
    return { all: upcomingTrainings.length, ready, open: upcomingTrainings.length - ready };
  }, [sessionByEvent, upcomingTrainings]);

  const filteredTrainings = useMemo(
    () => upcomingTrainings.filter((event) => eventMatchesFilter(sessionByEvent[event.id] ?? null, filter)),
    [filter, sessionByEvent, upcomingTrainings],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const event of filteredTrainings) {
      const key = dateKeyFromIso(event.starts_at);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [filteredTrainings]);

  const visibleDays = useMemo(() => {
    if (calendarView === 'week') {
      const start = startOfWeek(anchorDate);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 12);
    const gridStart = startOfWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [anchorDate, calendarView]);

  const calendarTitle = useMemo(() => {
    if (calendarView === 'week') {
      const start = visibleDays[0];
      const end = visibleDays[visibleDays.length - 1];
      return `${new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit' }).format(start)} – ${new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(end)}`;
    }
    return new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric' }).format(anchorDate);
  }, [anchorDate, calendarView, visibleDays]);

  const shiftCalendar = (direction: -1 | 1) => {
    if (calendarView === 'week') setAnchorDate((date) => addDays(date, direction * 7));
    else setAnchorDate((date) => new Date(date.getFullYear(), date.getMonth() + direction, 1, 12));
  };

  const loading = eventsLoading || loadingSessions;
  const pageError = eventsError || error;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-bold tracking-tight text-slate-950 sm:text-[32px]">Trainingsplanung</h1>
          <p className="mt-1 text-[14px] text-slate-500">Trainingstermine planen, gespeicherte Pläne verwenden und Einheiten anpassen.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link to="/manager/training/bibliothek" className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50">Übungsbibliothek</Link>
          <Link to="/manager/training/einheiten/neu" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-red-700"><Plus className="h-4 w-4" aria-hidden /> Neue Einheit</Link>
        </div>
      </header>

      <nav className="flex gap-6 overflow-x-auto border-b border-slate-200" aria-label="Trainingsplanung Bereiche">
        <button type="button" onClick={() => setMainTab('dates')} className={`min-h-[44px] whitespace-nowrap border-b-2 px-1 text-[13px] font-semibold ${mainTab === 'dates' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>Trainingstermine</button>
        <button type="button" onClick={() => setMainTab('plans')} className={`min-h-[44px] whitespace-nowrap border-b-2 px-1 text-[13px] font-semibold ${mainTab === 'plans' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>Meine Pläne</button>
        <button type="button" onClick={() => setMainTab('exam')} className={`min-h-[44px] whitespace-nowrap border-b-2 px-1 text-[13px] font-semibold ${mainTab === 'exam' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>Trainerprüfung</button>
        <Link to="/manager/training/vorlagen" className="inline-flex min-h-[44px] items-center whitespace-nowrap border-b-2 border-transparent px-1 text-[13px] font-semibold text-slate-500 hover:text-slate-900">Vorlagen</Link>
        <Link to="/manager/training/chronik" className="inline-flex min-h-[44px] items-center whitespace-nowrap border-b-2 border-transparent px-1 text-[13px] font-semibold text-slate-500 hover:text-slate-900">Chronik</Link>
      </nav>

      {seasonArchived ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">Archivierte Saison – Anzeige möglich, neue Planungen gehören in eine aktive Saison.</div> : null}
      {pageError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{pageError}</div> : null}
      {loading ? <p className="text-[13px] text-slate-500">Trainingsplanung wird geladen…</p> : null}

      {!loading && mainTab === 'dates' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="Alle" count={counts.all} />
              <FilterButton active={filter === 'open'} onClick={() => setFilter('open')} label="Noch zu planen" count={counts.open} />
              <FilterButton active={filter === 'ready'} onClick={() => setFilter('ready')} label="Planung fertig" count={counts.ready} />
            </div>
            {calendarView !== 'list' ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => shiftCalendar(-1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" aria-label="Zurück"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
                <div className="flex min-w-[170px] items-center justify-center gap-2 text-[14px] font-semibold text-slate-900"><CalendarDays className="h-4 w-4" aria-hidden /> {calendarTitle}</div>
                <button type="button" onClick={() => shiftCalendar(1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" aria-label="Weiter"><ChevronRight className="h-4 w-4" aria-hidden /></button>
              </div>
            ) : <div />}
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(['week', 'month', 'list'] as const).map((view) => <button key={view} type="button" onClick={() => setCalendarView(view)} className={`min-h-[36px] rounded-lg px-3 text-[12px] font-semibold ${calendarView === view ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>{view === 'week' ? 'Woche' : view === 'month' ? 'Monat' : 'Liste'}</button>)}
            </div>
          </div>
          {calendarView === 'list' ? (
            <div className="divide-y divide-slate-100">
              {filteredTrainings.length === 0 ? <EmptyState /> : filteredTrainings.map((event) => <TrainingListRow key={event.id} event={event} session={sessionByEvent[event.id] ?? null} fieldLabel={fieldLabels[event.id]} onPlan={() => setPlanningEvent(event)} />)}
            </div>
          ) : <CalendarGrid days={visibleDays} month={anchorDate.getMonth()} eventsByDay={eventsByDay} sessions={sessionByEvent} view={calendarView} onPlan={setPlanningEvent} />}
        </section>
      ) : null}

      {!loading && mainTab === 'plans' ? (
        <MyPlans drafts={drafts} readyPlans={readyPlans} archivedPlans={archivedPlans} />
      ) : null}

      {!loading && mainTab === 'exam' ? (
        <ManagerTrainingExamPanel sessions={sessions} teamSeasonId={teamSeasonId} seasonArchived={seasonArchived} />
      ) : null}

      <ManagerTrainingPlanPickerDialog event={planningEvent} savedPlans={readyPlans} templates={templates} lastSession={lastSession} onClose={() => setPlanningEvent(null)} />
    </div>
  );
}

function FilterButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }): React.ReactElement {
  return <button type="button" onClick={onClick} className={`inline-flex min-h-[38px] items-center gap-2 rounded-xl border px-3 text-[12px] font-semibold ${active ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{count}</span></button>;
}

function CalendarGrid({ days, month, eventsByDay, sessions, view, onPlan }: { days: Date[]; month: number; eventsByDay: Map<string, EventRow[]>; sessions: Record<string, TrainingSessionRow>; view: 'week' | 'month'; onPlan: (event: EventRow) => void }): React.ReactElement {
  const weekdays = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
  return <div className="overflow-x-auto"><div className="min-w-[880px]">
    <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">{weekdays.map((day) => <div key={day} className="px-2 py-2 text-center text-[10px] font-bold tracking-[0.12em] text-slate-500">{day}</div>)}</div>
    <div className="grid grid-cols-7">{days.map((day) => {
      const key = dateKey(day);
      const dayEvents = eventsByDay.get(key) ?? [];
      const outside = view === 'month' && day.getMonth() !== month;
      return <div key={key} className={`min-h-[128px] border-b border-r border-slate-100 p-2 ${outside ? 'bg-slate-50/70 text-slate-400' : 'bg-white'}`}><p className="mb-2 text-[12px] font-semibold">{day.getDate()}.</p><div className="space-y-2">{dayEvents.map((event) => <CalendarEventCard key={event.id} event={event} session={sessions[event.id] ?? null} onPlan={() => onPlan(event)} />)}</div></div>;
    })}</div>
  </div></div>;
}

function CalendarEventCard({ event, session, onPlan }: { event: EventRow; session: TrainingSessionRow | null; onPlan: () => void }): React.ReactElement {
  const ready = isPlanningReady(session);
  const draft = Boolean(session) && !ready;
  const time = new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(event.starts_at));
  return <div className={`rounded-xl border p-2.5 ${ready ? 'border-green-200 border-l-[3px] border-l-green-600 bg-green-50/70' : draft ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'}`}>
    <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${ready ? 'text-green-700' : draft ? 'text-amber-800' : 'text-slate-500'}`}>{ready ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Clock3 className="h-3.5 w-3.5" aria-hidden />}{ready ? 'Planung fertig' : draft ? 'In Bearbeitung' : 'Noch nicht geplant'} · {time}</div>
    {session ? <p className="mt-1 truncate text-[11px] font-semibold text-slate-900">{session.title}{session.planned_duration_minutes != null ? ` · ${session.planned_duration_minutes} Min.` : ''}</p> : null}
    {session ? <Link to={`/manager/training/einheiten/${encodeURIComponent(session.id)}`} className={`mt-2 inline-flex min-h-[32px] w-full items-center justify-center rounded-lg border px-2 text-[10px] font-semibold ${ready ? 'border-green-300 text-green-800 hover:bg-green-100' : 'border-amber-300 text-amber-900 hover:bg-amber-100'}`}>Trainingsplan öffnen</Link> : <button type="button" onClick={onPlan} className="mt-2 min-h-[32px] w-full rounded-lg border border-red-300 px-2 text-[10px] font-semibold text-red-700 hover:bg-red-50">Training planen</button>}
  </div>;
}

function TrainingListRow({ event, session, fieldLabel, onPlan }: { event: EventRow; session: TrainingSessionRow | null; fieldLabel?: string; onPlan: () => void }): React.ReactElement {
  const ready = isPlanningReady(session);
  return <div className={`flex flex-wrap items-center gap-4 px-4 py-4 ${ready ? 'border-l-4 border-l-green-600 bg-green-50/40' : ''}`}>
    <div className="min-w-[150px]"><p className="text-[14px] font-semibold text-slate-950">{formatWhen(event.starts_at)}</p><p className={`mt-0.5 text-[12px] font-medium ${ready ? 'text-green-700' : session ? 'text-amber-700' : 'text-slate-500'}`}>{ready ? 'Planung fertig' : session ? 'In Bearbeitung' : 'Noch nicht geplant'}</p></div>
    <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-slate-900">{session?.title ?? 'Noch kein Trainingsplan ausgewählt'}</p><p className="truncate text-[12px] text-slate-500">{fieldLabel ?? 'Platzinfo wird geladen…'}</p></div>
    {session ? <Link to={`/manager/training/einheiten/${encodeURIComponent(session.id)}`} className={`inline-flex min-h-[38px] items-center rounded-lg border px-3 text-[12px] font-semibold ${ready ? 'border-green-300 text-green-800 hover:bg-green-50' : 'border-amber-300 text-amber-800 hover:bg-amber-50'}`}>Trainingsplan öffnen</Link> : <button type="button" onClick={onPlan} className="min-h-[38px] rounded-lg bg-red-600 px-3 text-[12px] font-semibold text-white hover:bg-red-700">Training planen</button>}
  </div>;
}

function MyPlans({ drafts, readyPlans, archivedPlans }: { drafts: TrainingSessionRow[]; readyPlans: TrainingSessionRow[]; archivedPlans: TrainingSessionRow[] }): React.ReactElement {
  return <div className="space-y-5"><div className="grid gap-5 xl:grid-cols-2"><PlanSection title="Fertige Pläne" description="Sofort für einen Trainingstermin verwendbar" rows={readyPlans} empty="Noch keine fertigen Pläne vorhanden." /><PlanSection title="Entwürfe ohne Termin" description="Noch nicht fertiggestellte Trainingseinheiten" rows={drafts} empty="Keine offenen Entwürfe vorhanden." /></div><details className="rounded-2xl border border-slate-200 bg-white shadow-sm"><summary className="cursor-pointer list-none px-4 py-4 text-[14px] font-semibold text-slate-800">Archiv ({archivedPlans.length}) <span className="ml-1 text-[12px] font-normal text-slate-500">– alte oder ersetzte Pläne</span></summary><div className="border-t border-slate-100 p-4"><PlanSection title="Archivierte Pläne" description="Ausgeblendete Pläne können geöffnet und wiederhergestellt werden" rows={archivedPlans} empty="Das Archiv ist leer." /></div></details></div>;
}

function PlanSection({ title, description, rows, empty }: { title: string; description: string; rows: TrainingSessionRow[]; empty: string }): React.ReactElement {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-[17px] font-bold text-slate-950">{title}</h2><p className="mt-0.5 text-[12px] text-slate-500">{description}</p>{rows.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-[13px] text-slate-500">{empty}</p> : <ul className="mt-4 space-y-2">{rows.map((session) => <li key={session.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3"><div className="min-w-0"><p className="truncate text-[14px] font-semibold text-slate-950">{session.title}</p><p className="text-[12px] text-slate-500">{TRAINING_SESSION_STATUS_LABELS[session.status]}{session.planned_duration_minutes != null ? ` · ${session.planned_duration_minutes} Min.` : ''}</p></div><Link to={`/manager/training/einheiten/${encodeURIComponent(session.id)}`} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-800 hover:bg-slate-50">Öffnen</Link></li>)}</ul>}</section>;
}

function EmptyState(): React.ReactElement {
  return <div className="px-4 py-10 text-center"><List className="mx-auto h-6 w-6 text-slate-300" aria-hidden /><p className="mt-2 text-[13px] text-slate-500">Keine Trainingstermine für diesen Filter.</p></div>;
}
