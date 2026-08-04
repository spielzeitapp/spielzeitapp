import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { useAuth } from '../../auth/AuthProvider';
import { useEvents } from '../../hooks/useEvents';
import { useActiveTeamSeason } from '../../hooks/useActiveTeamSeason';
import { resolveTeamSeasonLabelParts } from '../../lib/seasonLifecycle';
import {
  buildDemoHomeMatchEvents,
  pickHomeSportingCard,
} from './homeFeedBuilder';
import { useTeamFeedPosts } from '../../hooks/useTeamFeedPosts';
import { HomeFeedPostRenderer } from '../../components/feed/HomeFeedPostRenderer';
import type { ClassifiedFeedPost } from '../../lib/matchdayFeedTypes';
import type { EventRow } from '../../hooks/useEvents';
import { HomeFeedComposer } from './HomeFeedComposer';
import { HomeUpcomingMatchCompact } from './HomeUpcomingMatchCompact';
import { HomeUpcomingTournamentCompact } from './HomeUpcomingTournamentCompact';
import { HomeSpieltagHintCard } from './HomeSpieltagHintCard';
import { canStaffManageTeamFeed } from '../../lib/feedStaffRole';
import { isHomeHeroDuplicateFeedPost } from '../../lib/feedPostPriority';
import {
  buildFeedSeasonDisplayMeta,
  type FeedSeasonDisplayMeta,
} from '../../lib/feedSeasonLabel';
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

function filterVisibleFeedPosts(
  posts: ClassifiedFeedPost[],
  opts: {
    autoMatchdaySettingsReady: boolean;
    disabledMatchdayMatchIds: Set<string>;
    spieltagHintPick: { event: EventRow; status: string } | null;
  },
): ClassifiedFeedPost[] {
  const withoutDisabledMatchday = opts.autoMatchdaySettingsReady
    ? posts.filter((item) => !isMatchdayFeedPostHiddenByAutomation(item, opts.disabledMatchdayMatchIds))
    : posts.filter((item) => item.kind !== 'matchday');
  if (!opts.spieltagHintPick) return withoutDisabledMatchday;
  return withoutDisabledMatchday.filter(
    (item) =>
      !isHomeHeroDuplicateFeedPost(
        item,
        opts.spieltagHintPick!.event.id,
        opts.spieltagHintPick!.event.match_id,
      ),
  );
}

