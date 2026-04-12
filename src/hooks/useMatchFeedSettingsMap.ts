import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { normalizeMatchFeedTemplateKey } from '../features/home/feedTemplates';
import type { MatchFeedSettingsRow } from '../types/matchFeedSettings';

/** Zeile aus `public.events` (Feed-Spalten). */
type EventFeedRow = {
  id: string;
  show_in_feed: boolean | null;
  feed_template: string | null;
  player_image_url: string | null;
  opponent_logo_url: string | null;
  feed_title: string | null;
  feed_subline: string | null;
  created_at: string;
  updated_at: string;
};

function mapEventRowToFeed(r: EventFeedRow): MatchFeedSettingsRow {
  return {
    id: r.id,
    event_id: r.id,
    is_feed_enabled: Boolean(r.show_in_feed),
    template_key: normalizeMatchFeedTemplateKey(String(r.feed_template ?? '')),
    player_image_url: r.player_image_url ?? null,
    opponent_logo_url: r.opponent_logo_url ?? null,
    headline_override: r.feed_title ?? null,
    subline_override: r.feed_subline ?? null,
    created_at: r.created_at ?? '',
    updated_at: r.updated_at ?? '',
  };
}

/**
 * Lädt Feed-Einstellungen für die angegebenen Event-IDs (eine Abfrage).
 * Leere ID-Liste → leeres Objekt.
 * @param refreshKey z. B. `location.key` – bei Navigation erneut laden.
 */
export function useMatchFeedSettingsMap(eventIds: string[], refreshKey = '') {
  const [byEventId, setByEventId] = useState<Record<string, MatchFeedSettingsRow>>({});
  const idKey = eventIds.length ? [...new Set(eventIds)].sort().join(',') : '';
  const key = `${refreshKey}|${idKey}`;

  const load = useCallback(async () => {
    if (!key) {
      setByEventId({});
      return;
    }
    const ids = key.split(',').filter(Boolean);
    const { data, error } = await supabase
      .from('events')
      .select(
        'id, show_in_feed, feed_template, player_image_url, opponent_logo_url, feed_title, feed_subline, created_at, updated_at',
      )
      .in('id', ids);
    if (error) {
      console.error('[useMatchFeedSettingsMap]', error.message);
      setByEventId({});
      return;
    }
    const next: Record<string, MatchFeedSettingsRow> = {};
    for (const row of (data ?? []) as EventFeedRow[]) {
      if (row?.id) next[row.id] = mapEventRowToFeed(row);
    }
    setByEventId(next);
  }, [key]);

  useEffect(() => {
    load().catch(() => setByEventId({}));
  }, [load]);

  return { byEventId, refetch: load };
}
