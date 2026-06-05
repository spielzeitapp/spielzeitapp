const SHOWIT_FETCH_TIMEOUT_MS = 15_000;
const SHOWIT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export type MeinTurnierplanHtmlExtractResult =
  | { ok: true; tournamentJson: unknown; tournamentName: string | null }
  | { ok: false; error: string };

function buildShowitFetchHeaders(refererUrl: string): HeadersInit {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': SHOWIT_USER_AGENT,
    Referer: refererUrl,
  };
}

async function fetchShowitHtml(showitUrl: string, fetchImpl: typeof fetch): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHOWIT_FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(showitUrl, {
      headers: buildShowitFetchHeaders(showitUrl),
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Extrahiert `window.preloadedState = {…};` aus showit.php HTML. */
export function extractPreloadedStateFromShowitHtml(html: string): unknown | null {
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

type PreloadedTournamentEntry = {
  slug?: string;
  data?: Record<string, unknown> & { slug?: string; name?: string };
};

/** Turnierdaten aus preloadedState (gleiche Struktur wie json.php). */
export function extractTournamentJsonFromPreloadedState(
  preloadedState: unknown,
  tournamentSlug: string,
): { tournamentJson: unknown; tournamentName: string | null } | null {
  if (!preloadedState || typeof preloadedState !== 'object') return null;
  const state = preloadedState as {
    tournaments?: Record<string, PreloadedTournamentEntry>;
    openTournamentSlug?: string;
  };
  const slug = tournamentSlug.trim();
  const tournaments = state.tournaments ?? {};

  for (const entry of Object.values(tournaments)) {
    const entrySlug = (entry?.slug ?? entry?.data?.slug ?? '').trim();
    if (entrySlug === slug && entry?.data) {
      const name = typeof entry.data.name === 'string' ? entry.data.name.trim() : null;
      return { tournamentJson: entry.data, tournamentName: name || null };
    }
  }

  if (state.openTournamentSlug === slug) {
    for (const entry of Object.values(tournaments)) {
      if (entry?.data) {
        const name = typeof entry.data.name === 'string' ? entry.data.name.trim() : null;
        return { tournamentJson: entry.data, tournamentName: name || null };
      }
    }
  }

  const first = Object.values(tournaments).find((entry) => entry?.data);
  if (first?.data) {
    const name = typeof first.data.name === 'string' ? first.data.name.trim() : null;
    return { tournamentJson: first.data, tournamentName: name || null };
  }

  return null;
}

export function extractMeinTurnierplanJsonFromShowitHtml(
  html: string,
  tournamentSlug: string,
): MeinTurnierplanHtmlExtractResult {
  const preloadedState = extractPreloadedStateFromShowitHtml(html);
  if (!preloadedState) {
    return { ok: false, error: 'preloadedState nicht im HTML gefunden' };
  }

  const extracted = extractTournamentJsonFromPreloadedState(preloadedState, tournamentSlug);
  if (!extracted) {
    return { ok: false, error: 'Turnierdaten nicht in preloadedState' };
  }

  return {
    ok: true,
    tournamentJson: extracted.tournamentJson,
    tournamentName: extracted.tournamentName,
  };
}

export async function fetchMeinTurnierplanJsonFromShowitHtml(
  showitUrl: string,
  tournamentSlug: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MeinTurnierplanHtmlExtractResult> {
  try {
    const html = await fetchShowitHtml(showitUrl, fetchImpl);
    return extractMeinTurnierplanJsonFromShowitHtml(html, tournamentSlug);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network';
    return { ok: false, error: message };
  }
}
