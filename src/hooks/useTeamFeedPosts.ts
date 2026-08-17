import { useCallback, useEffect, useState } from 'react';
import { ensureEventFeedPostsForSeason } from '../lib/ensureEventFeedPosts';
import { ensureMatchdayFeedPostsForSeason } from '../lib/ensureMatchdayFeedPosts';
import { ensureRecentLiveFeedPostsForSeason } from '../lib/ensureLiveFeedPost';
import { ensureRecentResultFeedPostsForSeason } from '../lib/ensureResultFeedPost';
import { ensureLineupFeedPostsForSeason } from '../lib/ensureLineupFeedPost';
import { lineupFeedDevLog } from '../lib/lineupFeedDebug';
import { ensureUpcomingMatchFeedPosts } from '../lib/ensureUpcomingMatchFeedPosts';
import { logMatchdayFeedSeasonContext } from '../lib/matchdayFeedDebug';
import {
  classifyTeamFeedPost,
  type ClassifiedFeedPost,
  type TeamFeedPostDbRow,
} from '../lib/matchdayFeedTypes';
import { buildEventStatusMap, isFeedPostVisibleInHomeFeed } from '../lib/feedPostPriority';
import { supabase } from '../lib/supabaseClient';

const FEED_SELECT =
  'id, team_season_id, team_id, event_id, post_kind, caption, payload, created_at, updated_at, created_by, media_type, media_url, thumbnail_url, duration_seconds, cta_url, cta_label';

/** Aktive Saison: vollständiger aktueller Feed (kein History-Limit). */
export const ACTIVE_FEED_LIMIT = 48;
/** Chronik: erste Seite älterer Saisons. */
export const HISTORY_FEED_PAGE_SIZE = 15;
/** Home darf nicht endlos auf „Feed wird geladen …“ stehen bleiben. */
export const FEED_LOAD_TIMEOUT_MS = 8000;
const FEED_LOAD_TIMEOUT_MESSAGE = 'Feed konnte nicht geladen werden. Bitte erneut versuchen.';

