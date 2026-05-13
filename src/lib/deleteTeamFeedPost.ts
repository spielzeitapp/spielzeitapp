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

function logSupabaseErr(ctx: string, err: { message?: string; code?: string; details?: string; hint?: string } | null) {
  if (!err) return;
  console.warn(`[deleteTeamFeedPostClient] ${ctx}`, {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
  });
}

type RpcDeletePayload = {
  ok?: boolean;
  deleted?: boolean;
  error?: string;
  reason?: string;
};

/**
 * Reihenfolge: Storage best-effort, dann DB-DELETE.
 * Wichtig: Bei RLS kann DELETE 0 Zeilen löschen ohne error — daher .select('id') prüfen.
 * Fallback: SECURITY DEFINER RPC delete_team_feed_post (nach Migration).
 */
export async function deleteTeamFeedPostClient(input: FeedPostDeleteInput): Promise<{
  ok: boolean;
  storageWarnings: string[];
  dbError: string | null;
}> {
  const paths = [...new Set(collectTeamFeedStoragePaths(input).filter(Boolean))];
  const storageWarnings: string[] = [];

  console.info('[deleteTeamFeedPostClient] start', {
    postId: input.id,
    team_season_id: input.team_season_id,
    storagePathCount: paths.length,
  });

  if (paths.length > 0) {
    try {
      const { error } = await supabase.storage.from(TEAM_FEED_BUCKET).remove(paths);
      if (error) {
        storageWarnings.push(error.message);
        logSupabaseErr('storage.remove', error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      storageWarnings.push(msg);
      console.warn('[deleteTeamFeedPostClient] storage.remove threw', msg);
    }
  }

  const { data: delRows, error: delErr } = await supabase
    .from('team_feed_posts')
    .delete()
    .eq('id', input.id)
    .select('id');

  logSupabaseErr('table.delete', delErr);

  console.info('[deleteTeamFeedPostClient] direct delete response', {
    postId: input.id,
    rowCount: delRows?.length ?? 0,
    error: delErr?.message ?? null,
    code: delErr?.code ?? null,
  });

  if (!delErr && Array.isArray(delRows) && delRows.length > 0) {
    return { ok: true, storageWarnings, dbError: null };
  }

  console.warn('[deleteTeamFeedPostClient] direct delete ineffective, trying RPC', {
    postId: input.id,
    hadError: !!delErr,
    rowCount: delRows?.length ?? 0,
  });

  const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_team_feed_post', {
    p_post_id: input.id,
  });

  logSupabaseErr('rpc.delete_team_feed_post', rpcErr);

  if (rpcErr) {
    const hint =
      /function .* does not exist|could not find the function/i.test(String(rpcErr.message ?? ''))
        ? ' Migration delete_team_feed_post auf Supabase ausführen.'
        : '';
    const dbError = `${delErr?.message ?? 'DELETE 0 Zeilen'} · RPC: ${rpcErr.message}${hint}`;
    console.warn('[deleteTeamFeedPostClient] RPC failed', {
      message: rpcErr.message,
      code: rpcErr.code,
      details: rpcErr.details,
      hint: rpcErr.hint,
    });
    return { ok: false, storageWarnings, dbError };
  }

  const row = rpcData as RpcDeletePayload | null;
  console.info('[deleteTeamFeedPostClient] RPC raw', rpcData);

  if (!row || row.ok === false) {
    return {
      ok: false,
      storageWarnings,
      dbError: row?.error ?? 'RPC: unbekannte Antwort',
    };
  }

  if (row.reason === 'not_found' || row.reason === 'already_gone') {
    return { ok: true, storageWarnings, dbError: null };
  }

  if (row.deleted) {
    return { ok: true, storageWarnings, dbError: null };
  }

  return {
    ok: false,
    storageWarnings,
    dbError: row.error ?? 'RPC: konnte Post nicht löschen (deleted=false)',
  };
}
