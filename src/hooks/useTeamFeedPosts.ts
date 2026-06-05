import { useCallback, useEffect, useState } from 'react';
import { ensureMatchdayFeedPostsForSeason } from '../lib/ensureMatchdayFeedPosts';
import { ensureRecentLiveFeedPostsForSeason } from '../lib/ensureLiveFeedPost';
import { ensureRecentResultFeedPostsForSeason } from '../lib/ensureResultFeedPost';
import { ensureLineupFeedPostsForSeason } from '../lib/ensureLineupFeedPost';
import { ensureUpcomingMatchFeedPosts } from '../lib/ensureUpcomingMatchFeedPosts';
import { logMatchdayFeedSeasonContext } from '../lib/matchdayFeedDebug';
import {
  classifyTeamFeedPost,
  type ClassifiedFeedPost,
  type TeamFeedPostDbRow,
} from '../lib/matchdayFeedTypes';
import { buildEventStatusMap, isMatchdayAutoPostActiveForViennaDay, sortTeamFeedPosts } from '../lib/feedPostPriority';
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
    if (!isMatchdayAutoPostActiveForViennaDay(r, now)) continue;
    const c = classifyTeamFeedPost(r);
    if (c) mapped.push(c);
  }

  const sorted = sortTeamFeedPosts(mapped, eventStatusById, now);

  return {
    posts: sorted,
    dbRowCount: rows.length,
    parseDropped: rows.length - mapped.length,
  };
}

async function runFeedEnsures(teamSeasonId: string): Promise<void> {
  console.log('[LINEUP FEED] RUN FEED ENSURES START', { teamSeasonId });

  console.log('[LINEUP FEED] BEFORE MATCHDAY');
  try {
    const matchdayRes = await ensureMatchdayFeedPostsForSeason(teamSeasonId);
    console.info('[matchdayFeed] ensureMatchdayFeedPostsForSeason', matchdayRes);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureMatchdayFeedPostsForSeason failed', e);
  }

  console.log('[LINEUP FEED] BEFORE UPCOMING');
  try {
    await ensureUpcomingMatchFeedPosts(teamSeasonId);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureUpcomingMatchFeedPosts failed', e);
  }

  console.log('[LINEUP FEED] BEFORE LINEUP');
  console.log('[LINEUP FEED] ensureLineupFeedPostsForSeason invoked from useTeamFeedPosts', {
    teamSeasonId,
  });
  try {
    const lineupRes = await ensureLineupFeedPostsForSeason(teamSeasonId);
    console.log('[LINEUP FEED] ensureLineupFeedPostsForSeason result from useTeamFeedPosts', lineupRes);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureLineupFeedPostsForSeason failed', e);
  }

  console.log('[LINEUP FEED] BEFORE LIVE');
  try {
    await ensureRecentLiveFeedPostsForSeason(teamSeasonId);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureRecentLiveFeedPostsForSeason failed', e);
  }

  console.log('[LINEUP FEED] BEFORE RESULT');
  try {
    await ensureRecentResultFeedPostsForSeason(teamSeasonId);
  } catch (e) {
    console.warn('[useTeamFeedPosts] ensureRecentResultFeedPostsForSeason failed', e);
  }
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
      await runFeedEnsures(teamSeasonId);
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
    console.log('[LINEUP FEED] USE EFFECT FIRED', { teamSeasonId });
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
        await runFeedEnsures(teamSeasonId);
        if (cancelled) return;
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
