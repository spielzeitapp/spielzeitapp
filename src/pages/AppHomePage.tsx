import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import { useProfile, welcomeGreetingFromProfile } from '../auth/useProfile';
import { useEvents, type EventRow } from '../hooks/useEvents';
import { Card, CardTitle } from '../app/components/ui/Card';
import { supabase } from '../lib/supabaseClient';

type MessageRow = {
  id: string;
  title: string;
  content: string | null;
  body: string | null;
  type: string;
  event_id: string | null;
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

function formatOpenActionWhen(iso: string | null): string {
  if (!iso) return 'unbekannten Zeitpunkt';
  try {
    const d = new Date(iso);
    const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(d).replace(/\.$/, '');
    const date = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long' }).format(d);
    const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(d);
    return `${weekday}. ${date}, ${time}`;
  } catch {
    return iso;
  }
}

function eventOpenActionPhrase(ev: EventRow): string {
  if (ev.kind === 'training') return 'das Training';
  if (ev.kind === 'event') return 'den Termin';
  return 'das Spiel';
}

export const AppHomePage: React.FC = () => {
  const { selectedTeamSeasonId: teamSeasonId, loading: sessionLoading, effectiveRole, selectedTeamSeason } =
    useSession();
  const { events, loading: evLoading } = useEvents(teamSeasonId);
  const { session } = useAuth();
  const { profile, loading: profileLoading } = useProfile(session?.user?.id ?? null);
  const teamId = selectedTeamSeason?.team?.id ?? null;
  const teamName = selectedTeamSeason?.team?.name ?? '—';
  const welcomeName = !profileLoading ? welcomeGreetingFromProfile(profile) : '';

  const [latestMessage, setLatestMessage] = useState<MessageRow | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [pendingRsvp, setPendingRsvp] = useState<boolean | null>(null);

  const now = useMemo(() => new Date(), []);
  const next = useMemo(() => nextUpcoming(events ?? [], now), [events, now]);

  const loadLatestMessage = useCallback(async () => {
    if (!teamId) {
      setLatestMessage(null);
      setMessagesLoading(false);
      return;
    }
    setMessagesLoading(true);
    try {
      const userRes = await supabase.auth.getUser();
      const uid = userRes.data.user?.id;
      if (!uid) {
        setLatestMessage(null);
        return;
      }

      const { data, error } = await supabase
        .from('messages')
        .select('id, title, content, body, type, event_id, created_at')
        .eq('team_id', teamId)
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        setLatestMessage(null);
        return;
      }
      const list = Array.isArray(data) ? (data as MessageRow[]) : [];
      setLatestMessage(list[0] ?? null);
    } catch {
      setLatestMessage(null);
    } finally {
      setMessagesLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void loadLatestMessage();
  }, [loadLatestMessage]);

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
        {welcomeName ? (
          <h1 className="text-xl font-bold text-white">Herzlich willkommen, {welcomeName}!</h1>
        ) : (
          <h1 className="text-xl font-bold text-white">Herzlich willkommen!</h1>
        )}
        <p className="text-sm text-white/60">Dein Überblick für {teamName}</p>

        {loading && <p className="text-sm text-white/50">Laden…</p>}

        {!loading && next && (
          <>
            <Card className="border-white/10 bg-white/5 text-white">
              <CardTitle className="text-base">Nächster Termin</CardTitle>

              <p className="mt-1 text-lg font-semibold text-white">
                {next.kind === 'training' ? 'Training' : next.kind === 'event' ? 'Termin' : 'Spiel'}
              </p>
              <p className="mt-1 text-sm text-white/70">{formatDt(next.starts_at)}</p>
              <p className="mt-1 text-sm text-white/60">{next.location || next.address || '—'}</p>

              <Link
                to={`/app/events/${next.id}`}
                className="mt-3 inline-block text-sm font-medium text-red-400 hover:text-red-300"
              >
                Details &amp; RSVP
              </Link>
            </Card>

            {pendingRsvp === true && (
              <Card className="border-amber-500/30 bg-amber-950/30 text-white">
                <div className="px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200">
                    Offene Aktion
                  </div>
                  <p className="mt-2 text-sm text-amber-100">
                    Bitte reagiere auf {eventOpenActionPhrase(next)} am {formatOpenActionWhen(next.starts_at)}.
                  </p>

                  <Link
                    to={`/app/events/${next.id}`}
                    className="mt-3 inline-block text-sm font-semibold text-red-300 hover:text-red-200"
                  >
                    Jetzt reagieren →
                  </Link>
                </div>
              </Card>
            )}
            {pendingRsvp === false && (
              <Card className="border-emerald-500/30 bg-emerald-950/20 text-white">
                <div className="px-4 py-3 text-sm text-emerald-100">Alles erledigt 👍</div>
              </Card>
            )}
          </>
        )}

        {!loading && !next && teamSeasonId && (
          <Card className="border-white/10 bg-white/5 text-white">
            <p className="text-sm text-white/70">Keine bevorstehenden Termine.</p>
            <Link to="/app/termine" className="mt-2 inline-block text-sm text-red-400">
              Zu Termine
            </Link>
          </Card>
        )}

        {messagesLoading ? (
          <Card className="border-white/10 bg-white/5 text-white">
            <CardTitle className="text-base">Letzte wichtige Nachricht</CardTitle>
            <p className="mt-2 text-sm text-white/50">Laden…</p>
          </Card>
        ) : latestMessage ? (
          <Card className="border-white/10 bg-white/5 text-white">
            <CardTitle className="text-base">Nachrichten</CardTitle>
            <Link
              to="/app/nachrichten"
              className="-mx-1 mt-2 block rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
            >
              <p className="font-medium text-white">{latestMessage.title}</p>
              <p className="mt-1 line-clamp-1 text-sm text-white/55">
                {(latestMessage.body ?? latestMessage.content ?? '').replace(/\s+/g, ' ').trim()}
              </p>
              <p className="mt-1.5 text-[11px] text-white/40">{formatDt(latestMessage.created_at)}</p>
            </Link>
          </Card>
        ) : (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-white/50">
            <p className="text-sm">Noch keine Nachrichten.</p>
          </div>
        )}
      </div>
    </div>
  );
};
