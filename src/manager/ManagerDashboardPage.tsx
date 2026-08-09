import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  MapPin,
  Shield,
  Users,
  Trophy,
  Video,
  ShoppingBag,
  Dumbbell,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useProfile, getDisplayFirstName } from '../auth/useProfile';
import { useSession } from '../auth/useSession';
import { useEvents, type EventRow } from '../hooks/useEvents';
import { usePlayers } from '../hooks/usePlayers';
import { useEventsAttendance } from '../hooks/useEventsAttendance';
import { isUpcomingRelevant, nextUpcoming } from '../features/home/homeFeedBuilder';
import {
  getSeasonStatusLabel,
  isSeasonActive,
  isSeasonArchived,
} from '../lib/seasonLifecycle';
import { resolveClubIdForTeamSeason, listVenuesForClub } from '../lib/venues';
import { listAssignmentsForToday, listClubEventsInRange, getAssignmentForEvent } from '../lib/eventFieldAssignments';
import { getDateTimePartsInTimeZone, VIENNA_TZ, zonedWallTimeToUtcMillis } from '../lib/viennaTime';
import { addDays, toViennaDayKey } from '../pages/calendar/calendarUtils';
import {
  getTrainingSessionByEvent,
  listSessionExercises,
} from '../lib/trainingSessions';
import { listVenueFields, listFieldZones } from '../lib/venueFields';
import { fetchSeasonManagementSnapshot } from '../lib/seasonManagementData';

function greetingPrefix(now = new Date()): string {
  const h = now.getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function formatEventWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: 'Europe/Vienna',
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

function eventTitle(e: EventRow): string {
  if (e.kind === 'match' || e.type === 'game') {
    const opp = (e.opponent ?? '').trim() || 'Gegner';
    return e.is_home === false ? `Auswärts vs. ${opp}` : `Heim vs. ${opp}`;
  }
  if (e.kind === 'training' || e.type === 'training') return 'Training';
  if (e.kind === 'tournament') return (e.opponent ?? e.notes ?? 'Turnier').toString().slice(0, 48) || 'Turnier';
  return (e.notes ?? 'Termin').toString().slice(0, 48) || 'Termin';
}

function Card({
  title,
  children,
  icon,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon ? <span className="text-red-700/80">{icon}</span> : null}
        <h2 className="text-[13px] font-semibold tracking-tight text-slate-800">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 text-[14px] text-slate-700">{children}</div>
      {footer ? <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div> : null}
    </section>
  );
}

function EmptyLine({ text }: { text: string }): React.ReactElement {
  return <p className="text-[13px] leading-snug text-slate-400">{text}</p>;
}

function viennaDayBoundsIso(day: Date): { startIso: string; endIso: string } {
  const p = getDateTimePartsInTimeZone(day, VIENNA_TZ);
  if (!p) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = addDays(start, 1);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }
  const startMs = zonedWallTimeToUtcMillis(
    { year: p.year, month: p.month, day: p.day, hour: 0, minute: 0 },
    VIENNA_TZ,
  );
  const next = addDays(new Date(startMs), 1);
  const np = getDateTimePartsInTimeZone(next, VIENNA_TZ) ?? p;
  const endMs = zonedWallTimeToUtcMillis(
    { year: np.year, month: np.month, day: np.day, hour: 0, minute: 0 },
    VIENNA_TZ,
  );
  return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

