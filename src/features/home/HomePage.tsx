import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { useProfile, welcomeGreetingFromProfile } from '../../auth/useProfile';
import { useAuth } from '../../auth/AuthProvider';
import { useEvents } from '../../hooks/useEvents';
import { MatchdayCard } from '../../components/feed/MatchdayCard';
import {
  buildDemoHomeMatchEvents,
  HOME_MATCH_STATUS_LABEL,
  pickHomeMatchCard,
} from './homeFeedBuilder';
import { HomeHeader } from './HomeHeader';
import { HomeQuickActions } from './HomeQuickActions';

const FEED_DEMO = import.meta.env.VITE_HOME_FEED_DEMO === '1';

export const HomePage: React.FC = () => {
  const { selectedTeamSeasonId: teamSeasonId, loading: sessionLoading, selectedTeamSeason } = useSession();
  const { events, loading: evLoading } = useEvents(teamSeasonId);
  const { session } = useAuth();
  const { profile, loading: profileLoading } = useProfile(session?.user?.id ?? null);
  const teamName = selectedTeamSeason?.team?.name ?? 'Team';

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const welcomeLine = useMemo(() => {
    const name = !profileLoading ? welcomeGreetingFromProfile(profile) : '';
    return name ? `Herzlich willkommen, ${name}!` : 'Herzlich willkommen!';
  }, [profile, profileLoading]);

  const matchPick = useMemo(() => {
    const source = FEED_DEMO ? buildDemoHomeMatchEvents(now) : (events ?? []);
    return pickHomeMatchCard(source, now);
  }, [events, now]);

  const loading = sessionLoading || evLoading;
  const showContent = teamSeasonId || FEED_DEMO;

  return (
    <div
      className="page app-home min-h-[60vh] w-full px-4 pb-28 pt-5"
      style={{ backgroundColor: '#0b0b0b' }}
    >
      <div className="mx-auto w-full max-w-[420px] space-y-5">
        <HomeHeader welcomeLine={welcomeLine} teamName={teamName} />

        {loading && <p className="text-base text-white/50">Laden…</p>}

        {!loading && !teamSeasonId && !FEED_DEMO && (
          <div className="rounded-2xl border border-white/10 bg-[#141414] px-5 py-8 text-center shadow-lg">
            <p className="text-base leading-relaxed text-white/70">
              Bitte Team / Saison wählen (z. B. unter „Mehr“).
            </p>
          </div>
        )}

        {!loading && showContent && matchPick && (
          <MatchdayCard
            event={matchPick.event}
            teamName={teamName}
            statusLabel={HOME_MATCH_STATUS_LABEL[matchPick.status]}
          />
        )}

        {!loading && showContent && !matchPick && (
          <div
            className="rounded-2xl border border-white/[0.08] bg-[#141414] px-5 py-10 text-center shadow-lg"
            style={{ boxShadow: '0 12px 28px rgba(0,0,0,0.3)' }}
          >
            <p className="text-lg font-semibold text-white/90">Kein Spiel in Sicht</p>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Für dein Team ist aktuell kein kommendes Spiel eingetragen.
            </p>
            <Link
              to="/app/termine"
              className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-red-500 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-red-600"
            >
              Zu den Terminen
            </Link>
          </div>
        )}

        {(showContent || (!teamSeasonId && !FEED_DEMO && !loading)) && <HomeQuickActions />}
      </div>
    </div>
  );
};
