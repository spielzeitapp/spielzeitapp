import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { useProfile, welcomeGreetingFromProfile } from '../../auth/useProfile';
import { useAuth } from '../../auth/AuthProvider';
import { useEvents } from '../../hooks/useEvents';
import {
  buildDemoHomeMatchEvents,
  pickHomeMatchCard,
} from './homeFeedBuilder';
import { HomeHeader } from './HomeHeader';
import { useTeamFeedPosts } from '../../hooks/useTeamFeedPosts';
import { HomeFeedPostRenderer } from '../../components/feed/HomeFeedPostRenderer';
import type { EventRow } from '../../hooks/useEvents';
import { HomeFeedComposer } from './HomeFeedComposer';
import { HomeUpcomingMatchCompact } from './HomeUpcomingMatchCompact';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';

const FEED_DEMO = import.meta.env.VITE_HOME_FEED_DEMO === '1';

export const HomePage: React.FC = () => {
  const {
    selectedTeamSeasonId: teamSeasonId,
    loading: sessionLoading,
    selectedTeamSeason,
    backendRole,
    membershipRole,
  } = useSession();
  const { events, loading: evLoading } = useEvents(teamSeasonId);
  const { session } = useAuth();
  const { profile, loading: profileLoading } = useProfile(session?.user?.id ?? null);
  const teamName = selectedTeamSeason?.team?.name ?? 'Team';
  const teamId = String(selectedTeamSeason?.team?.id ?? selectedTeamSeason?.team_id ?? '');

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

  const { posts: teamFeedPosts, loading: teamFeedLoading, refetch: refetchFeed } = useTeamFeedPosts(teamSeasonId);
  const staffCanDeleteFeed = canStaffManageTeamFeed(backendRole, membershipRole);

  const eventById = useMemo(() => {
    const source = FEED_DEMO ? buildDemoHomeMatchEvents(now) : (events ?? []);
    const m = new Map<string, EventRow>();
    for (const e of source) m.set(e.id, e);
    return m;
  }, [events, now]);

  const loading = sessionLoading || evLoading;
  const showContent = teamSeasonId || FEED_DEMO;

  return (
    <div
      className="page app-home min-h-[60vh] w-full max-w-none min-w-0 overflow-x-hidden px-3 pb-28 pt-4 sm:px-4 md:px-0"
      style={{ backgroundColor: '#0b0b0b' }}
    >
      <div className="mx-auto w-full min-w-0 max-w-none space-y-4 md:max-w-3xl lg:max-w-4xl">
        <HomeHeader welcomeLine={welcomeLine} teamName={teamName} backendRole={backendRole} />

        {loading && <p className="text-sm text-white/50">Laden…</p>}

        {!loading && !teamSeasonId && !FEED_DEMO && (
          <div className="rounded-2xl border border-white/10 bg-[#141414] px-5 py-8 text-center shadow-lg">
            <p className="text-base leading-relaxed text-white/70">
              Bitte Team / Saison wählen (z. B. unter „Mehr“).
            </p>
          </div>
        )}

        {!loading && showContent && (
          <div className="min-w-0 space-y-4">
            <section className="min-w-0 space-y-3" aria-label="Team-Feed">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300/90">Feed</p>
              {teamSeasonId && teamId ? (
                <HomeFeedComposer
                  backendRole={backendRole}
                  membershipRole={membershipRole}
                  teamSeasonId={teamSeasonId}
                  teamId={teamId}
                  userId={session?.user?.id ?? null}
                  onPosted={() => void refetchFeed()}
                />
              ) : null}
              {teamFeedLoading ? (
                <p className="text-sm text-white/50">Feed wird geladen…</p>
              ) : teamFeedPosts.length === 0 ? (
                <div className="rounded-xl border border-white/[0.07] bg-[#141414]/90 px-3 py-3">
                  <p className="text-xs leading-relaxed text-white/55">
                    Noch keine Beiträge. Am Spieltag erscheint der Matchday-Post. Trainer posten Fotos/Videos oben.
                  </p>
                </div>
              ) : (
                <div className="min-w-0 space-y-4">
                  {teamFeedPosts.map((item) => (
                    <HomeFeedPostRenderer
                      key={item.post.id}
                      item={item}
                      eventById={eventById}
                      teamLabel={teamName}
                      staffCanDelete={staffCanDeleteFeed}
                      onFeedPostDeleted={() => void refetchFeed()}
                    />
                  ))}
                </div>
              )}
            </section>

            {matchPick ? (
              <section className="space-y-2" aria-label="Nächstes Spiel">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Nächstes Spiel</p>
                <HomeUpcomingMatchCompact pick={matchPick} teamName={teamName} />
              </section>
            ) : (
              <div
                className="rounded-2xl border border-white/[0.08] bg-[#141414] px-4 py-8 text-center shadow-lg"
                style={{ boxShadow: '0 12px 28px rgba(0,0,0,0.3)' }}
              >
                <p className="text-base font-semibold text-white/90">Kein Spiel in Sicht</p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Für dein Team ist aktuell kein kommendes Spiel eingetragen.
                </p>
                <Link
                  to="/app/termine"
                  className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-red-500 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-red-600"
                >
                  Zu den Terminen
                </Link>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-[#141414] p-4 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300/90">Offene Aufgaben</p>
              <p className="mt-2 text-sm text-white/70">Keine offenen Aufgaben. Alles erledigt.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
