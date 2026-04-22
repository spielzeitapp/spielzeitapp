import { useCallback, useEffect, useState } from 'react';
import { ensureMatchdayFeedPostForSeason } from '../lib/matchdayAutomation';
import { logMatchdayFeedSeasonContext } from '../lib/matchdayFeedDebug';
import { parseMatchdayPayload, type TeamFeedPostRow } from '../lib/matchdayFeedTypes';
import { supabase } from '../lib/supabaseClient';

async function fetchPosts(teamSeasonId: string): Promise<{
  posts: TeamFeedPostRow[];
  dbRowCount: number;
  parseDropped: number;
}> {
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
  return {
    posts: mapped,
    dbRowCount: rows.length,
    parseDropped: rows.length - mapped.length,
  };
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
      await logMatchdayFeedSeasonContext(teamSeasonId);
      const ensureRes = await ensureMatchdayFeedPostForSeason(teamSeasonId);
      console.info('[matchday] (4b) ensureMatchdayFeedPostForSeason Rückgabe =', {
        rpcOk: ensureRes.rpcOk,
        rpcError: ensureRes.rpcError,
        rpcPayload: ensureRes.rpcPayload,
      });
      const { posts: mapped, dbRowCount, parseDropped } = await fetchPosts(teamSeasonId);
      console.info('[matchday] (5) team_feed_posts nach SELECT:', {
        dbZeilen_roh: dbRowCount,
        geparste_matchday_karten: mapped.length,
        verworfen_wegen_payload_parse: parseDropped,
        event_ids_der_karten: mapped.map((p) => p.event_id).slice(0, 10),
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
        console.info('[matchday] (4b) ensureMatchdayFeedPostForSeason Rückgabe =', {
          rpcOk: ensureRes.rpcOk,
          rpcError: ensureRes.rpcError,
          rpcPayload: ensureRes.rpcPayload,
        });
        const { posts: mapped, dbRowCount, parseDropped } = await fetchPosts(teamSeasonId);
        if (cancelled) return;
        console.info('[matchday] (5) team_feed_posts nach SELECT:', {
          dbZeilen_roh: dbRowCount,
          geparste_matchday_karten: mapped.length,
          verworfen_wegen_payload_parse: parseDropped,
          event_ids_der_karten: mapped.map((p) => p.event_id).slice(0, 10),
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
