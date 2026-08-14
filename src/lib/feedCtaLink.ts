/**
 * Optionaler Feed-CTA (externe http(s)-Links, z. B. Cloudflare Stream Player).
 * Kein Livestream-Status, keine iframe-Einbettung — nur Link öffnen.
 */

import { safeText } from './safeText';

export const FEED_CTA_LABEL_MAX = 80;
export const FEED_CTA_LABEL_FALLBACK = 'Link öffnen';

export type ValidateFeedCtaUrlResult =
  | { ok: true; url: string | null }
  | { ok: false; error: string };

/** Leer = kein CTA. Sonst nur http/https. */
export function validateFeedCtaUrl(raw: unknown): ValidateFeedCtaUrlResult {
  const trimmed = safeText(raw);
  if (!trimmed) return { ok: true, url: null };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Ungültige URL. Bitte mit http:// oder https:// beginnen.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'URL muss mit http:// oder https:// beginnen.' };
  }

  return { ok: true, url: parsed.toString() };
}

export function sanitizeFeedCtaLabel(raw: unknown): string | null {
  const plain = safeText(raw)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  return plain.slice(0, FEED_CTA_LABEL_MAX);
}

export function resolveFeedCtaLabel(raw: unknown): string {
  return sanitizeFeedCtaLabel(raw) ?? FEED_CTA_LABEL_FALLBACK;
}

/** Wie Turnierplan-/Maps-Links: neuer Tab, noopener. */
export function openFeedCtaUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const validated = validateFeedCtaUrl(url);
  if (!validated.ok || !validated.url) return;
  window.open(validated.url, '_blank', 'noopener,noreferrer');
}

export function feedPostHasCta(post: { cta_url?: string | null }): boolean {
  return Boolean(safeText(post.cta_url));
}
