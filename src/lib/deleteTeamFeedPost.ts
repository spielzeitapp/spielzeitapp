import { supabase } from './supabaseClient';
import { isAbsoluteFeedMediaUrl } from './feedMediaUrl';

const TEAM_FEED_BUCKET = 'team-feed';

export type FeedPostDeleteInput = {
  id: string;
  team_season_id: string;
  media_url: string | null | undefined;
  thumbnail_url: string | null | undefined;
  payload: unknown;
};

/** Aus DB-Zeile für Lösch-API (Storage + team_feed_posts). */
export function toFeedPostDeleteInput(row: {
  id: string;
  team_season_id: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  payload?: unknown;
}): FeedPostDeleteInput {
  return {
    id: row.id,
    team_season_id: row.team_season_id,
    media_url: row.media_url ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    payload: row.payload ?? null,
  };
}

function pathFromPublicObjectUrl(url: string): string | null {
  const m = /\/object\/(?:public\/)?team-feed\/([^?]+)/i.exec(url.trim());
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function normalizeTeamFeedRelativePath(raw: string): string | null {
  const s = raw.trim().replace(/^\/+/, '');
  if (!s) return null;
  if (isAbsoluteFeedMediaUrl(s)) {
    const p = pathFromPublicObjectUrl(s);
    return p ? p.replace(/^\/+/, '') : null;
  }
  return s.replace(/^\/+/, '');
}

function isDeletableTeamFeedPath(path: string): boolean {
  const top = path.split('/')[0]?.toLowerCase();
  return top === 'images' || top === 'videos' || top === 'thumbnails';
}

/**
 * Pfade im Bucket `team-feed`, die beim Löschen entfernt werden sollen.
 * Nur images/…, videos/…, thumbnails/… — keine externen URLs.
 */
export function collectTeamFeedStoragePaths(input: FeedPostDeleteInput): string[] {
  const out = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const p = normalizeTeamFeedRelativePath(String(raw ?? ''));
    if (p && isDeletableTeamFeedPath(p)) out.add(p);
  };
  add(input.media_url);
  add(input.thumbnail_url);
  if (input.payload && typeof input.payload === 'object') {
    const sp = (input.payload as Record<string, unknown>).storage_path;
    if (typeof sp === 'string') add(sp);
  }
  return [...out];
}

export type DeleteTeamFeedPostResult = {
  ok: boolean;
  storageWarnings: string[];
  dbError: string | null;
};

/**
 * Reihenfolge: Storage best-effort, dann DB-Zeile. Speicher-Fehler in storageWarnings, kein stilles Versagen.
 */
export async function deleteTeamFeedPostClient(input: FeedPostDeleteInput): Promise<DeleteTeamFeedPostResult> {
  const paths = [...new Set(collectTeamFeedStoragePaths(input).filter(Boolean))];
  const storageWarnings: string[] = [];

  if (paths.length > 0) {
    try {
      const { error } = await supabase.storage.from(TEAM_FEED_BUCKET).remove(paths);
      if (error) storageWarnings.push(error.message);
    } catch (e) {
      storageWarnings.push(e instanceof Error ? e.message : String(e));
    }
  }

  const { error: delErr } = await supabase.from('team_feed_posts').delete().eq('id', input.id);
  if (delErr) {
    return { ok: false, storageWarnings, dbError: delErr.message };
  }
  return { ok: true, storageWarnings, dbError: null };
}
