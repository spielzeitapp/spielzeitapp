import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useSession } from '../../auth/useSession';
import { useProfile, welcomeGreetingFromProfile } from '../../auth/useProfile';
import { useEvents, type EventRow } from '../../hooks/useEvents';
import { supabase } from '../../lib/supabaseClient';
import {
  buildHomeFeed,
  buildDemoHomeFeedArgs,
  isUpcomingRelevant,
  type HomeFeedAttendance,
  type HomeMessage,
} from './homeFeedBuilder';
import { HomeHeader } from './HomeHeader';
import { HomeFeaturedCard } from './HomeFeaturedCard';
import { HomeFeedList } from './HomeFeedList';
import { HomeQuickActions } from './HomeQuickActions';

const FEED_DEMO = import.meta.env.VITE_HOME_FEED_DEMO === '1';

async function loadOpenReminderForParent(
  userId: string,
  events: EventRow[],
  now: Date,
): Promise<HomeFeedAttendance['openReminder']> {
  const upcomingOptIn = events
    .filter((e) => isUpcomingRelevant(e, now) && e.attendance_mode === 'opt_in')
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  if (upcomingOptIn.length === 0) return null;

  const { data: guardians, error: gErr } = await supabase
    .from('player_guardians')
    .select('player_id')
    .eq('user_id', userId);
  if (gErr) return null;
  const pids = (guardians ?? []).map((g: { player_id: string }) => g.player_id).filter(Boolean);
  if (pids.length === 0) return null;

  for (const ev of upcomingOptIn) {
    const { data: att, error: aErr } = await supabase
      .from('event_attendance')
      .select('player_id, status')
      .eq('event_id', ev.id)
      .in('player_id', pids);
    if (aErr) continue;
    const rows = att ?? [];
    let unanswered = 0;
    for (const pid of pids) {
      const row = rows.find((r: { player_id: string }) => r.player_id === pid);
      const st = (row as { status?: string } | undefined)?.status;
      if (st !== 'yes' && st !== 'no') unanswered++;
    }
    if (unanswered > 0) return { event: ev, unansweredChildren: unanswered };
  }
  return null;
}

export const HomePage: React.FC = () => {
  const {
    selectedTeamSeasonId: teamSeasonId,
    loading: sessionLoading,
    effectiveRole,
    selectedTeamSeason,
  } = useSession();
  const { events, loading: evLoading } = useEvents(teamSeasonId);
  const { session } = useAuth();
  const { profile, loading: profileLoading } = useProfile(session?.user?.id ?? null);
  const teamId = selectedTeamSeason?.team?.id ?? null;
  const teamName = selectedTeamSeason?.team?.name ?? 'Team';

  const [now, setNow] = useState(() => new Date());
  const [messages, setMessages] = useState<HomeMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [openReminder, setOpenReminder] = useState<HomeFeedAttendance['openReminder']>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const loadLatestMessages = useCallback(async () => {
    if (!teamId) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }
    setMessagesLoading(true);
    try {
      const userRes = await supabase.auth.getUser();
      const uid = userRes.data.user?.id;
      if (!uid) {
        setMessages([]);
        return;
      }
      const { data, error } = await supabase
        .from('messages')
        .select('id, title, content, body, created_at')
        .eq('team_id', teamId)
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        setMessages([]);
        return;
      }
      const list = Array.isArray(data) ? (data as HomeMessage[]) : [];
      setMessages(list);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void loadLatestMessages();
  }, [loadLatestMessages]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (FEED_DEMO) {
        setOpenReminder(null);
        return;
      }
      if (effectiveRole !== 'parent' || !session?.user?.id) {
        setOpenReminder(null);
        return;
      }
      const rem = await loadOpenReminderForParent(session.user.id, events ?? [], now);
      if (!cancelled) setOpenReminder(rem);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [effectiveRole, session?.user?.id, events, now]);

  const welcomeLine = useMemo(() => {
    const name = !profileLoading ? welcomeGreetingFromProfile(profile) : '';
    return name ? `Herzlich willkommen, ${name}!` : 'Herzlich willkommen!';
  }, [profile, profileLoading]);

  const feed = useMemo(() => {
    if (FEED_DEMO) {
      return buildHomeFeed(buildDemoHomeFeedArgs(now));
    }
    const attendance: HomeFeedAttendance = { openReminder };
    return buildHomeFeed({
      events: events ?? [],
      messages,
      attendance,
      now,
    });
  }, [events, messages, openReminder, now]);

  const loading = sessionLoading || evLoading;

  return (
    <div
      className="page app-home min-h-[60vh] w-full px-4 pb-28 pt-5"
      style={{ backgroundColor: '#0b0b0b' }}
    >
      <div className="mx-auto w-full max-w-[420px] space-y-5">
        <HomeHeader welcomeLine={welcomeLine} teamName={teamName} />

        {loading && <p className="text-base text-white/50">Laden…</p>}

        {!loading &&
          !!teamSeasonId &&
          messagesLoading &&
          feed.items.every((i) => i.type !== 'news') && (
            <p className="text-sm text-white/40">Nachrichten werden geladen…</p>
          )}

        {!loading && !teamSeasonId && !FEED_DEMO && (
          <p className="rounded-2xl border border-white/10 bg-[#141414] px-4 py-6 text-center text-base text-white/60">
            Bitte Team / Saison wählen (z. B. unter „Mehr“).
          </p>
        )}

        {!loading && (teamSeasonId || FEED_DEMO) && (
          <>
            <HomeFeaturedCard featured={feed.featured} teamName={teamName} now={now} />
            <HomeFeedList items={feed.items} now={now} />
            <HomeQuickActions />
          </>
        )}
      </div>
    </div>
  );
};
