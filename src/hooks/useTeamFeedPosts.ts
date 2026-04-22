import { useCallback, useEffect, useState } from 'react';
import { ensureMatchdayFeedPostForSeason } from '../lib/matchdayAutomation';
import { parseMatchdayPayload, type TeamFeedPostRow } from '../lib/matchdayFeedTypes';
import { supabase } from '../lib/supabaseClient';

async function fetchPosts(teamSeasonId: string): Promise<TeamFeedPostRow[]> {
  const { data, error: err } = await supabase
    .from('team_feed_posts')
    .select('id, team_season_id, team_id, event_id, post_kind, caption, payload, created_at')
    .eq('team_season_id', teamSeasonId)
    .order('created_at', { ascending: false })
    .limit(24);

  if (err) {
    console.warn('[useTeamFeedPosts]', err.message ?? err);
    throw new Error(err.message ?? 'Feed konnte nicht geladen werden.');
  }

  const rows = (data ?? []) as TeamFeedPostRow[];
  const mapped: TeamFeedPostRow[] = [];
  for (const r of rows) {
    const pl = parseMatchdayPayload(r.payload);
    if (!pl) continue;
    mapped.push({ ...r, payload: pl });
  }
  return mapped;
}

export function useTeamFeedPosts(teamSeasonId: string | null) {
  const [posts, setPosts] = useState<TeamFeedPostRow[]>([]);
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
      await ensureMatchdayFeedPostForSeason(teamSeasonId);
      setPosts(await fetchPosts(teamSeasonId));
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
        await ensureMatchdayFeedPostForSeason(teamSeasonId);
        if (cancelled) return;
        setPosts(await fetchPosts(teamSeasonId));
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
