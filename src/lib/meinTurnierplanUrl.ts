/**
 * MeinTurnierplan URL normalization & tournament ID detection.
 *
 * Test cases (expected id = 1h42fr1f04 unless noted):
 * - https://www.meinturnierplan.de/showit.php?id=1h42fr1f04          → query_id
 * - www.meinturnierplan.de/showit.php?id=1h42fr1f04                   → query_id (https added)
 * - https://www.meinturnierplan.de/showit.php?ID=1h42fr1f04           → query_id (case-insensitive)
 * - https://www.meinturnierplan.de/showit.php#id=1h42fr1f04          → fragment
 * - https://meinturnierplan.de/turnier/1h42fr1f04                     → path
 * - pasted text with spaces: "  https://…id=1h42fr1f04  "              → sanitized query_id
 * - short redirect URL resolving to showit.php?id=…                     → redirect
 * - HTML page with window.preloadedState.openTournamentSlug           → html_preloaded
 */

import {
  extractPreloadedStateFromShowitHtml,
  fetchMeinTurnierplanShowitPageHtml,
} from './meinTurnierplanHtmlFallback';

export type MeinTurnierplanIdSource =
  | 'query_id'
  | 'query_alt'
  | 'path'
  | 'fragment'
  | 'regex'
  | 'redirect'
  | 'html_preloaded'
  | 'html_link';

export type MeinTurnierplanUrlResolution = {
  originalUrl: string;
  normalizedUrl: string;
  finalRedirectUrl: string | null;
  detectedId: string | null;
  idSource: MeinTurnierplanIdSource | null;
};

const MEIN_TURNIERPLAN_HOSTS = new Set([
  'meinturnierplan.de',
  'www.meinturnierplan.de',
  'meinturnierplan.com',
  'www.meinturnierplan.com',
  'tournamentbase.com',
  'www.tournamentbase.com',
]);

const QUERY_ID_KEYS = new Set([
  'id',
  'turnierid',
  'turnier_id',
  'tournamentid',
  'tournament_id',
  'tid',
  't',
  'turnier',
]);

const EXCLUDED_IDS = new Set([
  'showit',
  'json',
  'php',
  'index',
  'tournament',
  'turnier',
  'www',
  'html',
  'http',
  'https',
]);

const MEIN_TURNIERPLAN_FETCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Alphanumeric slug — e.g. 1h42fr1f04 */
export function isPlausibleMeinTurnierplanTournamentId(value: string): boolean {
  const id = value.trim();
  if (id.length < 6 || id.length > 32) return false;
  if (!/^[a-z0-9]+$/i.test(id)) return false;
  if (EXCLUDED_IDS.has(id.toLowerCase())) return false;
  if (!/\d/.test(id)) return false;
  return true;
}

function tryDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Trim, strip whitespace, decode, add https if missing. */
export function sanitizePastedMeinTurnierplanUrl(raw: string): string {
  let s = raw.replace(/[\s\u00a0\u200b-\u200d\ufeff]+/g, '').trim();
  if (!s) return s;

  for (let i = 0; i < 3; i += 1) {
    const decoded = tryDecodeURIComponent(s);
    if (decoded === s) break;
    s = decoded;
  }

  return normalizeTournamentPlanUrl(s);
}

export function normalizeTournamentPlanUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isSupportedTournamentPlanHost(url: string): boolean {
  const sanitized = sanitizePastedMeinTurnierplanUrl(url);
  if (!sanitized) return false;

  try {
    const host = new URL(sanitized).hostname.toLowerCase();
    if (MEIN_TURNIERPLAN_HOSTS.has(host)) return true;
    return /(^|\.)meinturnierplan\.(de|com)$/.test(host) || /(^|\.)tournamentbase\.com$/.test(host);
  } catch {
    return /meinturnierplan\.(de|com)/i.test(sanitized);
  }
}

function extractFromQueryParams(parsed: URL): { id: string; source: MeinTurnierplanIdSource } | null {
  for (const [key, rawValue] of parsed.searchParams.entries()) {
    const keyLower = key.toLowerCase();
    const value = tryDecodeURIComponent(rawValue).trim();
    if (!value) continue;

    if (QUERY_ID_KEYS.has(keyLower) && isPlausibleMeinTurnierplanTournamentId(value)) {
      return { id: value, source: keyLower === 'id' ? 'query_id' : 'query_alt' };
    }
  }

  for (const [, rawValue] of parsed.searchParams.entries()) {
    const value = tryDecodeURIComponent(rawValue).trim();
    if (value && isPlausibleMeinTurnierplanTournamentId(value)) {
      return { id: value, source: 'query_alt' };
    }
  }

  return null;
}

