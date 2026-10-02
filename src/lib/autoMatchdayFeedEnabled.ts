import type { EventRow } from '../hooks/useEvents';
import type { ClassifiedFeedPost } from './matchdayFeedTypes';
import { supabase } from './supabaseClient';
import { updateMatchRow } from './liveMatchService';

/** Remove the generated announcement globally, without deleting the match. */
export async function removeAutomaticMatchdayPost(matchId: string): Promise<void> {
  const id = matchId?.trim();
  if (!id) throw new Error('Dieser Beitrag ist noch keinem Spiel zugeordnet.');
  const { error } = await updateMatchRow(id, { auto_matchday_feed_enabled: false });
  if (error) throw new Error(error);
  // RLS can silently update zero rows. Never report success without verifying.
  const { data, error: readError } = await supabase.from('matches')
    .select('id, auto_matchday_feed_enabled').eq('id', id).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (data?.auto_matchday_feed_enabled !== false) {
    throw new Error('Beitrag konnte nicht gelöscht werden. Bitte Berechtigung prüfen und erneut versuchen.');
  }
}

/** Match-IDs mit deaktivierter Spieltag-Automatisierung (Hero + Spielankündigungen). */
export async function loadAutoMatchdayFeedDisabledMatchIds(
  matchIds: Iterable<string | null | undefined>,
): Promise<Set<string>> {
  const ids = [...new Set([...matchIds].map((id) => id?.trim()).filter(Boolean))] as string[];
  if (ids.length === 0) return new Set();

  const { data, error } = await supabase
    .from('matches')
    .select('id, auto_matchday_feed_enabled')
    .in('id', ids);

  if (error) {
    console.warn('[autoMatchdayFeed] disabled lookup failed', error.message);
    return new Set();
  }

  const disabled = new Set<string>();
  for (const row of (data ?? []) as Array<{ id: string; auto_matchday_feed_enabled: boolean | null }>) {
    if (row.auto_matchday_feed_enabled === false) disabled.add(row.id);
  }
  return disabled;
}

export async function loadAutoMatchdayFeedEnabledByMatchId(
  matchIds: Iterable<string | null | undefined>,
): Promise<Map<string, boolean>> {
  const ids = [...new Set([...matchIds].map((id) => id?.trim()).filter(Boolean))] as string[];
  const map = new Map<string, boolean>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from('matches')
    .select('id, auto_matchday_feed_enabled')
    .in('id', ids);

  if (error) {
    console.warn('[autoMatchdayFeed] enabled lookup failed', error.message);
    return map;
  }

  for (const row of (data ?? []) as Array<{ id: string; auto_matchday_feed_enabled: boolean | null }>) {
    map.set(row.id, row.auto_matchday_feed_enabled !== false);
  }
  return map;
}

/** true = Hero und Matchday-Feed erlaubt (Default ohne match_id). */
export function isAutoMatchdayFeedEnabledForEvent(
  event: Pick<EventRow, 'match_id'>,
  disabledMatchIds: ReadonlySet<string>,
): boolean {
  const matchId = event.match_id?.trim();
  if (!matchId) return true;
  return !disabledMatchIds.has(matchId);
}

export function isMatchdayFeedPostHiddenByAutomation(
  item: ClassifiedFeedPost,
  disabledMatchIds: ReadonlySet<string>,
): boolean {
  if (item.kind !== 'matchday' && item.kind !== 'next_match') return false;
  const matchId = item.post.payload.match_id?.trim();
  if (!matchId) return false;
  return disabledMatchIds.has(matchId);
}