function sortChronological(items: ClassifiedFeedPost[]): ClassifiedFeedPost[] {
  return [...items].sort((a, b) => {
    const ta = a.post.created_at ? new Date(a.post.created_at).getTime() : 0;
    const tb = b.post.created_at ? new Date(b.post.created_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return String(b.post.id).localeCompare(String(a.post.id));
  });
}

function mapVisiblePosts(
  rows: TeamFeedPostDbRow[],
  eventStatusById: Map<string, string>,
  now: Date,
  opts?: { chronicle?: boolean },
): { posts: ClassifiedFeedPost[]; parseDropped: number } {
  const mapped: ClassifiedFeedPost[] = [];
  for (const r of rows) {
    if (!isFeedPostVisibleInHomeFeed(r, eventStatusById, now, opts)) continue;
    const c = classifyTeamFeedPost(r);
    if (c) mapped.push(c);
  }
  return { posts: sortChronological(mapped), parseDropped: rows.length - mapped.length };
}

async function fetchEventStatusMapForSeasons(teamSeasonIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(teamSeasonIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('events').select('id, status').in('team_season_id', ids);
  if (error) {
    console.warn('[useTeamFeedPosts] event status', error.message);
    return new Map();
  }
  return buildEventStatusMap((data ?? []) as { id: string; status: string | null }[]);
}

/** Aktive / View-Saison robust: primär team_season_id. */
async function fetchActiveSeasonPosts(opts: {
  teamSeasonId: string;
  teamId: string | null;
  chronicleView?: boolean;
}): Promise<{ posts: ClassifiedFeedPost[]; dbRowCount: number; parseDropped: number }> {
  const { data, error } = await supabase
    .from('team_feed_posts')
    .select(FEED_SELECT)
    .eq('team_season_id', opts.teamSeasonId)
    .order('created_at', { ascending: false })
    .limit(ACTIVE_FEED_LIMIT);

  if (error) {
    console.warn('[useTeamFeedPosts] active season', error.message ?? error);
    throw new Error(error.message ?? 'Aktueller Feed konnte nicht geladen werden.');
  }

  let rows = (data ?? []) as TeamFeedPostDbRow[];

  if (rows.length === 0 && opts.teamId) {
    const { data: byTeam, error: byTeamErr } = await supabase
      .from('team_feed_posts')
      .select(FEED_SELECT)
      .eq('team_id', opts.teamId)
      .eq('team_season_id', opts.teamSeasonId)
      .order('created_at', { ascending: false })
      .limit(ACTIVE_FEED_LIMIT);
    if (!byTeamErr && byTeam) rows = byTeam as TeamFeedPostDbRow[];
  }

  const eventStatusById = await fetchEventStatusMapForSeasons([opts.teamSeasonId]);
  const { posts, parseDropped } = mapVisiblePosts(rows, eventStatusById, new Date(), {
    chronicle: opts.chronicleView === true,
  });
  return { posts, dbRowCount: rows.length, parseDropped };
}

async function fetchHistoricPostsPage(opts: {
  teamId: string;
  activeTeamSeasonId: string;
  offset: number;
  limit: number;
}): Promise<{
  posts: ClassifiedFeedPost[];
  dbRowCount: number;
  parseDropped: number;
  hasMore: boolean;
}> {
  const { data, error } = await supabase
    .from('team_feed_posts')
    .select(FEED_SELECT)
    .eq('team_id', opts.teamId)
    .neq('team_season_id', opts.activeTeamSeasonId)
    .order('created_at', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (error) {
    console.warn('[useTeamFeedPosts] history', error.message ?? error);
    throw new Error(error.message ?? 'Chronik konnte nicht geladen werden.');
  }

  const rows = ((data ?? []) as TeamFeedPostDbRow[]).filter((r) => {
    const sid = (r.team_season_id ?? '').trim();
    // Ohne team_season_id nicht blind historisch einordnen
    return Boolean(sid) && sid !== opts.activeTeamSeasonId;
  });

  const seasonIds = rows.map((r) => r.team_season_id).filter(Boolean);
  const eventStatusById = await fetchEventStatusMapForSeasons(seasonIds);
  const { posts, parseDropped } = mapVisiblePosts(rows, eventStatusById, new Date(), {
    chronicle: true,
  });

  return {
    posts,
    dbRowCount: (data ?? []).length,
    parseDropped,
    hasMore: (data ?? []).length >= opts.limit,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function runFeedEnsures(teamSeasonId: string): Promise<void> {
  await Promise.all([
    ensureMatchdayFeedPostsForSeason(teamSeasonId).catch((e) => {
      console.warn('[useTeamFeedPosts] ensureMatchdayFeedPostsForSeason failed', e);
    }),
    ensureUpcomingMatchFeedPosts(teamSeasonId).catch((e) => {
      console.warn('[useTeamFeedPosts] ensureUpcomingMatchFeedPosts failed', e);
    }),
    ensureEventFeedPostsForSeason(teamSeasonId).catch((e) => {
      console.warn('[useTeamFeedPosts] ensureEventFeedPostsForSeason failed', e);
    }),
    ensureLineupFeedPostsForSeason(teamSeasonId).catch((e) => {
      console.warn('[useTeamFeedPosts] ensureLineupFeedPostsForSeason failed', e);
    }),
    ensureRecentLiveFeedPostsForSeason(teamSeasonId).catch((e) => {
      console.warn('[useTeamFeedPosts] ensureRecentLiveFeedPostsForSeason failed', e);
    }),
    ensureRecentResultFeedPostsForSeason(teamSeasonId).catch((e) => {
      console.warn('[useTeamFeedPosts] ensureRecentResultFeedPostsForSeason failed', e);
    }),
  ]);
}

/**
 * Home-Feed: Lesesaison + Team-Chronik (andere Saisons).
 * Ensures nur für beschreibbare Work-Seasons (nicht Archiv).
 */
export function useTeamFeedPosts(
  teamSeasonId: string | null,
  teamId: string | null = null,
  opts?: { skipEnsures?: boolean; chronicleView?: boolean },
) {
  const [activePosts, setActivePosts] = useState<ClassifiedFeedPost[]>([]);
  const [historicPosts, setHistoricPosts] = useState<ClassifiedFeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistoric, setHasMoreHistoric] = useState(false);
  const [historicOffset, setHistoricOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const skipEnsures = opts?.skipEnsures === true;
  const chronicleView = opts?.chronicleView === true;

  const loadAll = useCallback(async () => {
    if (!teamSeasonId) {
      setActivePosts([]);
      setHistoricPosts([]);
      setHasMoreHistoric(false);
      setHistoricOffset(0);
      setError(null);
      setEnsuring(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await logMatchdayFeedSeasonContext(teamSeasonId);
      const active = await withTimeout(
        fetchActiveSeasonPosts({
          teamSeasonId,
          teamId,
          chronicleView,
        }),
        FEED_LOAD_TIMEOUT_MS,
        FEED_LOAD_TIMEOUT_MESSAGE,
      );
      console.info('[matchday] (5a) active season feed:', {
        teamSeasonId,
        dbZeilen_roh: active.dbRowCount,
        karten: active.posts.length,
        verworfen: active.parseDropped,
      });
      setActivePosts(active.posts);

      if (teamId) {
        const hist = await fetchHistoricPostsPage({
          teamId,
          activeTeamSeasonId: teamSeasonId,
          offset: 0,
          limit: HISTORY_FEED_PAGE_SIZE,
        });
        console.info('[matchday] (5b) historic feed:', {
          teamId,
          dbZeilen_roh: hist.dbRowCount,
          karten: hist.posts.length,
          verworfen: hist.parseDropped,
        });
        setHistoricPosts(hist.posts);
        setHistoricOffset(hist.dbRowCount);
        setHasMoreHistoric(hist.hasMore);
      } else {
        setHistoricPosts([]);
        setHistoricOffset(0);
        setHasMoreHistoric(false);
      }
      setLoading(false);

      if (!skipEnsures) {
        setEnsuring(true);
        try {
          await runFeedEnsures(teamSeasonId);
          const refreshed = await fetchActiveSeasonPosts({
            teamSeasonId,
            teamId,
            chronicleView,
          });
          setActivePosts(refreshed.posts);
        } catch (e) {
          console.warn('[useTeamFeedPosts] deferred ensures failed', e);
        } finally {
          setEnsuring(false);
        }
      }
    } catch (e) {
      setActivePosts([]);
      setHistoricPosts([]);
      setHasMoreHistoric(false);
      setHistoricOffset(0);
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
      setEnsuring(false);
    }
  }, [teamSeasonId, teamId, skipEnsures, chronicleView]);

  const loadMoreHistoric = useCallback(async () => {
    if (!teamSeasonId || !teamId || loadingMore || !hasMoreHistoric) return;
    setLoadingMore(true);
    try {
      const hist = await fetchHistoricPostsPage({
        teamId,
        activeTeamSeasonId: teamSeasonId,
        offset: historicOffset,
        limit: HISTORY_FEED_PAGE_SIZE,
      });
      setHistoricPosts((prev) => {
        const seen = new Set(prev.map((p) => p.post.id));
        const merged = [...prev];
        for (const item of hist.posts) {
          if (!seen.has(item.post.id)) merged.push(item);
        }
        return sortChronological(merged);
      });
      setHistoricOffset((prev) => prev + hist.dbRowCount);
      setHasMoreHistoric(hist.hasMore);
    } catch (e) {
      console.warn('[useTeamFeedPosts] loadMoreHistoric', e);
    } finally {
      setLoadingMore(false);
    }
  }, [teamSeasonId, teamId, loadingMore, hasMoreHistoric, historicOffset]);

  useEffect(() => {
    lineupFeedDevLog('[LINEUP FEED] USE EFFECT FIRED', { teamSeasonId, teamId });
    let cancelled = false;
    (async () => {
      if (!teamSeasonId) {
        setActivePosts([]);
        setHistoricPosts([]);
        setHasMoreHistoric(false);
        setHistoricOffset(0);
        setError(null);
        setEnsuring(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await logMatchdayFeedSeasonContext(teamSeasonId);
        if (cancelled) return;
        const active = await withTimeout(
          fetchActiveSeasonPosts({ teamSeasonId, teamId, chronicleView }),
          FEED_LOAD_TIMEOUT_MS,
          FEED_LOAD_TIMEOUT_MESSAGE,
        );
        if (cancelled) return;
        setActivePosts(active.posts);

        if (teamId) {
          const hist = await fetchHistoricPostsPage({
            teamId,
            activeTeamSeasonId: teamSeasonId,
            offset: 0,
            limit: HISTORY_FEED_PAGE_SIZE,
          });
          if (cancelled) return;
          setHistoricPosts(hist.posts);
          setHistoricOffset(hist.dbRowCount);
          setHasMoreHistoric(hist.hasMore);
        } else {
          setHistoricPosts([]);
          setHistoricOffset(0);
          setHasMoreHistoric(false);
        }
        if (!cancelled) setLoading(false);

        if (!skipEnsures) {
          if (!cancelled) setEnsuring(true);
          try {
            await runFeedEnsures(teamSeasonId);
            if (cancelled) return;
            const refreshed = await fetchActiveSeasonPosts({ teamSeasonId, teamId, chronicleView });
            if (cancelled) return;
            setActivePosts(refreshed.posts);
          } catch (e) {
            console.warn('[useTeamFeedPosts] deferred ensures failed', e);
          } finally {
            if (!cancelled) setEnsuring(false);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setActivePosts([]);
          setHistoricPosts([]);
          setHasMoreHistoric(false);
          setHistoricOffset(0);
          setError(e instanceof Error ? e.message : String(e));
          setEnsuring(false);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId, teamId, skipEnsures, chronicleView]);

  /** Rückwärtskompatibel: alle geladenen Posts (active + historic). */
  const posts = [...activePosts, ...historicPosts];

  return {
    posts,
    activePosts,
    historicPosts,
    loading,
    ensuring,
    loadingMore,
    hasMore: hasMoreHistoric,
    hasMoreHistoric,
    error,
    refetch: loadAll,
    loadMore: loadMoreHistoric,
    loadMoreHistoric,
  };
}
