/**
 * MeinTurnierplan URL helpers for Vercel API (JS port of src/lib/meinTurnierplanUrl.ts).
 * See meinTurnierplanUrl.ts for test case comments.
 */

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

const ALLOWED_SHOWIT_HOSTS = new Set([
  'meinturnierplan.de',
  'www.meinturnierplan.de',
  'meinturnierplan.com',
  'www.meinturnierplan.com',
]);

function tryDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isPlausibleMeinTurnierplanTournamentId(value) {
  const id = value.trim();
  if (id.length < 6 || id.length > 32) return false;
  if (!/^[a-z0-9]+$/i.test(id)) return false;
  if (EXCLUDED_IDS.has(id.toLowerCase())) return false;
  if (!/\d/.test(id)) return false;
  return true;
}

export function normalizeTournamentPlanUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function sanitizePastedMeinTurnierplanUrl(raw) {
  let s = raw.replace(/[\s\u00a0\u200b-\u200d\ufeff]+/g, '').trim();
  if (!s) return s;
  for (let i = 0; i < 3; i += 1) {
    const decoded = tryDecodeURIComponent(s);
    if (decoded === s) break;
    s = decoded;
  }
  return normalizeTournamentPlanUrl(s);
}

export function isSupportedTournamentPlanHost(url) {
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

function extractFromQueryParams(parsed) {
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

function extractFromPath(pathname) {
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

function extractFromFragment(hash) {
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

function extractFromRegex(raw) {
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

export function extractMeinTurnierplanIdFromUrl(rawUrl) {
  const normalizedUrl = sanitizePastedMeinTurnierplanUrl(rawUrl);
  if (!normalizedUrl) return { id: null, source: null, normalizedUrl: '' };

  try {
    const parsed = new URL(normalizedUrl);
    const fromQuery = extractFromQueryParams(parsed);
    if (fromQuery) return { id: fromQuery.id, source: fromQuery.source, normalizedUrl };
    const fromPath = extractFromPath(parsed.pathname);
    if (fromPath) return { id: fromPath.id, source: fromPath.source, normalizedUrl };
    const fromFragment = extractFromFragment(parsed.hash);
    if (fromFragment) return { id: fromFragment.id, source: fromFragment.source, normalizedUrl };
  } catch {
    /* regex below */
  }

  const fromRegex = extractFromRegex(normalizedUrl);
  if (fromRegex) return { id: fromRegex.id, source: fromRegex.source, normalizedUrl };
  return { id: null, source: null, normalizedUrl };
}

export function extractMeinTurnierplanId(url) {
  return extractMeinTurnierplanIdFromUrl(url).id;
}

function extractPreloadedStateFromShowitHtml(html) {
  const marker = 'window.preloadedState = ';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;
  let i = startIdx + marker.length;
  while (i < html.length && html[i] === ' ') i += 1;
  if (html[i] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  const jsonStart = i;
  for (; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function extractMeinTurnierplanIdFromHtml(html) {
  const preloaded = extractPreloadedStateFromShowitHtml(html);
  if (preloaded && typeof preloaded === 'object') {
    const openSlug = preloaded.openTournamentSlug?.trim?.() ?? String(preloaded.openTournamentSlug ?? '').trim();
    if (openSlug && isPlausibleMeinTurnierplanTournamentId(openSlug)) {
      return { id: openSlug, source: 'html_preloaded' };
    }
    for (const entry of Object.values(preloaded.tournaments ?? {})) {
      const slug = (entry?.slug ?? entry?.data?.slug ?? '').trim();
      if (slug && isPlausibleMeinTurnierplanTournamentId(slug)) {
        return { id: slug, source: 'html_preloaded' };
      }
    }
  }
  const linkPatterns = [
    /showit\.php\?[^"'\\s]*\bid=([a-z0-9]{6,32})/gi,
    /json\.php\?[^"'\\s]*\bid=([a-z0-9]{6,32})/gi,
    /openTournamentSlug["']\s*:\s*["']([a-z0-9]{6,32})["']/gi,
  ];
  for (const pattern of linkPatterns) {
    for (const match of html.matchAll(pattern)) {
      const candidate = match[1]?.trim();
      if (candidate && isPlausibleMeinTurnierplanTournamentId(candidate)) {
        return { id: candidate, source: 'html_link' };
      }
    }
  }
  return null;
}

async function fetchShowitHtml(showitUrl, fetchImpl) {
  if (!ALLOWED_SHOWIT_HOSTS.has(new URL(showitUrl).hostname.toLowerCase())) {
    throw new Error('showit URL host not allowed');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetchImpl(showitUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': MEIN_TURNIERPLAN_FETCH_UA,
        Referer: 'https://www.meinturnierplan.de/',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function followMeinTurnierplanRedirectUrl(url, fetchImpl = fetch) {
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

export function resolveMeinTurnierplanShowitUrl(resolution) {
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

export async function resolveMeinTurnierplanTournamentId(rawUrl, fetchImpl = fetch) {
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

  let finalRedirectUrl = null;
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
    try {
      const html = await fetchShowitHtml(fetchTarget, fetchImpl);
      const fromHtml = extractMeinTurnierplanIdFromHtml(html);
      if (fromHtml) {
        return {
          originalUrl,
          normalizedUrl: direct.normalizedUrl,
          finalRedirectUrl: finalRedirectUrl ?? fetchTarget,
          detectedId: fromHtml.id,
          idSource: fromHtml.source,
        };
      }
    } catch {
      /* ignore */
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
