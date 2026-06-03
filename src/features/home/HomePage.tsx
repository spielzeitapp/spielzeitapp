import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { useAuth } from '../../auth/AuthProvider';
import { useEvents } from '../../hooks/useEvents';
import {
  buildDemoHomeMatchEvents,
  pickHomeMatchCard,
} from './homeFeedBuilder';
import { useTeamFeedPosts } from '../../hooks/useTeamFeedPosts';
import { HomeFeedPostRenderer } from '../../components/feed/HomeFeedPostRenderer';
import type { EventRow } from '../../hooks/useEvents';
import { HomeFeedComposer } from './HomeFeedComposer';
import { HomeUpcomingMatchCompact } from './HomeUpcomingMatchCompact';
import { HomeSpieltagHintCard } from './HomeSpieltagHintCard';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';
import { dsPrimaryCtaClass, dsSublineClass } from '../../lib/premiumDesignSystem';
import {
  GlassCard,
  PageShell,
  PremiumEmptyState,
  SectionTitle,
} from '../../ui';
import { cn } from '../../ui/lib/cn';

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
  const teamName = selectedTeamSeason?.team?.name ?? 'Team';
  const seasonLabel = (selectedTeamSeason?.season?.name ?? '').trim() || '—';
  const teamSeasonLine = `${teamName} · ${seasonLabel}`;
  const teamId = String(selectedTeamSeason?.team?.id ?? selectedTeamSeason?.team_id ?? '');

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

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

  const spieltagHintPick =
    matchPick && (matchPick.status === 'today' || matchPick.status === 'tomorrow') ? matchPick : null;
  const showNextMatchCompact = Boolean(matchPick && matchPick.status === 'next');

  return (
    <PageShell
      variant="subtle"
      showAtmosphere={false}
      className="page app-home min-h-[60vh] w-full max-w-none min-w-0 overflow-x-hidden px-3 pb-28 pt-2 sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-none space-y-3 md:max-w-3xl lg:max-w-4xl"
    >
      {loading && <p className="text-sm text-white/50">Laden…</p>}

      {!loading && !teamSeasonId && !FEED_DEMO && (
        <PremiumEmptyState
          title="Team / Saison wählen"
          description='Bitte Team / Saison wählen (z. B. unter „Mehr“).'
        />
      )}

      {!loading && showContent && (
        <div className="min-w-0 space-y-2">
          <SectionTitle variant="interactive" as="h2" className="!text-lg sm:!text-xl">
            Matchday Feed
          </SectionTitle>
          <p className={cn(dsSublineClass(), 'text-[12px] sm:text-[13px]')}>{teamSeasonLine}</p>

          <div className="min-w-0 space-y-3">
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

            {spieltagHintPick ? <HomeSpieltagHintCard pick={spieltagHintPick} /> : null}

            <section className="min-w-0 space-y-3" aria-label="Team-Feed">
              <SectionTitle variant="interactive" as="p" className="!text-[11px] sm:!text-xs">
                Im Feed
              </SectionTitle>
              {teamFeedLoading ? (
                <p className="text-sm text-white/50">Feed wird geladen…</p>
              ) : teamFeedPosts.length === 0 ? (
                <PremiumEmptyState
                  variant="subtle"
                  title="Noch keine Beiträge"
                  description="Am Spieltag erscheint der Matchday-Post. Trainer posten Fotos/Videos oben."
                />
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

            {showNextMatchCompact && matchPick ? (
              <section className="space-y-2" aria-label="Nächstes Spiel">
                <SectionTitle variant="subtle" as="p" className="!text-[11px] uppercase sm:!text-xs">
                  Nächstes Spiel
                </SectionTitle>
                <HomeUpcomingMatchCompact pick={matchPick} teamName={teamName} />
              </section>
            ) : !matchPick ? (
              <PremiumEmptyState
                title="Kein Spiel in Sicht"
                description="Für dein Team ist aktuell kein kommendes Spiel eingetragen."
              >
                <Link
                  to="/app/termine"
                  className={cn(
                    dsPrimaryCtaClass(),
                    'mt-2 inline-flex min-h-[48px] items-center justify-center px-6 py-3',
                  )}
                >
                  Zu den Terminen
                </Link>
              </PremiumEmptyState>
            ) : null}

            <GlassCard variant="subtle" showAmbientGlow={false} className="px-4 py-3">
              <SectionTitle variant="interactive" as="p" className="!text-xs">
                Offene Aufgaben
              </SectionTitle>
              <p className="mt-2 text-sm text-white/70">Keine offenen Aufgaben. Alles erledigt.</p>
            </GlassCard>
          </div>
        </div>
      )}
    </PageShell>
  );
};
