import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import { useEvents, type EventRow } from '../hooks/useEvents';
import { Card, CardTitle } from '../app/components/ui/Card';
import { supabase } from '../lib/supabaseClient';

const NOTIF_API = '/api/notifications';

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  created_at: string;
};

function nextUpcoming(events: EventRow[], now: Date): EventRow | null {
  const upcoming = events
    .filter((e) => {
      const st = e.status ?? 'upcoming';
      if (st === 'finished' || st === 'canceled') return false;
      const t = e.starts_at ? new Date(e.starts_at).getTime() : 0;
      return t >= now.getTime() - 60_000;
    })
    .sort((a, b) => {
      const ta = new Date(a.starts_at).getTime();
      const tb = new Date(b.starts_at).getTime();
      return ta - tb;
    });
  return upcoming[0] ?? null;
}

function lastFinishedMatch(events: EventRow[]): EventRow | null {
  const done = events
    .filter((e) => (e.status === 'finished' || e.status === 'canceled') && e.kind === 'match')
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  return done[0] ?? null;
}

function formatDt(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AppHomePage: React.FC = () => {
  const { selectedTeamSeasonId: teamSeasonId, loading: sessionLoading, effectiveRole, selectedTeamSeason } =
    useSession();
  const { events, loading: evLoading } = useEvents(teamSeasonId);
  const { session } = useAuth();
  const teamId = selectedTeamSeason?.team?.id ?? null;

  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [pendingRsvp, setPendingRsvp] = useState<boolean | null>(null);

  const now = useMemo(() => new Date(), []);
  const next = useMemo(() => nextUpcoming(events ?? [], now), [events, now]);
  const lastMatch = useMemo(() => lastFinishedMatch(events ?? []), [events]);

  const loadNotifs = useCallback(async () => {
    if (!session?.access_token || !teamId) {
      setNotifs([]);
      return;
    }
    setNotifLoading(true);
    try {
      const q = new URLSearchParams({ team_id: String(teamId) });
      const res = await fetch(`${NOTIF_API}?${q}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json()) as { notifications?: NotificationRow[] };
      setNotifs(Array.isArray(data.notifications) ? data.notifications.slice(0, 5) : []);
    } catch {
      setNotifs([]);
    } finally {
      setNotifLoading(false);
    }
  }, [session?.access_token, teamId]);

  useEffect(() => {
    void loadNotifs();
  }, [loadNotifs]);

  /** Eltern: offene Zusage beim nächsten Termin (opt_in) */
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (effectiveRole !== 'parent' || !next?.id || !session?.user?.id) {
        setPendingRsvp(null);
        return;
      }
      if (next.participation_mode !== 'opt_in') {
        setPendingRsvp(false);
        return;
      }
      const { data: guardians } = await supabase
        .from('player_guardians')
        .select('player_id')
        .eq('user_id', session.user.id);
      const pids = (guardians ?? []).map((g: { player_id: string }) => g.player_id).filter(Boolean);
      if (pids.length === 0) {
        setPendingRsvp(false);
        return;
      }
      const { data: att } = await supabase
        .from('event_attendance')
        .select('player_id, status')
        .eq('event_id', next.id)
        .in('player_id', pids);
      if (cancelled) return;
      const rows = att ?? [];
      const anyYes = rows.some((r: { status?: string }) => r.status === 'yes');
      const anyNo = rows.some((r: { status?: string }) => r.status === 'no');
      setPendingRsvp(!anyYes && !anyNo);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [effectiveRole, next, session?.user?.id]);

  const loading = sessionLoading || evLoading;

  return (
    <div
      className="page app-home min-h-[60vh] w-full px-4 py-6"
      style={{
        background:
          'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
        boxShadow: 'inset 0 0 120px rgba(120,20,20,0.12)',
      }}
    >
      <div className="mx-auto max-w-[560px] space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Home</h1>
        <p className="text-sm text-white/60">Dein Überblick</p>

        {loading && <p className="text-sm text-white/50">Laden…</p>}

        {!loading && pendingRsvp === true && (
          <div
            className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
            role="status"
          >
            Du hast noch nicht zugesagt – bitte beim nächsten Termin reagieren.
          </div>
        )}

        {!loading && next && (
          <Card className="border-white/10 bg-white/5 text-white">
            <CardTitle className="text-base">Nächster Termin</CardTitle>
            <p className="mt-1 text-lg font-semibold text-white">
              {next.opponent?.trim() ||
                (next.notes && next.notes.trim().slice(0, 80)) ||
                (next.kind === 'training' ? 'Training' : next.kind === 'event' ? 'Event' : 'Spiel')}
            </p>
            <p className="mt-1 text-sm text-white/70">
              {next.kind === 'training' ? 'Training' : next.kind === 'event' ? 'Event' : 'Spiel'} ·{' '}
              {formatDt(next.starts_at)}
            </p>
            {next.location && <p className="mt-1 text-sm text-white/60">{next.location}</p>}
            <Link
              to={`/app/events/${next.id}`}
              className="mt-3 inline-block text-sm font-medium text-red-400 hover:text-red-300"
            >
              Details &amp; RSVP →
            </Link>
          </Card>
        )}

        {!loading && !next && teamSeasonId && (
          <Card className="border-white/10 bg-white/5 text-white">
            <p className="text-sm text-white/70">Keine bevorstehenden Termine.</p>
            <Link to="/app/termine" className="mt-2 inline-block text-sm text-red-400">
              Zu Termine
            </Link>
          </Card>
        )}

        {!loading && lastMatch && (
          <Card className="border-white/10 bg-white/5 text-white">
            <CardTitle className="text-base">Letztes Ergebnis</CardTitle>
            <p className="mt-1 text-sm text-white/80">
              {lastMatch.opponent ?? 'Spiel'} · {formatDt(lastMatch.starts_at)}
            </p>
            <Link
              to={`/app/events/${lastMatch.id}`}
              className="mt-2 inline-block text-sm text-red-400 hover:text-red-300"
            >
              Ansehen
            </Link>
          </Card>
        )}

        <Card className="border-white/10 bg-white/5 text-white">
          <CardTitle className="text-base">Letzte Nachrichten</CardTitle>
          {notifLoading && <p className="mt-2 text-sm text-white/50">Laden…</p>}
          {!notifLoading && notifs.length === 0 && (
            <p className="mt-2 text-sm text-white/60">Noch keine Nachrichten.</p>
          )}
          {!notifLoading && notifs.length > 0 && (
            <ul className="mt-2 space-y-2">
              {notifs.map((n) => (
                <li key={n.id} className="border-b border-white/10 pb-2 last:border-0">
                  <p className="font-medium text-white">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-white/60">{n.message}</p>
                </li>
              ))}
            </ul>
          )}
          <Link to="/app/mehr/notifications" className="mt-3 inline-block text-sm text-red-400">
            Alle Nachrichten
          </Link>
        </Card>
      </div>
    </div>
  );
};
