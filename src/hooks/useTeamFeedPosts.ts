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

/** Erste Seite / „Mehr laden“ – pagination-fähig. */
export const TEAM_FEED_PAGE_SIZE = 30;

function sortChronological(items: ClassifiedFeedPost[]): ClassifiedFeedPost[] {
  return [...items].sort((a, b) => {
    const ta = a.post.created_at ? new Date(a.post.created_at).getTime() : 0;
    const tb = b.post.created_at ? new Date(b.post.created_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return String(b.post.id).localeCompare(String(a.post.id));
  });
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

async function resolveTeamSeasonIdsForTeam(teamId: string, preferredSeasonId: string | null): Promise<string[]> {
  const { data, error } = await supabase.from('team_seasons').select('id').eq('team_id', teamId);
  if (error) {
    console.warn('[useTeamFeedPosts] team_seasons for team', error.message);
    return preferredSeasonId ? [preferredSeasonId] : [];
  }
  const ids = (data ?? [])
    .map((r) => String((r as { id?: string }).id ?? '').trim())
    .filter(Boolean);
  if (ids.length > 0) return ids;
  return preferredSeasonId ? [preferredSeasonId] : [];
}

async function fetchPostsPage(opts: {
  teamId: string;
  teamSeasonIds: string[];
  offset: number;
  limit: number;
}): Promise<{
  posts: ClassifiedFeedPost[];
  dbRowCount: number;
  parseDropped: number;
  hasMore: boolean;
}> {
  const { data, error: err } = await supabase
    .from('team_feed_posts')
    .select(FEED_SELECT)
    .eq('team_id', opts.teamId)
    .order('created_at', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (err) {
    console.warn('[useTeamFeedPosts]', err.message ?? err);
    throw new Error(err.message ?? 'Feed konnte nicht geladen werden.');
  }

  const rows = (data ?? []) as TeamFeedPostDbRow[];
  const seasonIdsFromRows = rows.map((r) => r.team_season_id).filter(Boolean);
  const eventStatusById = await fetchEventStatusMapForSeasons([
    ...opts.teamSeasonIds,
    ...seasonIdsFromRows,
  ]);
  const now = new Date();

  const mapped: ClassifiedFeedPost[] = [];
  for (const r of rows) {
    if (!isFeedPostVisibleInHomeFeed(r, eventStatusById, now)) continue;
    const c = classifyTeamFeedPost(r);
    if (c) mapped.push(c);
  }

  return {
    posts: sortChronological(mapped),
    dbRowCount: rows.length,
    parseDropped: rows.length - mapped.length,
    hasMore: rows.length >= opts.limit,
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
 * Team-Chronik: alle Feed-Posts des Teams (über Saisons), neueste zuerst.
 * Auto-Ensures laufen nur für die aktive Work-Season.
 */
export function useTeamFeedPosts(teamSeasonId: string | null, teamId: string | null = null) {
  const [posts, setPosts] = useState<ClassifiedFeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [ensuring, setEnsuring] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  /** Roh-Offset in team_feed_posts (nicht gefilterte Kartenanzahl). */
  const [nextOffset, setNextOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!teamSeasonId || !teamId) {
      setPosts([]);
      setHasMore(false);
      setNextOffset(0);
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
      const seasonIds = await resolveTeamSeasonIdsForTeam(teamId, teamSeasonId);
      const { posts: mapped, dbRowCount, parseDropped, hasMore: more } = await fetchPostsPage({
        teamId,
        teamSeasonIds: seasonIds,
        offset: 0,
        limit: TEAM_FEED_PAGE_SIZE,
      });
      console.info('[matchday] (5) team_feed_posts nach SELECT (team chronicle):', {
        teamId,
        dbZeilen_roh: dbRowCount,
        klassifizierte_karten: mapped.length,
        verworfen: parseDropped,
      });
      setPosts(mapped);
      setNextOffset(dbRowCount);
      setHasMore(more);
    } catch (e) {
      setPosts([]);
      setHasMore(false);
      setNextOffset(0);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnsuring(false);
      setLoading(false);
    }
  }, [teamSeasonId, teamId]);

  const loadMore = useCallback(async () => {
    if (!teamSeasonId || !teamId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const seasonIds = await resolveTeamSeasonIdsForTeam(teamId, teamSeasonId);
      const { posts: mapped, dbRowCount, hasMore: more } = await fetchPostsPage({
        teamId,
        teamSeasonIds: seasonIds,
        offset: nextOffset,
        limit: TEAM_FEED_PAGE_SIZE,
      });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.post.id));
        const merged = [...prev];
        for (const item of mapped) {
          if (!seen.has(item.post.id)) merged.push(item);
        }
        return sortChronological(merged);
      });
      setNextOffset((prev) => prev + dbRowCount);
      setHasMore(more);
    } catch (e) {
      console.warn('[useTeamFeedPosts] loadMore', e);
    } finally {
      setLoadingMore(false);
    }
  }, [teamSeasonId, teamId, loadingMore, hasMore, nextOffset]);

  useEffect(() => {
    lineupFeedDevLog('[LINEUP FEED] USE EFFECT FIRED', { teamSeasonId, teamId });
    if (!teamSeasonId || !teamId) {
      setPosts([]);
      setHasMore(false);
      setNextOffset(0);
      setError(null);
      setEnsuring(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setEnsuring(true);
      setError(null);
      try {
        await logMatchdayFeedSeasonContext(teamSeasonId);
        if (cancelled) return;
        await runFeedEnsures(teamSeasonId);
        if (cancelled) return;
        setEnsuring(false);
        const seasonIds = await resolveTeamSeasonIdsForTeam(teamId, teamSeasonId);
        const { posts: mapped, dbRowCount, parseDropped, hasMore: more } = await fetchPostsPage({
          teamId,
          teamSeasonIds: seasonIds,
          offset: 0,
          limit: TEAM_FEED_PAGE_SIZE,
        });
        if (cancelled) return;
        console.info('[matchday] (5) team_feed_posts nach SELECT (team chronicle):', {
          teamId,
          dbZeilen_roh: dbRowCount,
          klassifizierte_karten: mapped.length,
          verworfen: parseDropped,
        });
        setPosts(mapped);
        setNextOffset(dbRowCount);
        setHasMore(more);
      } catch (e) {
        if (!cancelled) {
          setPosts([]);
          setHasMore(false);
          setNextOffset(0);
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

  return { posts, loading, ensuring, loadingMore, hasMore, error, refetch, loadMore };
}
