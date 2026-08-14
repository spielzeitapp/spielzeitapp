/**
 * tournament-live / TURNIERlive URL detection.
 * Does not change MeinTurnierplan host or ID detection.
 */

export const TOURNAMENT_LIVE_API_ORIGIN = 'https://api.tournament-live.com';
export const TOURNAMENT_LIVE_API_BASE = `${TOURNAMENT_LIVE_API_ORIGIN}/v1`;

const TOURNAMENT_LIVE_HOST_RE =
  /(^|\.)tournament-live\.com$|(^|\.)turnier\.live$|(^|\.)tournamentlive\.com$/i;

export function normalizeTournamentLiveUrl(url) {
  const trimmed = String(url ?? '')
    .trim()
    .replace(/[\s\u00a0\u200b-\u200d\ufeff]+/g, '');
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isTournamentLiveHost(url) {
  const sanitized = normalizeTournamentLiveUrl(url);
  if (!sanitized) return false;
  try {
    const host = new URL(sanitized).hostname.toLowerCase();
    return TOURNAMENT_LIVE_HOST_RE.test(host);
  } catch {
    return /tournament-live\.com|turnier\.live|tournamentlive\.com/i.test(sanitized);
  }
}

export function isPlausibleTournamentLiveKey(value) {
  const id = String(value ?? '').trim();
  return /^\d{3,12}$/.test(id);
}

function tryDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function extractTournamentLiveKeyFromUrl(rawUrl) {
  const normalizedUrl = normalizeTournamentLiveUrl(rawUrl);
  if (!normalizedUrl) {
    return { id: null, pageSlug: null, alias: null, source: null, normalizedUrl: '' };
  }

  try {
    const parsed = new URL(normalizedUrl);
    for (const key of ['id', 'key', 'tid', 'tournamentid', 'tournament_id']) {
      const value = parsed.searchParams.get(key);
      if (value && isPlausibleTournamentLiveKey(value)) {
        return { id: value.trim(), pageSlug: null, alias: null, source: 'query', normalizedUrl };
      }
    }

    const segments = parsed.pathname.split('/').filter(Boolean).map(tryDecode);
    for (const segment of segments) {
      if (isPlausibleTournamentLiveKey(segment)) {
        return { id: segment, pageSlug: null, alias: null, source: 'path', normalizedUrl };
      }
    }

    const viewSuffixes = new Set(['all', 'games', 'table', 'plan', 'schedule', 'results', 'info']);
    const meaningful = segments.filter((segment) => !viewSuffixes.has(String(segment).trim().toLowerCase()));
    if (meaningful.length >= 2) {
      const pageSlug = meaningful[0]?.trim() || null;
      const alias = meaningful[1]?.trim() || null;
      if (pageSlug && alias && !/\.html?$/i.test(alias) && !isPlausibleTournamentLiveKey(pageSlug)) {
        return { id: null, pageSlug, alias, source: 'alias', normalizedUrl };
      }
    }
  } catch {
    const match = normalizedUrl.match(/\/(\d{3,12})(?:\/|[?#]|$)/);
    if (match?.[1]) {
      return { id: match[1], pageSlug: null, alias: null, source: 'path', normalizedUrl };
    }
  }

  return { id: null, pageSlug: null, alias: null, source: null, normalizedUrl };
}

export function labelTournamentLiveIdSource(source) {
  if (!source) return '—';
  switch (source) {
    case 'path':
      return 'Pfad';
    case 'query':
      return 'Query';
    case 'redirect':
      return 'Redirect';
    case 'alias':
      return 'Alias';
    default:
      return source;
  }
}
