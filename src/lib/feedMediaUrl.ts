import { supabase } from './supabaseClient';

/** Signierte URLs für private Buckets (7 Tage). */
const SIGNED_TTL_SEC = 60 * 60 * 24 * 7;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 6;
const CACHE_PREFIX = 'spz_feed_media_v1:';
export type FeedMediaVariant = 'original' | 'feed';
const pending = new Map<string, Promise<string | null>>();
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

/** Only static photos in team-feed use resizing; clips and external/demo assets keep their route. */
function previewKey(raw: string, variant: FeedMediaVariant): string {
  return variant === 'feed' && /\.(?:jpe?g|png|webp|avif|heic)$/i.test(raw)
    ? `feed-960-q75:${raw}` : raw;
}

export function getCachedFeedMediaUrl(raw: string | null | undefined, variant: FeedMediaVariant = 'original'): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (s.startsWith('/')) return s;
  // Youth match clips are short-lived and revocable; never persist a signed URL.
  if (s.startsWith('match-videos/')) return null;
  if (isAbsoluteFeedMediaUrl(s) && !/\/object\/public\/team-feed\//i.test(s)) return s;
  return readCachedUrl(previewKey(s, variant));
}

export function isAbsoluteFeedMediaUrl(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  return /^https?:\/\//i.test(raw.trim());
}

/** Original for opening/sharing; separately cached, signed 960px version for the feed. */
export async function resolveFeedMediaUrl(raw: string | null | undefined, variant: FeedMediaVariant = 'original'): Promise<string | null> {
  const s = raw?.trim();
  if (!s) return null;
  if (s.startsWith('/')) return s;
  if (s.startsWith('match-videos/')) {
    const { data, error } = await supabase.storage.from('match-videos').createSignedUrl(s.slice('match-videos/'.length), 300);
    return error ? null : data?.signedUrl ?? null;
  }
  const cached = getCachedFeedMediaUrl(s, variant);
  if (cached) return cached;
  const key = previewKey(s, variant);
  const inProgress = pending.get(key);
  if (inProgress) return inProgress;
  const request = (async () => {
    let path = s;
    if (isAbsoluteFeedMediaUrl(s)) {
      const pub = /\/object\/public\/team-feed\/(.+)$/i.exec(s);
      if (!pub?.[1]) return s;
      try { path = decodeURIComponent(pub[1]); } catch { return s; }
    }
    const options = key !== s ? { transform: { width: 960, quality: 75, resize: 'contain' as const } } : undefined;
    const { data, error } = await supabase.storage.from('team-feed').createSignedUrl(path, SIGNED_TTL_SEC, options);
    if (!error && data?.signedUrl) return cacheUrl(key, data.signedUrl);
    // A disabled transformation service must never hide a photo.
    if (options) return resolveFeedMediaUrl(s, 'original');
    console.warn('[resolveFeedMediaUrl]', error?.message ?? 'keine signedUrl');
    return isAbsoluteFeedMediaUrl(s) ? s : null;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}
