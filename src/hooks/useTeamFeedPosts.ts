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
  'id, team_season_id, team_id, event_id, post_kind, caption, payload, created_at, updated_at, created_by, media_type, media_url, thumbnail_url, duration_seconds';

/** Aktive Saison: vollständiger aktueller Feed (kein History-Limit). */
export const ACTIVE_FEED_LIMIT = 48;
/** Chronik: erste Seite älterer Saisons. */
export const HISTORY_FEED_PAGE_SIZE = 15;

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
): { posts: ClassifiedFeedPost[]; parseDropped: number } {
  const mapped: ClassifiedFeedPost[] = [];
  for (const r of rows) {
    if (!isFeedPostVisibleInHomeFeed(r, eventStatusById, now)) continue;
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

/** Aktive Saison robust: primär team_season_id, Fallback team_id+season falls team_id drift. */
async function fetchActiveSeasonPosts(opts: {
  teamSeasonId: string;
  teamId: string | null;
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

  // Falls aktive Posts team_id NULL / drift haben, trotzdem by season laden (oben).
  // Zusätzlich: Posts mit korrekter team_id aber ggf. anderer season-id? nicht nötig.
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
  const { posts, parseDropped } = mapVisiblePosts(rows, eventStatusById, new Date());
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
  const { posts, parseDropped } = mapVisiblePosts(rows, eventStatusById, new Date());

  return {
    posts,
    dbRowCount: (data ?? []).length,
    parseDropped,
    hasMore: (data ?? []).length >= opts.limit,
  };
}

async function runFeedEnsures(teamSeasonId: string): Promise<void> {
  try {
    await ensureMatchdayFeedPostsForSeason(teamSeasonId);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureMatchdayFeedPostsForSeason failed', e);
  }

  try {
    await ensureUpcomingMatchFeedPosts(teamSeasonId);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureUpcomingMatchFeedPosts failed', e);
  }

  try {
    await ensureEventFeedPostsForSeason(teamSeasonId);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureEventFeedPostsForSeason failed', e);
  }

  try {
    await ensureLineupFeedPostsForSeason(teamSeasonId);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureLineupFeedPostsForSeason failed', e);
  }

  try {
    await ensureRecentLiveFeedPostsForSeason(teamSeasonId);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureRecentLiveFeedPostsForSeason failed', e);
  }

  try {
    await ensureRecentResultFeedPostsForSeason(teamSeasonId);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureRecentResultFeedPostsForSeason failed', e);
  }
}

/**
 * Home-Feed: aktive Saison + separate Team-Chronik (ältere Saisons).
 * Ensures nur für die aktive Work-Season.
 */
export function useTeamFeedPosts(teamSeasonId: string | null, teamId: string | null = null) {
  const [activePosts, setActivePosts] = useState<ClassifiedFeedPost[]>([]);
  const [historicPosts, setHistoricPosts] = useState<ClassifiedFeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistoric, setHasMoreHistoric] = useState(false);
  const [historicOffset, setHistoricOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!teamSeasonId) {
      setActivePosts([]);
      setHistoricPosts([]);
      setHasMoreHistoric(false);
      setHistoricOffset(0);
      setError(null);
      setEnsuring(false);
      return;
    }

    setLoading(true);
    setEnsuring(true);
    setError(null);
    try {
      await logMatchdayFeedSeasonContext(teamSeasonId);
      await runFeedEnsures(teamSeasonId);
      setEnsuring(false);

      const active = await fetchActiveSeasonPosts({
        teamSeasonId,
        teamId,
      });
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
    } catch (e) {
      setActivePosts([]);
      setHistoricPosts([]);
      setHasMoreHistoric(false);
      setHistoricOffset(0);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnsuring(false);
      setLoading(false);
    }
  }, [teamSeasonId, teamId]);

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
      setEnsuring(true);
      setError(null);
      try {
        await logMatchdayFeedSeasonContext(teamSeasonId);
        if (cancelled) return;
        await runFeedEnsures(teamSeasonId);
        if (cancelled) return;
        setEnsuring(false);

        const active = await fetchActiveSeasonPosts({ teamSeasonId, teamId });
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
      } catch (e) {
        if (!cancelled) {
          setActivePosts([]);
          setHistoricPosts([]);
          setHasMoreHistoric(false);
          setHistoricOffset(0);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setEnsuring(false);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId, teamId]);

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