function extractFromPath(pathname: string): { id: string; source: MeinTurnierplanIdSource } | null {
  const segments = pathname.split('/').filter(Boolean);
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    if (lower.endsWith('.php') || lower === 'json' || lower === 'showit') continue;
    const decoded = tryDecodeURIComponent(segment).trim();
    if (isPlausibleMeinTurnierplanTournamentId(decoded)) {
      return { id: decoded, source: 'path' };
    }
  }
  return null;
}

function extractFromFragment(hash: string): { id: string; source: MeinTurnierplanIdSource } | null {
  if (!hash) return null;
  const frag = hash.startsWith('#') ? hash.slice(1) : hash;
  const idMatch = frag.match(/(?:^|[?&;])id=([^&#;]+)/i);
  if (idMatch?.[1]) {
    const value = tryDecodeURIComponent(idMatch[1]).trim();
    if (isPlausibleMeinTurnierplanTournamentId(value)) {
      return { id: value, source: 'fragment' };
    }
  }
  const decoded = tryDecodeURIComponent(frag).trim();
  if (isPlausibleMeinTurnierplanTournamentId(decoded)) {
    return { id: decoded, source: 'fragment' };
  }
  return null;
}

function extractFromRegex(raw: string): { id: string; source: MeinTurnierplanIdSource } | null {
  const patterns = [
    /[?&#;]id=([a-z0-9]{6,32})/i,
    /showit\.php[^#]*[?&#;]id=([a-z0-9]{6,32})/i,
    /\/(?:turnier|tournament|t|showit)\/([a-z0-9]{6,32})(?:\/|$|[?#;])/i,
    /meinturnierplan\.(?:de|com)\/([a-z0-9]{6,32})(?:\/|$|[?#;])/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && isPlausibleMeinTurnierplanTournamentId(candidate)) {
      return { id: candidate, source: 'regex' };
    }
  }
  return null;
}

export function extractMeinTurnierplanIdFromUrl(
  rawUrl: string,
): { id: string | null; source: MeinTurnierplanIdSource | null; normalizedUrl: string } {
  const normalizedUrl = sanitizePastedMeinTurnierplanUrl(rawUrl);
  if (!normalizedUrl) {
    return { id: null, source: null, normalizedUrl: '' };
  }

  try {
    const parsed = new URL(normalizedUrl);
    const fromQuery = extractFromQueryParams(parsed);
    if (fromQuery) return { id: fromQuery.id, source: fromQuery.source, normalizedUrl };

    const fromPath = extractFromPath(parsed.pathname);
    if (fromPath) return { id: fromPath.id, source: fromPath.source, normalizedUrl };

    const fromFragment = extractFromFragment(parsed.hash);
    if (fromFragment) return { id: fromFragment.id, source: fromFragment.source, normalizedUrl };
  } catch {
    /* regex fallback below */
  }

  const fromRegex = extractFromRegex(normalizedUrl);
  if (fromRegex) return { id: fromRegex.id, source: fromRegex.source, normalizedUrl };

  return { id: null, source: null, normalizedUrl };
}

export function extractMeinTurnierplanId(url: string): string | null {
  return extractMeinTurnierplanIdFromUrl(url).id;
}

export function labelMeinTurnierplanIdSource(source: MeinTurnierplanIdSource | null | undefined): string {
  if (!source) return '—';
  switch (source) {
    case 'query_id':
      return 'Query id=';
    case 'query_alt':
      return 'Query (alt)';
    case 'path':
      return 'Pfad';
    case 'fragment':
      return 'Fragment';
    case 'regex':
      return 'Regex';
    case 'redirect':
      return 'Redirect';
    case 'html_preloaded':
      return 'HTML preloadedState';
    case 'html_link':
      return 'HTML Link';
    default:
      return source;
  }
}

export function extractMeinTurnierplanIdFromHtml(
  html: string,
): { id: string; source: MeinTurnierplanIdSource } | null {
  const preloaded = extractPreloadedStateFromShowitHtml(html);
  if (preloaded && typeof preloaded === 'object') {
    const state = preloaded as {
      openTournamentSlug?: string;
      tournaments?: Record<string, { slug?: string; data?: { slug?: string } }>;
    };
    const openSlug = state.openTournamentSlug?.trim();
    if (openSlug && isPlausibleMeinTurnierplanTournamentId(openSlug)) {
      return { id: openSlug, source: 'html_preloaded' };
    }
    for (const entry of Object.values(state.tournaments ?? {})) {
      const slug = (entry?.slug ?? entry?.data?.slug ?? '').trim();
      if (slug && isPlausibleMeinTurnierplanTournamentId(slug)) {
        return { id: slug, source: 'html_preloaded' };
      }
    }
  }

  const linkPatterns = [
    /showit\.php\?[^"'\\s]*\bid=([a-z0-9]{6,32})/gi,
    /json\.php\?[^"'\\s]*\bid=([a-z0-9]{6,32})/gi,
    /["']id["']\s*:\s*["']([a-z0-9]{6,32})["']/gi,
    /openTournamentSlug["']\s*:\s*["']([a-z0-9]{6,32})["']/gi,
  ];
  for (const pattern of linkPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const candidate = match[1]?.trim();
      if (candidate && isPlausibleMeinTurnierplanTournamentId(candidate)) {
        return { id: candidate, source: 'html_link' };
      }
    }
  }

  return null;
}

export async function followMeinTurnierplanRedirectUrl(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': MEIN_TURNIERPLAN_FETCH_UA,
        },
      });
      return res.url || null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export function resolveMeinTurnierplanShowitUrl(
  resolution: Pick<MeinTurnierplanUrlResolution, 'normalizedUrl' | 'finalRedirectUrl' | 'detectedId'>,
): string {
  const candidates = [
    resolution.finalRedirectUrl,
    /showit\.php/i.test(resolution.normalizedUrl) ? resolution.normalizedUrl : null,
    resolution.detectedId
      ? `https://www.meinturnierplan.de/showit.php?id=${encodeURIComponent(resolution.detectedId)}`
      : null,
    resolution.normalizedUrl,
  ];
  for (const candidate of candidates) {
    if (candidate && isSupportedTournamentPlanHost(candidate)) return candidate;
  }
  return resolution.normalizedUrl;
}

export async function resolveMeinTurnierplanTournamentId(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MeinTurnierplanUrlResolution> {
  const originalUrl = rawUrl.trim();
  const direct = extractMeinTurnierplanIdFromUrl(originalUrl);

  if (direct.id) {
    return {
      originalUrl,
      normalizedUrl: direct.normalizedUrl,
      finalRedirectUrl: null,
      detectedId: direct.id,
      idSource: direct.source,
    };
  }

  let finalRedirectUrl: string | null = null;
  if (direct.normalizedUrl && isSupportedTournamentPlanHost(direct.normalizedUrl)) {
    finalRedirectUrl = await followMeinTurnierplanRedirectUrl(direct.normalizedUrl, fetchImpl);
    if (finalRedirectUrl) {
      const fromRedirect = extractMeinTurnierplanIdFromUrl(finalRedirectUrl);
      if (fromRedirect.id) {
        return {
          originalUrl,
          normalizedUrl: direct.normalizedUrl,
          finalRedirectUrl,
          detectedId: fromRedirect.id,
          idSource: 'redirect',
        };
      }
    }
  }

  const fetchTarget = finalRedirectUrl ?? direct.normalizedUrl;
  if (fetchTarget && isSupportedTournamentPlanHost(fetchTarget)) {
    const htmlFetch = await fetchMeinTurnierplanShowitPageHtml(fetchTarget, fetchImpl);
    if (htmlFetch.ok) {
      const fromHtml = extractMeinTurnierplanIdFromHtml(htmlFetch.html);
      if (fromHtml) {
        return {
          originalUrl,
          normalizedUrl: direct.normalizedUrl,
          finalRedirectUrl: finalRedirectUrl ?? fetchTarget,
          detectedId: fromHtml.id,
          idSource: fromHtml.source,
        };
      }
    }
  }

  return {
    originalUrl,
    normalizedUrl: direct.normalizedUrl,
    finalRedirectUrl,
    detectedId: null,
    idSource: null,
  };
}
