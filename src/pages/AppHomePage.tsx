import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import { useProfile } from '../auth/useProfile';
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

export const AppHomePage: React.FC = () => {
  const { selectedTeamSeasonId: teamSeasonId, loading: sessionLoading, effectiveRole, selectedTeamSeason } =
    useSession();
  const { events, loading: evLoading } = useEvents(teamSeasonId);
  const { session } = useAuth();
  const { profile } = useProfile(session?.user?.id ?? null);
  const teamId = selectedTeamSeason?.team?.id ?? null;
  const teamName = selectedTeamSeason?.team?.name ?? '—';
  const welcomeName =
    profile?.first_name?.trim() ||
    profile?.full_name?.trim()?.split(' ')[0] ||
    profile?.display_name?.trim() ||
    'SpielzeitApp';

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
                  <p className="mt-2 text-sm text-amber-100">Du hast für 1 Termin noch nicht reagiert</p>

                  <Link
                    to={`/app/events/${next.id}`}
                    className="mt-3 inline-block text-sm font-medium text-red-300 hover:text-red-200"
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

        <Card className="border-white/10 bg-white/5 text-white">
          <CardTitle className="text-base">Letzte wichtige Nachricht</CardTitle>
          {messagesLoading && <p className="mt-2 text-sm text-white/50">Laden…</p>}
          {!messagesLoading && latestMessage && (
            <>
              <p className="mt-2 text-xs text-white/60">{formatDt(latestMessage.created_at)}</p>
              <p className="mt-1 font-medium text-white">{latestMessage.title}</p>
              <p className="mt-2 line-clamp-2 text-sm text-white/60">
                {latestMessage.body ?? latestMessage.content ?? ''}
              </p>
            </>
          )}
          {!messagesLoading && !latestMessage && <p className="mt-2 text-sm text-white/60">Noch keine Nachrichten.</p>}
          <Link to="/app/nachrichten" className="mt-3 inline-block text-sm text-red-400">
            Alle Nachrichten →
          </Link>
        </Card>
      </div>
    </div>
  );
};
