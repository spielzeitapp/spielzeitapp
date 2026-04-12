import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { normalizeMatchFeedTemplateKey } from '../features/home/feedTemplates';
import type { MatchFeedSettingsRow } from '../types/matchFeedSettings';

type DbRow = {
  id: string;
  event_id: string;
  is_feed_enabled: boolean;
  template_key: string;
  player_image_url: string | null;
  opponent_logo_url: string | null;
  headline_override: string | null;
  subline_override: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(r: DbRow): MatchFeedSettingsRow {
  return {
    id: r.id,
    event_id: r.event_id,
    is_feed_enabled: Boolean(r.is_feed_enabled),
    template_key: normalizeMatchFeedTemplateKey(r.template_key),
    player_image_url: r.player_image_url ?? null,
    opponent_logo_url: r.opponent_logo_url ?? null,
    headline_override: r.headline_override ?? null,
    subline_override: r.subline_override ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
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
    const { data, error } = await supabase.from('match_feed_settings').select('*').in('event_id', ids);
    if (error) {
      console.warn('[useMatchFeedSettingsMap]', error.message);
      setByEventId({});
      return;
    }
    const next: Record<string, MatchFeedSettingsRow> = {};
    for (const row of (data ?? []) as DbRow[]) {
      next[row.event_id] = mapRow(row);
    }
    setByEventId(next);
  }, [key]);

  useEffect(() => {
    load().catch(() => setByEventId({}));
  }, [load]);

  return { byEventId, refetch: load };
}
