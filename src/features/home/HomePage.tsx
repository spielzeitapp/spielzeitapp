import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { useProfile, welcomeGreetingFromProfile } from '../../auth/useProfile';
import { useAuth } from '../../auth/AuthProvider';
import { useEvents } from '../../hooks/useEvents';
import { MatchdayCard } from '../../components/feed/MatchdayCard';
import { MatchdayHeroCard } from '../../components/feed/MatchdayHeroCard';
import { useMatchFeedSettingsMap } from '../../hooks/useMatchFeedSettingsMap';
import {
  buildDemoHomeMatchEvents,
  HOME_FEED_HERO_STATUS_LABEL,
  HOME_NEXT_MATCH_ORG_LABEL,
  pickHomeMatchCard,
} from './homeFeedBuilder';
import { HomeHeader } from './HomeHeader';
import { buildMatchdayHeroCardProps } from './matchdayHeroProps';
import { useTeamFeedPosts } from '../../hooks/useTeamFeedPosts';
import { MatchdayFeedPostCard } from '../../components/feed/MatchdayFeedPostCard';
import type { EventRow } from '../../hooks/useEvents';

const FEED_DEMO = import.meta.env.VITE_HOME_FEED_DEMO === '1';

export const HomePage: React.FC = () => {
  const location = useLocation();
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

  const matchEventIds = useMemo(() => {
    const source = FEED_DEMO ? buildDemoHomeMatchEvents(now) : (events ?? []);
    return source.filter((e) => e.kind === 'match').map((e) => e.id);
  }, [events, now]);

  const { byEventId: feedByEventId } = useMatchFeedSettingsMap(matchEventIds, location.key);
  const { posts: teamFeedPosts, loading: teamFeedLoading } = useTeamFeedPosts(teamSeasonId);

  const eventById = useMemo(() => {
    const source = FEED_DEMO ? buildDemoHomeMatchEvents(now) : (events ?? []);
    const m = new Map<string, EventRow>();
    for (const e of source) m.set(e.id, e);
    return m;
  }, [events, now]);

  const homeMatchCardEl = useMemo(() => {
    if (!matchPick) return null;
    const feed = feedByEventId[matchPick.event.id];
    const isSpieltagHeute = matchPick.status === 'today';

    if (isSpieltagHeute) {
      if (feed?.is_feed_enabled) {
        return (
          <MatchdayHeroCard
            {...buildMatchdayHeroCardProps({
              event: matchPick.event,
              feed,
              statusLabel: HOME_FEED_HERO_STATUS_LABEL.today,
            })}
          />
        );
      }
      return (
        <MatchdayCard
          event={matchPick.event}
          teamName={teamName}
          statusLabel={HOME_FEED_HERO_STATUS_LABEL.today}
        />
      );
    }

    const orgLabel =
      matchPick.status === 'tomorrow'
        ? HOME_NEXT_MATCH_ORG_LABEL.tomorrow
        : HOME_NEXT_MATCH_ORG_LABEL.next;
    return (
      <MatchdayCard
        event={matchPick.event}
        teamName={teamName}
        statusLabel={orgLabel}
      />
    );
  }, [matchPick, feedByEventId, teamName]);

  const loading = sessionLoading || evLoading;
  const showContent = teamSeasonId || FEED_DEMO;

  return (
    <div
      className="page app-home min-h-[60vh] w-full px-4 pb-28 pt-5 md:px-6 lg:px-2"
      style={{ backgroundColor: '#0b0b0b' }}
    >
      <div className="mx-auto w-full max-w-4xl space-y-5 lg:max-w-6xl">
        <HomeHeader welcomeLine={welcomeLine} teamName={teamName} />

        {loading && <p className="text-base text-white/50">Laden…</p>}

        {!loading && !teamSeasonId && !FEED_DEMO && (
          <div className="rounded-2xl border border-white/10 bg-[#141414] px-5 py-8 text-center shadow-lg">
            <p className="text-base leading-relaxed text-white/70">
              Bitte Team / Saison wählen (z. B. unter „Mehr“).
            </p>
          </div>
        )}

        {!loading && showContent && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              {homeMatchCardEl}
              {!matchPick ? (
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
              ) : null}
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-lg">
                <p className="text-sm font-semibold uppercase tracking-wide text-red-300">Offene Aufgaben</p>
                <p className="mt-2 text-sm text-white/70">Keine offenen Aufgaben. Alles erledigt.</p>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-red-300">Feed</p>
                {teamFeedLoading ? (
                  <p className="text-sm text-white/50">Feed wird geladen…</p>
                ) : teamFeedPosts.length === 0 ? (
                  <div
                    className="rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-lg"
                    style={{ boxShadow: '0 12px 28px rgba(0,0,0,0.3)' }}
                  >
                    <p className="text-sm text-white/70">
                      Neueste Infos und Team-Updates erscheinen hier. Am Spieltag siehst du automatisch den
                      Matchday-Post.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {teamFeedPosts.map((fp) => (
                      <MatchdayFeedPostCard
                        key={fp.id}
                        post={fp}
                        liveEvent={eventById.get(fp.event_id)}
                        teamLabel={teamName}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
