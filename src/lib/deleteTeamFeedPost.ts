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

type RpcDeletePayload = {
  ok?: boolean;
  deleted?: boolean;
  error?: string;
  reason?: string;
};

function scheduleOptionalStorageRemove(paths: string[]) {
  if (paths.length === 0) return;
  void (async () => {
    try {
      const { error } = await supabase.storage.from(TEAM_FEED_BUCKET).remove(paths);
      if (error) {
        console.warn('[deleteTeamFeedPostClient] storage.remove (async)', {
          message: error.message,
          code: error.statusCode,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[deleteTeamFeedPostClient] storage.remove threw (async)', msg);
    }
  })();
}

/** Direktes DELETE (RLS + can_delete_team_feed_post); Fallback wenn RPC fehlt/scheitert. */
async function tryDirectFeedPostDelete(postId: string): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await supabase.from('team_feed_posts').delete().eq('id', postId).select('id');

  console.log('[deleteTeamFeedPostClient] direct DELETE team_feed_posts', {
    postId,
    deletedRows: Array.isArray(data) ? data.length : 0,
    error: error
      ? { message: error.message, code: error.code, details: error.details, hint: error.hint }
      : null,
  });

  if (error) {
    return { ok: false, error: error.message ?? 'DELETE fehlgeschlagen' };
  }
  if (Array.isArray(data) && data.length > 0) {
    return { ok: true, error: null };
  }
  return { ok: false, error: 'Keine Zeile gelöscht (Berechtigung oder Post nicht gefunden).' };
}

/**
 * DB-Löschung per RPC `public.delete_team_feed_post_v2(p_post_id)`, Fallback direktes DELETE.
 * Storage-Cleanup danach optional im Hintergrund — blockiert den Erfolg nie.
 */
export async function deleteTeamFeedPostClient(input: FeedPostDeleteInput): Promise<{
  ok: boolean;
  storageWarnings: string[];
  dbError: string | null;
}> {
  const postId = String(input?.id ?? '').trim();
  const storageWarnings: string[] = [];

  if (!postId) {
    console.error('[deleteTeamFeedPostClient] missing post id', { input });
    return { ok: false, storageWarnings, dbError: 'Keine Beitrags-ID (post.id fehlt oder ist leer).' };
  }

  const paths = [...new Set(collectTeamFeedStoragePaths(input).filter(Boolean))];

  console.info('[deleteTeamFeedPostClient] start', {
    postId,
    team_season_id: input.team_season_id,
    storagePathCount: paths.length,
  });

  const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_team_feed_post_v2', {
    p_post_id: postId,
  });

  console.log('[deleteTeamFeedPostClient] RPC delete_team_feed_post_v2', {
    postId: input.id,
    rpcData,
    rpcError: rpcErr
      ? {
          message: rpcErr.message,
          code: rpcErr.code,
          details: rpcErr.details,
          hint: rpcErr.hint,
        }
      : null,
  });

  if (rpcErr) {
    const msg = String(rpcErr.message ?? '');
    const missingFn =
      /function .* does not exist|could not find the function/i.test(msg) || rpcErr.code === '42883';
    console.warn('[deleteTeamFeedPostClient] RPC error, trying direct DELETE', {
      missingFn,
      message: msg,
      code: rpcErr.code,
    });
    const direct = await tryDirectFeedPostDelete(postId);
    if (direct.ok) {
      scheduleOptionalStorageRemove(paths);
      return { ok: true, storageWarnings, dbError: null };
    }
    const dbError = missingFn
      ? `RPC delete_team_feed_post_v2 fehlt: ${msg}. Direktes Löschen: ${direct.error ?? 'fehlgeschlagen'}`
      : `Löschen fehlgeschlagen: ${msg}${rpcErr.code ? ` [${rpcErr.code}]` : ''}${rpcErr.details ? ` · ${rpcErr.details}` : ''}${rpcErr.hint ? ` · ${rpcErr.hint}` : ''}`;
    return { ok: false, storageWarnings, dbError };
  }

  const row =
    typeof rpcData === 'object' && rpcData !== null
      ? (rpcData as RpcDeletePayload)
      : (typeof rpcData === 'string'
          ? (() => {
              try {
                return JSON.parse(rpcData) as RpcDeletePayload;
              } catch {
                return null;
              }
            })()
          : null);

  if (!row) {
    console.error('[deleteTeamFeedPostClient] RPC returned empty/unparseable data', rpcData);
    return {
      ok: false,
      storageWarnings,
      dbError: 'RPC lieferte keine verwertbare Antwort (data leer).',
    };
  }

  if (row.ok === true) {
    scheduleOptionalStorageRemove(paths);
    return { ok: true, storageWarnings, dbError: null };
  }

  const errKey = String(row.error ?? '').toLowerCase();
  const human =
    errKey === 'forbidden'
      ? 'Keine Berechtigung: nur Staff/Admin für diese Team-Saison darf Feed-Beiträge löschen.'
      : errKey === 'not_authenticated'
        ? 'Nicht angemeldet.'
        : row.error ?? 'RPC meldet Fehler (ok=false).';

  if (errKey === 'forbidden') {
    console.warn('[deleteTeamFeedPostClient] RPC ok=false, trying direct DELETE', { row });
    const direct = await tryDirectFeedPostDelete(postId);
    if (direct.ok) {
      scheduleOptionalStorageRemove(paths);
      return { ok: true, storageWarnings, dbError: null };
    }
  }

  return { ok: false, storageWarnings, dbError: human };
}
