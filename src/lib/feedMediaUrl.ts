import { supabase } from './supabaseClient';

/** Signierte URLs für private Buckets (7 Tage). */
const SIGNED_TTL_SEC = 60 * 60 * 24 * 7;

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
  if (isAbsoluteFeedMediaUrl(s)) {
    const pub = /\/object\/public\/team-feed\/(.+)$/i.exec(s);
    if (pub?.[1]) {
      const inner = decodeURIComponent(pub[1]);
      const { data, error } = await supabase.storage.from('team-feed').createSignedUrl(inner, SIGNED_TTL_SEC);
      if (!error && data?.signedUrl) return data.signedUrl;
    }
    return s;
  }
  const { data, error } = await supabase.storage.from('team-feed').createSignedUrl(s, SIGNED_TTL_SEC);
  if (error || !data?.signedUrl) {
    console.warn('[resolveFeedMediaUrl]', error?.message ?? 'keine signedUrl');
    return null;
  }
  return data.signedUrl;
}
