import { useCallback, useEffect, useState } from 'react';
import { ensureMatchdayFeedPostForSeason } from '../lib/matchdayAutomation';
import { ensureRecentResultFeedPostsForSeason } from '../lib/ensureResultFeedPost';
import { ensureUpcomingMatchFeedPosts } from '../lib/ensureUpcomingMatchFeedPosts';
import { logMatchdayFeedSeasonContext } from '../lib/matchdayFeedDebug';
import {
  classifyTeamFeedPost,
  type ClassifiedFeedPost,
  type TeamFeedPostDbRow,
} from '../lib/matchdayFeedTypes';
import { buildEventStatusMap, sortClassifiedFeedPosts } from '../lib/feedPostPriority';
import { supabase } from '../lib/supabaseClient';

const FEED_SELECT =
  'id, team_season_id, team_id, event_id, post_kind, caption, payload, created_at, updated_at, created_by, media_type, media_url, thumbnail_url, duration_seconds';

async function fetchEventStatusMap(teamSeasonId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('events')
    .select('id, status')
    .eq('team_season_id', teamSeasonId);
  if (error) {
    console.warn('[useTeamFeedPosts] event status', error.message);
    return new Map();
  }
  return buildEventStatusMap((data ?? []) as { id: string; status: string | null }[]);
}

async function fetchPosts(teamSeasonId: string): Promise<{
  posts: ClassifiedFeedPost[];
  dbRowCount: number;
  parseDropped: number;
}> {
  const { data, error: err } = await supabase
    .from('team_feed_posts')
    .select(FEED_SELECT)
    .eq('team_season_id', teamSeasonId)
    .order('created_at', { ascending: false })
    .limit(48);

  if (err) {
    console.warn('[useTeamFeedPosts]', err.message ?? err);
    throw new Error(err.message ?? 'Feed konnte nicht geladen werden.');
  }

  const rows = (data ?? []) as TeamFeedPostDbRow[];
  const eventStatusById = await fetchEventStatusMap(teamSeasonId);
  const now = new Date();

  const mapped: ClassifiedFeedPost[] = [];
  for (const r of rows) {
    const c = classifyTeamFeedPost(r);
    if (c) mapped.push(c);
  }

  const sorted = sortClassifiedFeedPosts(mapped, eventStatusById, now);

  return {
    posts: sorted,
    dbRowCount: rows.length,
    parseDropped: rows.length - mapped.length,
  };
}

export function useTeamFeedPosts(teamSeasonId: string | null) {
  const [posts, setPosts] = useState<ClassifiedFeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!teamSeasonId) {
      setPosts([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await logMatchdayFeedSeasonContext(teamSeasonId);
      const ensureRes = await ensureMatchdayFeedPostForSeason(teamSeasonId);
      await ensureRecentResultFeedPostsForSeason(teamSeasonId);
      await ensureUpcomingMatchFeedPosts(teamSeasonId);
      console.info('[matchday] (4b) ensureMatchdayFeedPostForSeason Rückgabe =', {
        rpcOk: ensureRes.rpcOk,
        rpcError: ensureRes.rpcError,
        rpcPayload: ensureRes.rpcPayload,
      });
      const { posts: mapped, dbRowCount, parseDropped } = await fetchPosts(teamSeasonId);
      console.info('[matchday] (5) team_feed_posts nach SELECT:', {
        dbZeilen_roh: dbRowCount,
        klassifizierte_karten: mapped.length,
        verworfen: parseDropped,
      });
      console.info('[matchday] ========== Diagnose-Ende ==========');
      setPosts(mapped);
    } catch (e) {
      setPosts([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [teamSeasonId]);

  useEffect(() => {
    if (!teamSeasonId) {
      setPosts([]);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await logMatchdayFeedSeasonContext(teamSeasonId);
        if (cancelled) return;
        const ensureRes = await ensureMatchdayFeedPostForSeason(teamSeasonId);
        if (cancelled) return;
        await ensureRecentResultFeedPostsForSeason(teamSeasonId);
        if (cancelled) return;
        await ensureUpcomingMatchFeedPosts(teamSeasonId);
        if (cancelled) return;
        console.info('[matchday] (4b) ensureMatchdayFeedPostForSeason Rückgabe =', {
          rpcOk: ensureRes.rpcOk,
          rpcError: ensureRes.rpcError,
          rpcPayload: ensureRes.rpcPayload,
        });
        const { posts: mapped, dbRowCount, parseDropped } = await fetchPosts(teamSeasonId);
        if (cancelled) return;
        console.info('[matchday] (5) team_feed_posts nach SELECT:', {
          dbZeilen_roh: dbRowCount,
          klassifizierte_karten: mapped.length,
          verworfen: parseDropped,
        });
        console.info('[matchday] ========== Diagnose-Ende ==========');
        setPosts(mapped);
      } catch (e) {
        if (!cancelled) {
          setPosts([]);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamSeasonId]);

  return { posts, loading, error, refetch };
}