function formatHm(iso: string): string {
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: VIENNA_TZ,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

type TodayFieldSummary = {
  loading: boolean;
  error: string | null;
  assignedCount: number;
  unassignedCount: number;
  fieldCount: number;
  rangeLabel: string | null;
  nextLabel: string | null;
  migrationPending: boolean;
};

type NextTrainingPlan = {
  loading: boolean;
  sessionId: string | null;
  status: 'none' | 'draft' | 'ready' | 'completed' | 'needs_doc' | 'error';
  exerciseCount: number;
  durationMinutes: number | null;
  actualDurationMinutes: number | null;
  reviewRating: string | null;
  pitchLabel: string | null;
  error: string | null;
};

/**
 * STEP-1-Dashboard + STEP-2 Platzbelegung + STEP-3A Trainingsplan-Karte.
 */
export function ManagerDashboardPage(): React.ReactElement {
  const { user: authUser } = useAuth();
  const { profile } = useProfile(authUser?.id);
  const { selectedTeamSeason, selectedTeamSeasonId, viewTeamSeason, teamSeasons } = useSession();

  const [seasonDraftHint, setSeasonDraftHint] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;

  const { events, loading: eventsLoading, error: eventsError } = useEvents(teamSeasonId);
  const { players, loading: playersLoading, error: playersError } = usePlayers(teamSeasonId, {
    mode: 'active',
  });

  const [todayField, setTodayField] = useState<TodayFieldSummary>({
    loading: true,
    error: null,
    assignedCount: 0,
    unassignedCount: 0,
    fieldCount: 0,
    rangeLabel: null,
    nextLabel: null,
    migrationPending: false,
  });

  const [nextTrainingPlan, setNextTrainingPlan] = useState<NextTrainingPlan>({
    loading: false,
    sessionId: null,
    status: 'none',
    exerciseCount: 0,
    durationMinutes: null,
    actualDurationMinutes: null,
    reviewRating: null,
    pitchLabel: null,
    error: null,
  });

  const now = useMemo(() => new Date(), []);
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => isUpcomingRelevant(e, now))
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [events, now],
  );

  const nextEvents = upcoming.slice(0, 4);
  const nextTraining = upcoming.find((e) => e.kind === 'training' || e.type === 'training') ?? null;
  const nextMatch =
    upcoming.find((e) => e.kind === 'match' || e.type === 'game') ?? null;
  const featured = nextUpcoming(events, now);

  const attendanceIds = useMemo(() => nextEvents.map((e) => e.id), [nextEvents]);
  const { byEventId: attendanceByEvent, loading: attendanceLoading } =
    useEventsAttendance(attendanceIds);

  const openRsvpCount = useMemo(() => {
    let open = 0;
    const squad = players.length;
    if (squad === 0) return 0;
    for (const e of nextEvents) {
      const data = attendanceByEvent[e.id];
      const answered = data ? Object.keys(data.availabilityByPlayerId).length : 0;
      open += Math.max(0, squad - answered);
    }
    return open;
  }, [attendanceByEvent, nextEvents, players.length]);

  const firstName = getDisplayFirstName(profile);
  const ageLabel =
    (contextSeason?.age_group ?? '').trim() ||
    (contextSeason?.display_name ?? '').trim() ||
    'dein Team';

  const hasActive = teamSeasons.some((ts) => isSeasonActive(ts.status));
  const seasonArchived = contextSeason ? isSeasonArchived(contextSeason.status) : false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!teamSeasonId) {
        if (!cancelled) {
          setTodayField((s) => ({ ...s, loading: false, assignedCount: 0, unassignedCount: 0 }));
        }
        return;
      }
      setTodayField((s) => ({ ...s, loading: true, error: null }));
      const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
      if (cancelled) return;
      if (clubRes.error || !clubRes.clubId) {
        setTodayField({
          loading: false,
          error: clubRes.error ?? 'Verein nicht ermittelbar.',
          assignedCount: 0,
          unassignedCount: 0,
          fieldCount: 0,
          rangeLabel: null,
          nextLabel: null,
          migrationPending: false,
        });
        return;
      }
      const bounds = viennaDayBoundsIso(now);
      const todayKey = toViennaDayKey(now);
      const [assignRes, eventsRes] = await Promise.all([
        listAssignmentsForToday(clubRes.clubId, bounds.startIso, bounds.endIso),
        listClubEventsInRange(clubRes.clubId, bounds.startIso, bounds.endIso),
      ]);
      if (cancelled) return;

      const migrationPending = Boolean(
        assignRes.error && /noch nicht migriert/i.test(assignRes.error),
      );
      const assignments = assignRes.data ?? [];
      const assignedIds = new Set(assignments.map((a) => a.event_id));
      const dayEvents = (eventsRes.data ?? []).filter(
        (e) => toViennaDayKey(new Date(e.starts_at)) === todayKey,
      );
      const unassignedCount = dayEvents.filter((e) => !assignedIds.has(e.id)).length;
      const fieldCount = new Set(assignments.map((a) => a.field_id)).size;

      let rangeLabel: string | null = null;
      if (assignments.length > 0) {
        const starts = assignments.map((a) => new Date(a.starts_at).getTime());
        const ends = assignments.map((a) => new Date(a.ends_at).getTime());
        rangeLabel = `${formatHm(new Date(Math.min(...starts)).toISOString())}–${formatHm(new Date(Math.max(...ends)).toISOString())}`;
      }

      const nowMs = now.getTime();
      const upcomingAssign =
        assignments.find((a) => new Date(a.ends_at).getTime() > nowMs) ?? null;
      let nextLabel: string | null = null;
      if (upcomingAssign) {
        const ev = dayEvents.find((e) => e.id === upcomingAssign.event_id);
        const title = ev
          ? ev.kind === 'match'
            ? ev.opponent?.trim()
              ? `vs. ${ev.opponent.trim()}`
              : 'Spiel'
            : ev.kind === 'training'
              ? 'Training'
              : 'Termin'
          : 'Belegung';
        const team = (ev?.age_group ?? ev?.team_name ?? '').trim();
        nextLabel = `${formatHm(upcomingAssign.starts_at)} ${title}${team ? ` · ${team}` : ''}`;
      }

      setTodayField({
        loading: false,
        error: migrationPending ? null : assignRes.error || eventsRes.error,
        assignedCount: assignments.length,
        unassignedCount,
        fieldCount,
        rangeLabel,
        nextLabel,
        migrationPending,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId, now]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!nextTraining || !teamSeasonId) {
        if (!cancelled) {
          setNextTrainingPlan({
            loading: false,
            sessionId: null,
            status: 'none',
            exerciseCount: 0,
            durationMinutes: null,
            actualDurationMinutes: null,
            reviewRating: null,
            pitchLabel: null,
            error: null,
          });
        }
        return;
      }
      setNextTrainingPlan((s) => ({ ...s, loading: true, error: null }));
      const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
      if (cancelled) return;

      const [sessionRes, assignRes] = await Promise.all([
        getTrainingSessionByEvent(nextTraining.id),
        getAssignmentForEvent(nextTraining.id),
      ]);
      if (cancelled) return;

      let pitchLabel: string | null = null;
      if (assignRes.data && clubRes.clubId) {
        const venues = await listVenuesForClub(clubRes.clubId);
        const venueName = venues.data.find((v) => v.id === assignRes.data!.venue_id)?.name ?? '';
        const fields = await listVenueFields(assignRes.data.venue_id);
        const field = fields.data.find((f) => f.id === assignRes.data!.field_id);
        let zoneName = 'Gesamter Platz';
        if (assignRes.data.zone_id) {
          const zones = await listFieldZones(assignRes.data.field_id);
          zoneName = zones.data.find((z) => z.id === assignRes.data!.zone_id)?.name ?? 'Teilfläche';
        }
        pitchLabel = [venueName, field?.name, zoneName].filter(Boolean).join(' · ');
      } else if (!assignRes.error) {
        pitchLabel = 'Platz noch nicht zugeordnet';
      }

      if (!sessionRes.data) {
        if (cancelled) return;
        setNextTrainingPlan({
          loading: false,
          sessionId: null,
          status: 'none',
          exerciseCount: 0,
          durationMinutes: null,
          actualDurationMinutes: null,
          reviewRating: null,
          pitchLabel,
          error: sessionRes.error && !/noch nicht migriert/i.test(sessionRes.error) ? sessionRes.error : null,
        });
        return;
      }

      const items = await listSessionExercises(sessionRes.data.id);
      if (cancelled) return;
      const st = sessionRes.data.status;
      const eventStarted = new Date(nextTraining.starts_at).getTime() <= Date.now();
      let planStatus: NextTrainingPlan['status'] = 'draft';
      if (st === 'completed') planStatus = 'completed';
      else if (st === 'ready') planStatus = eventStarted ? 'needs_doc' : 'ready';
      else if (st === 'draft' && eventStarted) planStatus = 'needs_doc';
      else planStatus = 'draft';

      setNextTrainingPlan({
        loading: false,
        sessionId: sessionRes.data.id,
        status: planStatus,
        exerciseCount: items.data.length,
        durationMinutes: sessionRes.data.planned_duration_minutes,
        actualDurationMinutes: sessionRes.data.actual_duration_minutes,
        reviewRating: sessionRes.data.review_rating,
        pitchLabel,
        error: null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [nextTraining, teamSeasonId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!teamSeasonId) {
        if (!cancelled) setSeasonDraftHint(null);
        return;
      }
      const snap = await fetchSeasonManagementSnapshot(teamSeasonId);
      if (cancelled) return;
      if (snap.data?.draft) {
        setSeasonDraftHint({
          id: snap.data.draft.id,
          label: snap.data.draft.displayName,
        });
      } else {
        setSeasonDraftHint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId]);

  const loading = eventsLoading || playersLoading;
  const error = eventsError || playersError;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
          {greetingPrefix()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-[14px] text-slate-500">
          Hier ist der aktuelle Überblick für {ageLabel.startsWith('U') ? `deine ${ageLabel}` : ageLabel}.
        </p>
      </header>

      {!hasActive ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          Keine aktive Saison vorhanden. Wähle im Header eine Saison — archivierte Saisons sind
          schreibgeschützt.
        </div>
      ) : null}
      {seasonArchived && contextSeason ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700">
          Anzeige: abgeschlossene Saison ({getSeasonStatusLabel(contextSeason.status)}). Zum Arbeiten
          bitte eine aktive Saison wählen.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          Daten konnten nicht geladen werden: {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-[13px] text-slate-400">Dashboard-Daten werden geladen…</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <Card title="Nächste Termine" icon={<CalendarDays className="h-4 w-4" aria-hidden />}>
          {nextEvents.length === 0 ? (
            <EmptyLine text="Keine kommenden Termine in dieser Saison." />
          ) : (
            <ul className="space-y-2.5">
              {nextEvents.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/app/events/${encodeURIComponent(e.id)}`}
                    className="block rounded-lg border border-slate-100 px-2.5 py-2 hover:border-red-200 hover:bg-red-50/40"
                  >
                    <p className="font-medium text-slate-900">{eventTitle(e)}</p>
                    <p className="text-[12px] text-slate-500">{formatEventWhen(e.starts_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Nächstes Training" icon={<Dumbbell className="h-4 w-4" aria-hidden />}>
          {!nextTraining ? (
            <EmptyLine text="Kein kommendes Training geplant." />
          ) : (
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-900">{formatEventWhen(nextTraining.starts_at)}</p>
              {nextTrainingPlan.loading ? (
                <p className="text-[13px] text-slate-400">Trainingsplan wird geladen…</p>
              ) : nextTrainingPlan.status === 'none' ? (
                <p className="text-[13px] text-slate-500">Noch nicht geplant</p>
              ) : nextTrainingPlan.status === 'completed' ? (
                <p className="text-[13px] text-slate-500">
                  Training abgeschlossen
                  {nextTrainingPlan.actualDurationMinutes != null
                    ? ` · ${nextTrainingPlan.actualDurationMinutes} Minuten`
                    : ''}
                  {nextTrainingPlan.reviewRating
                    ? ` · Bewertung: ${
                        (
                          {
                            excellent: 'Sehr gut',
                            good: 'Gut',
                            partial: 'Teilweise',
                            off_plan: 'Nicht wie geplant',
                          } as Record<string, string>
                        )[nextTrainingPlan.reviewRating] ?? nextTrainingPlan.reviewRating
                      }`
                    : ''}
                </p>
              ) : nextTrainingPlan.status === 'needs_doc' ? (
                <p className="text-[13px] text-amber-800">Training noch dokumentieren</p>
              ) : (
                <p className="text-[13px] text-slate-500">
                  Trainingsplan bereit · {nextTrainingPlan.exerciseCount} Übung
                  {nextTrainingPlan.exerciseCount === 1 ? '' : 'en'}
                  {nextTrainingPlan.durationMinutes != null
                    ? ` · ${nextTrainingPlan.durationMinutes} Minuten`
                    : ''}
                  {nextTrainingPlan.status === 'draft' ? ' · Entwurf' : ''}
                </p>
              )}
              {nextTrainingPlan.pitchLabel ? (
                <p className="text-[12px] text-slate-400">{nextTrainingPlan.pitchLabel}</p>
              ) : null}
              {nextTrainingPlan.sessionId ? (
                <Link
                  to={`/manager/training/einheiten/${encodeURIComponent(nextTrainingPlan.sessionId)}${
                    nextTrainingPlan.status === 'needs_doc' ? '#training-doc' : ''
                  }`}
                  className="mt-2 inline-flex text-[13px] font-semibold text-red-700 hover:text-red-800"
                >
                  {nextTrainingPlan.status === 'needs_doc'
                    ? 'Training dokumentieren'
                    : nextTrainingPlan.status === 'completed'
                      ? 'Dokumentation öffnen'
                      : 'Trainingsplan öffnen'}
                </Link>
              ) : (
                <Link
                  to={`/manager/training/einheiten/neu?event=${encodeURIComponent(nextTraining.id)}`}
                  className="mt-2 inline-flex text-[13px] font-semibold text-red-700 hover:text-red-800"
                >
                  Training planen
                </Link>
              )}
            </div>
          )}
        </Card>

        <Card title="Nächstes Spiel" icon={<Trophy className="h-4 w-4" aria-hidden />}>
          {!nextMatch ? (
            <EmptyLine text="Kein kommendes Spiel geplant." />
          ) : (
            <Link to={`/app/events/${encodeURIComponent(nextMatch.id)}`} className="block space-y-1">
              <p className="font-semibold text-slate-900">{eventTitle(nextMatch)}</p>
              <p className="text-[13px] text-slate-500">{formatEventWhen(nextMatch.starts_at)}</p>
            </Link>
          )}
        </Card>

        <Card title="Mannschaft / Kader" icon={<Users className="h-4 w-4" aria-hidden />}>
          {players.length === 0 ? (
            <EmptyLine text="Noch keine aktiven Spieler im Kader." />
          ) : (
            <p>
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{players.length}</span>
              <span className="ml-2 text-[13px] text-slate-500">aktive Spieler</span>
            </p>
          )}
          <Link
            to="/app/team"
            className="mt-3 inline-flex text-[13px] font-semibold text-red-700 hover:text-red-800"
          >
            Mannschaft öffnen
          </Link>
        </Card>

        <Card title="Offene Zu- und Absagen" icon={<ClipboardList className="h-4 w-4" aria-hidden />}>
          {attendanceLoading ? (
            <EmptyLine text="Rückmeldungen werden geladen…" />
          ) : nextEvents.length === 0 ? (
            <EmptyLine text="Keine Termine zur Auswertung." />
          ) : (
            <p>
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{openRsvpCount}</span>
              <span className="ml-2 text-[13px] text-slate-500">
                offene Rückmeldungen (nächste Termine × Kader)
              </span>
            </p>
          )}
        </Card>

        <Card title="Aktuelle Saison" icon={<Shield className="h-4 w-4" aria-hidden />}>
          {!contextSeason ? (
            <EmptyLine text="Kein Saisonkontext gewählt." />
          ) : (
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">
                Saison {(contextSeason.season?.name ?? '').trim() || '—'}
                {contextSeason.age_group ? ` · ${contextSeason.age_group}` : ''}
              </p>
              <p className="text-[13px] text-slate-500">
                {getSeasonStatusLabel(contextSeason.status)}
                {players.length > 0 ? ` · ${players.length} Spieler` : ''}
              </p>
              {seasonDraftHint ? (
                <p className="pt-1 text-[13px] text-amber-800">
                  {seasonDraftHint.label} ist vorbereitet — Kader prüfen und Saison aktivieren.
                </p>
              ) : null}
              {featured ? (
                <p className="pt-1 text-[12px] text-slate-400">
                  Nächster Fokus: {eventTitle(featured)} · {formatEventWhen(featured.starts_at)}
                </p>
              ) : null}
            </div>
          )}
          <Link
            to="/manager/saisons"
            className="mt-3 inline-flex text-[13px] font-semibold text-red-700 hover:text-red-800"
          >
            {seasonDraftHint ? 'Saisonentwurf öffnen' : 'Saison verwalten'}
          </Link>
        </Card>
      </div>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <h2 className="text-[13px] font-semibold text-slate-800">Schnellaktionen</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/app/termine"
            className="inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800"
          >
            Termin erstellen
          </Link>
          <Link
            to="/app/team"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Mannschaft öffnen
          </Link>
          <Link
            to="/app/team"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Spieler verwalten
          </Link>
          <Link
            to="/manager/saisons"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Saisonen
          </Link>
          <Link
            to="/manager/platzbelegung"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Platzbelegung
          </Link>
          <Link
            to="/manager/training/einheiten"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Trainingsplanung
          </Link>
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
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Heute am Sportplatz" icon={<MapPin className="h-4 w-4" aria-hidden />}>
          {todayField.loading ? (
            <EmptyLine text="Platzbelegung wird geladen…" />
          ) : todayField.migrationPending ? (
            <EmptyLine text="Platzbelegung bereit – Datenbank-Migration auf Staging ausstehend." />
          ) : todayField.error ? (
            <p className="text-[13px] text-red-700">{todayField.error}</p>
          ) : todayField.assignedCount === 0 ? (
            <EmptyLine text="Heute sind keine Plätze belegt." />
          ) : (
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-900">
                {todayField.assignedCount} Termin{todayField.assignedCount === 1 ? '' : 'e'}
                {todayField.rangeLabel ? ` · ${todayField.rangeLabel}` : ''}
              </p>
              {todayField.fieldCount > 0 ? (
                <p className="text-[13px] text-slate-500">
                  {todayField.fieldCount} Platz{todayField.fieldCount === 1 ? '' : 'plätze'} belegt
                </p>
              ) : null}
              {todayField.nextLabel ? (
                <p className="text-[12px] text-slate-400">Als Nächstes: {todayField.nextLabel}</p>
              ) : null}
            </div>
          )}
          {!todayField.loading && !todayField.migrationPending && todayField.unassignedCount > 0 ? (
            <p className="mt-2 text-[12px] text-amber-800">
              {todayField.unassignedCount} Termin
              {todayField.unassignedCount === 1 ? '' : 'e'} ohne Platzzuordnung
            </p>
          ) : null}
          <Link
            to="/manager/platzbelegung"
            className="mt-3 inline-flex text-[13px] font-semibold text-red-700 hover:text-red-800"
          >
            Platzbelegung öffnen
          </Link>
        </Card>

        <Card title="Kommende Module">
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: <Video className="h-3.5 w-3.5" />, label: 'Video & Highlights' },
              { icon: <ShoppingBag className="h-3.5 w-3.5" />, label: 'Ausrüstung & Teamshop' },
            ].map((m) => (
              <li
                key={m.label}
                className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-2.5 py-2 text-[12px] text-slate-500"
              >
                <span className="text-slate-400">{m.icon}</span>
                {m.label}
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-slate-400">
                  Demnächst
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
