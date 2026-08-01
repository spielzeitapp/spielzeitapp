import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { useAuth } from '../../auth/AuthProvider';
import { useEvents } from '../../hooks/useEvents';
import { useActiveTeamSeason } from '../../hooks/useActiveTeamSeason';
import { resolveTeamSeasonLabelParts } from '../../lib/seasonLifecycle';
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
import { isHomeHeroDuplicateFeedPost } from '../../lib/feedPostPriority';
import {
  isMatchdayFeedPostHiddenByAutomation,
  loadAutoMatchdayFeedDisabledMatchIds,
} from '../../lib/autoMatchdayFeedEnabled';
import { isMatchReviewPending } from '../../lib/matchPreparationAccess';
import { supabase } from '../../lib/supabaseClient';
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
    effectiveRole,
  } = useSession();
  const { events, loading: evLoading } = useEvents(teamSeasonId);
  const { session } = useAuth();
  /** Home zeigt immer die aktive Work-Season (nicht Archiv-View). */
  const { activeTeamSeason } = useActiveTeamSeason();
  const homeLabelParts = useMemo(() => {
    if (!activeTeamSeason) return null;
    return resolveTeamSeasonLabelParts({
      displayName: activeTeamSeason.display_name,
      ageGroup: activeTeamSeason.age_group,
      teamName: activeTeamSeason.team?.name,
      seasonName: activeTeamSeason.season?.name,
      status: activeTeamSeason.status,
    });
  }, [activeTeamSeason]);
  const teamName = homeLabelParts?.teamLine ?? 'Team';
  const seasonLabel = homeLabelParts?.seasonLine && homeLabelParts.seasonLine !== '—'
    ? homeLabelParts.seasonLine
    : '—';
  const teamSeasonLine = homeLabelParts?.full ?? `${teamName} · ${seasonLabel}`;
  const teamId = String(selectedTeamSeason?.team?.id ?? selectedTeamSeason?.team_id ?? '');

  const [now, setNow] = useState(() => new Date());
  const [disabledMatchdayMatchIds, setDisabledMatchdayMatchIds] = useState<Set<string>>(() => new Set());
  /** Pessimistischer Default: Auto-Matchday erst nach Settings-Load anzeigen (kein Flash). */
  const [disabledMatchdayLoading, setDisabledMatchdayLoading] = useState(true);
  const [matchStatusById, setMatchStatusById] = useState<Record<string, string>>({});

  useEffect(() => {
    const matchIds = Array.from(
      new Set((events ?? []).filter((e) => e.match_id).map((e) => e.match_id!)),
    );
    if (matchIds.length === 0) {
      setMatchStatusById({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from('matches').select('id, status').in('id', matchIds);
      if (cancelled || error) return;
      const next: Record<string, string> = {};
      for (const row of data ?? []) next[row.id] = row.status ?? 'upcoming';
      setMatchStatusById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [events]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (FEED_DEMO) {
      setDisabledMatchdayMatchIds(new Set());
      setDisabledMatchdayLoading(false);
      return;
    }
    const matchIds = (events ?? [])
      .filter((e) => e.kind === 'match')
      .map((e) => e.match_id);
    if (matchIds.length === 0) {
      setDisabledMatchdayMatchIds(new Set());
      setDisabledMatchdayLoading(false);
      return;
    }
    let cancelled = false;
    setDisabledMatchdayLoading(true);
    void loadAutoMatchdayFeedDisabledMatchIds(matchIds).then((ids) => {
      if (!cancelled) {
        setDisabledMatchdayMatchIds(ids);
        setDisabledMatchdayLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [events]);

  const hasMatchEventsToCheck = useMemo(() => {
    if (FEED_DEMO) return false;
    return (events ?? []).some((e) => e.kind === 'match' && Boolean(e.match_id?.trim()));
  }, [events]);

  const autoMatchdaySettingsReady =
    FEED_DEMO || (!evLoading && (!hasMatchEventsToCheck || !disabledMatchdayLoading));

  const matchPickResolved = useMemo(() => {
    const source = FEED_DEMO ? buildDemoHomeMatchEvents(now) : (events ?? []);
    return pickHomeMatchCard(source, now, disabledMatchdayMatchIds);
  }, [events, now, disabledMatchdayMatchIds]);

  const matchPick = autoMatchdaySettingsReady ? matchPickResolved : null;

  const {
    posts: teamFeedPosts,
    loading: teamFeedLoading,
    ensuring: teamFeedEnsuring,
    refetch: refetchFeed,
  } = useTeamFeedPosts(teamSeasonId);
  const staffCanDeleteFeed = canStaffManageTeamFeed(backendRole, membershipRole);

  const eventById = useMemo(() => {
    const source = FEED_DEMO ? buildDemoHomeMatchEvents(now) : (events ?? []);
    const m = new Map<string, EventRow>();
    for (const e of source) m.set(e.id, e);
    return m;
  }, [events, now]);

  const loading = sessionLoading || evLoading;
  const feedBusy = teamFeedLoading || teamFeedEnsuring;
  const matchSectionReady = !loading && !feedBusy && autoMatchdaySettingsReady;
  const showContent = teamSeasonId || FEED_DEMO;

  const spieltagHintPick =
    matchPick && (matchPick.status === 'today' || matchPick.status === 'tomorrow') ? matchPick : null;
  const showNextMatchCompact = Boolean(matchPick && matchPick.status === 'next');

  const reviewPendingForEvent = (event: EventRow | undefined) =>
    Boolean(
      event?.match_id &&
        isMatchReviewPending({
          eventStatus: event.status,
          matchStatus: matchStatusById[event.match_id],
        }),
    );

  const visibleFeedPosts = useMemo(() => {
    const withoutDisabledMatchday = autoMatchdaySettingsReady
      ? teamFeedPosts.filter(
          (item) => !isMatchdayFeedPostHiddenByAutomation(item, disabledMatchdayMatchIds),
        )
      : teamFeedPosts.filter((item) => item.kind !== 'matchday');
    if (!spieltagHintPick) return withoutDisabledMatchday;
    return withoutDisabledMatchday.filter(
      (item) =>
        !isHomeHeroDuplicateFeedPost(
          item,
          spieltagHintPick.event.id,
          spieltagHintPick.event.match_id,
        ),
    );
  }, [teamFeedPosts, spieltagHintPick, disabledMatchdayMatchIds, autoMatchdaySettingsReady]);

  const showNoUpcomingMatchEmpty =
    matchSectionReady && !matchPick && visibleFeedPosts.length === 0;

  return (
    <PageShell
      variant="subtle"
      showAtmosphere={false}
      className="page app-home min-h-[60vh] w-full max-w-none min-w-0 overflow-x-hidden px-3 pb-[max(7rem,calc(5.75rem+env(safe-area-inset-bottom,0px)))] pt-4 sm:px-4 sm:pt-5 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-none space-y-3 md:max-w-3xl lg:max-w-4xl"
    >
      {loading && <p className="text-sm text-white/50">Laden…</p>}

      {!loading && !teamSeasonId && !FEED_DEMO && (
        <PremiumEmptyState
          variant="subtle"
          title={
            effectiveRole === 'fan'
              ? 'Dein Team wartet auf dich'
              : 'Team / Saison wählen'
          }
          description={
            effectiveRole === 'fan'
              ? 'Wähle dein Team, um Spieltage, Ergebnisse und Live-Updates zu sehen.'
              : 'Bitte Team / Saison wählen (z. B. unter „Mehr“).'
          }
        >
          {effectiveRole === 'fan' ? (
            <Link to="/app/fan-onboarding" className={cn(dsPrimaryCtaClass(), 'inline-flex min-h-[44px] items-center px-5')}>
              Team wählen
            </Link>
          ) : null}
        </PremiumEmptyState>
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

            {spieltagHintPick ? (
              <HomeSpieltagHintCard
                pick={spieltagHintPick}
                reviewPending={reviewPendingForEvent(spieltagHintPick.event)}
              />
            ) : null}

            <section className="min-w-0 space-y-3 pt-2 sm:pt-1" aria-label="Team-Feed">
              <SectionTitle variant="interactive" as="p" className="!text-[11px] sm:!text-xs">
                Im Feed
              </SectionTitle>
              {feedBusy ? (
                <p className="text-sm text-white/50">Feed wird geladen…</p>
              ) : visibleFeedPosts.length === 0 ? (
                <PremiumEmptyState
                  variant="subtle"
                  title="Noch keine Beiträge"
                  description="Am Spieltag erscheint der Matchday-Post. Trainer posten Fotos/Videos oben."
                />
              ) : (
                <div className="min-w-0 space-y-4">
                  {visibleFeedPosts.map((item) => (
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

            {!matchSectionReady ? (
              <p className="text-sm text-white/50">Spielplan wird geladen…</p>
            ) : showNextMatchCompact && matchPick ? (
              <section className="space-y-2" aria-label="Nächstes Spiel">
                <SectionTitle variant="subtle" as="p" className="!text-[11px] uppercase sm:!text-xs">
                  Nächstes Spiel
                </SectionTitle>
                <HomeUpcomingMatchCompact
                  pick={matchPick}
                  teamName={teamName}
                  reviewPending={reviewPendingForEvent(matchPick.event)}
                />
              </section>
            ) : showNoUpcomingMatchEmpty ? (
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
