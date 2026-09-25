import { supabase } from './supabaseClient';

/** Signierte URLs für private Buckets (7 Tage). */
const SIGNED_TTL_SEC = 60 * 60 * 24 * 7;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 6;
const CACHE_PREFIX = 'spz_feed_media_v1:';
const memoryCache = new Map<string, { url: string; expiresAt: number }>();

function storageCacheKey(raw: string): string {
  return `${CACHE_PREFIX}${raw}`;
}

function readCachedUrl(raw: string): string | null {
  const now = Date.now();
  const memory = memoryCache.get(raw);
  if (memory && memory.expiresAt > now) return memory.url;
  if (memory) memoryCache.delete(raw);
  try {
    const stored = localStorage.getItem(storageCacheKey(raw));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { url?: unknown; expiresAt?: unknown };
    if (typeof parsed.url !== 'string' || Number(parsed.expiresAt) <= now) {
      localStorage.removeItem(storageCacheKey(raw));
      return null;
    }
    const entry = { url: parsed.url, expiresAt: Number(parsed.expiresAt) };
    memoryCache.set(raw, entry);
    return entry.url;
  } catch {
    return null;
  }
}

function cacheUrl(raw: string, url: string): string {
  const entry = { url, expiresAt: Date.now() + CACHE_TTL_MS };
  memoryCache.set(raw, entry);
  try {
    localStorage.setItem(storageCacheKey(raw), JSON.stringify(entry));
  } catch {
    // Privater Modus / voller Speicher: Memory-Cache reicht für diese Sitzung.
  }
  return url;
}

export function getCachedFeedMediaUrl(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  // Youth match clips are short-lived and revocable; never persist a signed URL.
  if (s.startsWith('match-videos/')) return null;
  if (isAbsoluteFeedMediaUrl(s) && !/\/object\/public\/team-feed\//i.test(s)) return s;
  return readCachedUrl(s);
}

export function isAbsoluteFeedMediaUrl(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  return /^https?:\/\//i.test(raw.trim());
}

/**
 * Löst media_url auf: Legacy https-URL unverändert (außer alte Public-URLs → Pfad → signiert),
 * sonst Pfad im Bucket `team-feed` → signierte URL.
 */
export async function resolveFeedMediaUrl(raw: string | null | undefined): Promise<string | null> {
  const s = raw?.trim();
  if (!s) return null;
  if (s.startsWith('match-videos/')) {
    const { data, error } = await supabase.storage.from('match-videos').createSignedUrl(s.slice('match-videos/'.length), 300);
    return error ? null : data?.signedUrl ?? null;
  }
  const cached = getCachedFeedMediaUrl(s);
  if (cached) return cached;
  if (isAbsoluteFeedMediaUrl(s)) {
    const pub = /\/object\/public\/team-feed\/(.+)$/i.exec(s);
    if (pub?.[1]) {
      const inner = decodeURIComponent(pub[1]);
      const { data, error } = await supabase.storage.from('team-feed').createSignedUrl(inner, SIGNED_TTL_SEC);
      if (!error && data?.signedUrl) return cacheUrl(s, data.signedUrl);
    }
    return s;
  }
  const { data, error } = await supabase.storage.from('team-feed').createSignedUrl(s, SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) {
    console.warn('[resolveFeedMediaUrl]', error?.message ?? 'keine signedUrl');
    return null;
  }
  return cacheUrl(s, data.signedUrl);
}