export const HomePage: React.FC = () => {
  const {
    selectedTeamSeasonId: teamSeasonId,
    loading: sessionLoading,
    selectedTeamSeason,
    teamSeasons,
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

  const seasonMetaById = useMemo(() => {
    const map = new Map<string, FeedSeasonDisplayMeta>();
    for (const ts of teamSeasons) {
      if (!ts.id) continue;
      if (teamId && String(ts.team?.id ?? ts.team_id ?? '') !== teamId) continue;
      map.set(
        ts.id,
        buildFeedSeasonDisplayMeta(ts.id, {
          displayName: ts.display_name,
          ageGroup: ts.age_group,
          teamName: ts.team?.name,
          seasonName: ts.season?.name,
          status: ts.status,
        }),
      );
    }
    return map;
  }, [teamSeasons, teamId]);

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

  const sportingPickResolved = useMemo(() => {
    const source = FEED_DEMO ? buildDemoHomeMatchEvents(now) : (events ?? []);
    return pickHomeSportingCard(source, now, disabledMatchdayMatchIds);
  }, [events, now, disabledMatchdayMatchIds]);

  const sportingPick = autoMatchdaySettingsReady ? sportingPickResolved : null;
  const matchPick =
    sportingPick?.sportingKind === 'match'
      ? { event: sportingPick.event, status: sportingPick.status }
      : null;

  const {
    activePosts,
    historicPosts,
    loading: teamFeedLoading,
    ensuring: teamFeedEnsuring,
    loadingMore: teamFeedLoadingMore,
    hasMoreHistoric,
    refetch: refetchFeed,
    loadMoreHistoric,
  } = useTeamFeedPosts(teamSeasonId, teamId || null);
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
  const showTournamentCompact = Boolean(sportingPick?.sportingKind === 'tournament');

  const reviewPendingForEvent = (event: EventRow | undefined) =>
    Boolean(
      event?.match_id &&
        isMatchReviewPending({
          eventStatus: event.status,
          matchStatus: matchStatusById[event.match_id],
        }),
    );

  const visibleActivePosts = useMemo(
    () =>
      filterVisibleFeedPosts(activePosts, {
        autoMatchdaySettingsReady,
        disabledMatchdayMatchIds,
        spieltagHintPick,
      }),
    [activePosts, spieltagHintPick, disabledMatchdayMatchIds, autoMatchdaySettingsReady],
  );

  const visibleHistoricPosts = useMemo(
    () =>
      filterVisibleFeedPosts(historicPosts, {
        autoMatchdaySettingsReady,
        disabledMatchdayMatchIds,
        spieltagHintPick: null,
      }),
    [historicPosts, disabledMatchdayMatchIds, autoMatchdaySettingsReady],
  );

  const showNoUpcomingMatchEmpty =
    matchSectionReady && !sportingPick && visibleActivePosts.length === 0;

  const activeSeasonMeta = teamSeasonId ? seasonMetaById.get(teamSeasonId) : undefined;
  const activeTeamLabel = activeSeasonMeta?.teamLabel || teamName;

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

            <section className="min-w-0 space-y-3 pt-2 sm:pt-1" aria-label="Aktueller Team-Feed">
              <SectionTitle variant="interactive" as="p" className="!text-[11px] sm:!text-xs">
                Im Feed
              </SectionTitle>
              {feedBusy ? (
                <p className="text-sm text-white/50">Feed wird geladen…</p>
              ) : visibleActivePosts.length === 0 ? (
                <PremiumEmptyState
                  variant="subtle"
                  title="Noch keine Beiträge"
                  description="Am Spieltag erscheint der Matchday-Post. Trainer posten Fotos/Videos oben."
                />
              ) : (
                <div className="min-w-0 space-y-4">
                  {visibleActivePosts.map((item) => (
                    <HomeFeedPostRenderer
                      key={item.post.id}
                      item={item}
                      eventById={eventById}
                      teamLabel={activeTeamLabel}
                      seasonLabel={null}
                      staffCanDelete={staffCanDeleteFeed}
                      onFeedPostDeleted={() => void refetchFeed()}
                    />
                  ))}
                </div>
              )}
            </section>

            {!matchSectionReady ? (
              <p className="text-sm text-white/50">Spielplan wird geladen…</p>
            ) : showTournamentCompact && sportingPick ? (
              <section className="space-y-2" aria-label="Nächstes Turnier">
                <SectionTitle variant="subtle" as="p" className="!text-[11px] uppercase sm:!text-xs">
                  Nächstes Turnier
                </SectionTitle>
                <HomeUpcomingTournamentCompact pick={sportingPick} />
              </section>
            ) : showNextMatchCompact && matchPick ? (
              <section className="space-y-2" aria-label="Nächstes Spiel">
                <SectionTitle variant="subtle" as="p" className="!text-[11px] uppercase sm:!text-xs">
                  Nächstes Spiel
                </SectionTitle>
                <HomeUpcomingMatchCompact
                  pick={matchPick}
                  teamName={activeTeamLabel}
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

            {!feedBusy && visibleHistoricPosts.length > 0 ? (
              <section className="min-w-0 space-y-3 pt-3" aria-label="Saison-Chronik">
                <SectionTitle variant="interactive" as="p" className="!text-[11px] sm:!text-xs">
                  Chronik
                </SectionTitle>
                <div className="min-w-0 space-y-4">
                  {visibleHistoricPosts.map((item, index) => {
                    const seasonId = (item.post.team_season_id ?? '').trim();
                    const meta = seasonId ? seasonMetaById.get(seasonId) : undefined;
                    const seasonBadge = meta?.seasonBadge ?? null;
                    const historicTeamLabel = meta?.teamLabel || 'Team';
                    const prevSeasonId =
                      index > 0
                        ? (visibleHistoricPosts[index - 1]?.post.team_season_id ?? '').trim()
                        : '';
                    const showSeasonDivider =
                      Boolean(seasonBadge) && Boolean(seasonId) && seasonId !== prevSeasonId;
                    return (
                      <React.Fragment key={item.post.id}>
                        {showSeasonDivider ? (
                          <div
                            className="flex items-center gap-2 pt-1"
                            role="separator"
                            aria-label={`Saison ${seasonBadge}`}
                          >
                            <div className="h-px flex-1 bg-white/10" />
                            <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                              {seasonBadge}
                            </p>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                        ) : null}
                        <HomeFeedPostRenderer
                          item={item}
                          eventById={eventById}
                          teamLabel={historicTeamLabel}
                          seasonLabel={seasonBadge}
                          staffCanDelete={staffCanDeleteFeed}
                          onFeedPostDeleted={() => void refetchFeed()}
                        />
                      </React.Fragment>
                    );
                  })}
                  {hasMoreHistoric ? (
                    <button
                      type="button"
                      onClick={() => void loadMoreHistoric()}
                      disabled={teamFeedLoadingMore}
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-[13px] font-semibold text-white/80 transition hover:bg-white/[0.07] disabled:opacity-50"
                    >
                      {teamFeedLoadingMore ? 'Laden…' : 'Ältere Beiträge laden'}
                    </button>
                  ) : null}
                </div>
              </section>
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
