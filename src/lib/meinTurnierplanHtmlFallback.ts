const SHOWIT_FETCH_TIMEOUT_MS = 15_000;
const SHOWIT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ALLOWED_SHOWIT_HOSTS = new Set([
  'meinturnierplan.de',
  'www.meinturnierplan.de',
  'meinturnierplan.com',
  'www.meinturnierplan.com',
]);

export type MeinTurnierplanHtmlFallbackException = {
  name: string;
  message: string;
  cause: string | null;
  code: string | null;
};

export type MeinTurnierplanHtmlExtractResult =
  | { ok: true; tournamentJson: unknown; tournamentName: string | null }
  | { ok: false; error: string; exception?: MeinTurnierplanHtmlFallbackException };

function nodeErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const direct = (err as { code?: unknown }).code;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  return null;
}

function nodeErrorCodeDeep(err: unknown): string | null {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current != null && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const code = nodeErrorCode(current);
    if (code) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

function formatErrorCauseDetail(err: Error): string {
  const parts = [err.name || 'Error', err.message.trim() || 'Unknown error'];
  const code = nodeErrorCode(err);
  if (code) parts.push(`code=${code}`);
  const syscall = (err as { syscall?: unknown }).syscall;
  if (typeof syscall === 'string' && syscall.trim()) parts.push(`syscall=${syscall.trim()}`);
  const hostname = (err as { hostname?: unknown }).hostname;
  if (typeof hostname === 'string' && hostname.trim()) parts.push(`hostname=${hostname.trim()}`);
  return parts.join(' · ');
}

function formatUnknownCause(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Error) return formatErrorCauseDetail(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function collectCauseChain(err: unknown): string | null {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err instanceof Error ? err.cause : null;
  while (current != null && !seen.has(current)) {
    seen.add(current);
    const formatted = formatUnknownCause(current);
    if (formatted) parts.push(formatted);
    current =
      current instanceof Error && current.cause != null && current.cause !== current ? current.cause : null;
  }
  if (err instanceof Error && 'errors' in err && Array.isArray((err as AggregateError).errors)) {
    for (const nested of (err as AggregateError).errors) {
      const formatted = formatUnknownCause(nested);
      if (formatted) parts.push(formatted);
    }
  }
  return parts.length > 0 ? parts.join(' → ') : null;
}

/** Volle Fetch-Exception für HTML-Fallback-Diagnostics (DNS/TLS/Timeout/…). */
export function captureMeinTurnierplanHtmlFallbackException(
  err: unknown,
): MeinTurnierplanHtmlFallbackException {
  if (err instanceof Error) {
    const code = nodeErrorCodeDeep(err);
    const cause = collectCauseChain(err);
    return {
      name: err.name || 'Error',
      message: err.message.trim() || 'Unknown error',
      cause,
      code,
    };
  }
  return {
    name: 'UnknownError',
    message: String(err),
    cause: null,
    code: null,
  };
}

export function isAllowedMeinTurnierplanShowitUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_SHOWIT_HOSTS.has(host);
  } catch {
    return false;
  }
}

function buildShowitFetchHeaders(): HeadersInit {
  return {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': SHOWIT_USER_AGENT,
    Referer: 'https://www.meinturnierplan.de/',
  };
}

/** Öffentliche showit.php-Seite laden (nur erlaubte MeinTurnierplan-Hosts). */
export async function fetchShowitHtml(showitUrl: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (!isAllowedMeinTurnierplanShowitUrl(showitUrl)) {
    throw new Error('showit URL host not allowed');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHOWIT_FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(showitUrl, {
      headers: buildShowitFetchHeaders(),
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
    const exception = captureMeinTurnierplanHtmlFallbackException(err);
    return { ok: false, error: exception.message || exception.name, exception };
  }
}

export async function fetchMeinTurnierplanShowitPageHtml(
  showitUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<
  | { ok: true; html: string }
  | { ok: false; error: string; exception: MeinTurnierplanHtmlFallbackException }
> {
  try {
    const html = await fetchShowitHtml(showitUrl, fetchImpl);
    return { ok: true, html };
  } catch (err) {
    const exception = captureMeinTurnierplanHtmlFallbackException(err);
    return { ok: false, error: exception.message || exception.name, exception };
  }
}
