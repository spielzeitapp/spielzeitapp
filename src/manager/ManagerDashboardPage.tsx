import React, { useMemo } from 'react';
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

/**
 * STEP-1-Dashboard: echte Session-Daten, keine erfundenen Kennzahlen.
 */
export function ManagerDashboardPage(): React.ReactElement {
  const { user: authUser } = useAuth();
  const { profile } = useProfile(authUser?.id);
  const { selectedTeamSeason, selectedTeamSeasonId, viewTeamSeason, teamSeasons } = useSession();

  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;

  const { events, loading: eventsLoading, error: eventsError } = useEvents(teamSeasonId);
  const { players, loading: playersLoading, error: playersError } = usePlayers(teamSeasonId, {
    mode: 'active',
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
            <Link to={`/app/events/${encodeURIComponent(nextTraining.id)}`} className="block space-y-1">
              <p className="font-semibold text-slate-900">{formatEventWhen(nextTraining.starts_at)}</p>
              <p className="text-[13px] text-slate-500">
                {(nextTraining.location ?? '').trim() || 'Ort noch offen'}
              </p>
            </Link>
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
                {(contextSeason.season?.name ?? '').trim() || 'Saison'}
              </p>
              <p className="text-[13px] text-slate-500">
                Status: {getSeasonStatusLabel(contextSeason.status)}
              </p>
              {featured ? (
                <p className="pt-1 text-[12px] text-slate-400">
                  Nächster Fokus: {eventTitle(featured)} · {formatEventWhen(featured.starts_at)}
                </p>
              ) : null}
            </div>
          )}
          <Link
            to="/app/mehr/seasons"
            className="mt-3 inline-flex text-[13px] font-semibold text-red-700 hover:text-red-800"
          >
            Saison verwalten
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
            to="/app/mehr/seasons"
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            Saison verwalten
          </Link>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Heute am Sportplatz" icon={<MapPin className="h-4 w-4" aria-hidden />}>
          <p className="text-[13px] leading-snug text-slate-500">
            Platzbelegung und Reservierungen folgen in einem späteren Schritt.
          </p>
          <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            In Planung
          </span>
        </Card>

        <Card title="Kommende Module">
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: <Dumbbell className="h-3.5 w-3.5" />, label: 'Trainingsplanung' },
              { icon: <MapPin className="h-3.5 w-3.5" />, label: 'Platzbelegung' },
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
