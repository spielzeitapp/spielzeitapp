/**
 * tournament-live adapter → existing TournamentPlanAnalysis shape.
 * Stable public JSON:
 *   GET /v1/tournament/key/{id}
 *   GET /v1/tournament/{mongoId}/results
 * Fallbacks: shortLinkMatching, alias lookup, page-scoped results.
 */

import {
  extractTournamentLiveKeyFromUrl,
  isTournamentLiveHost,
  normalizeTournamentLiveUrl,
  TOURNAMENT_LIVE_API_BASE,
  TOURNAMENT_LIVE_API_ORIGIN,
  type TournamentLiveIdSource,
  type TournamentLiveUrlResolution,
} from './tournamentLiveUrl';

type TournamentMatchPhase = 'group' | 'placement' | 'semifinal' | 'final' | 'unknown';

export type TournamentLiveParsedPlan = {
  provider: 'tournament-live';
  tournamentName: string | null;
  teamCount: number;
  groupCount: number;
  matchCount: number;
  preliminaryMatchCount: number;
  knockoutMatchCount: number;
  groupSummaries: Array<{ label: string; teamCount: number }>;
  teams: Array<{ teamName: string; groupLabel: string | null }>;
  rawMatches: Array<{
    homeTeam: string;
    awayTeam: string;
    groupLabel: string | null;
    phase: TournamentMatchPhase;
    kickoffTimeHHmm: string;
    plannedMinutes: number;
    pitch: string | null;
    hasResult: boolean;
    homeGoals: number | null;
    awayGoals: number | null;
    externalMatchId?: string | null;
  }>;
};

export type TournamentLiveAnalyzeDiagnostics = {
  linkRecognized: boolean;
  idExtracted: boolean;
  extractedId: string | null;
  apiReachable: boolean;
  provider: 'tournament-live';
  attemptedEndpoints: string[];
  tournamentName?: string | null;
  source?: 'server_api' | 'browser_fallback' | 'html_fallback';
  fallbackStage?: 'json' | 'browser' | 'html';
  originalUrl?: string | null;
  normalizedUrl?: string | null;
  finalRedirectUrl?: string | null;
  idDetectionSource?: TournamentLiveIdSource | null;
  detectedTeamCount?: number;
  detectedMatchCount?: number;
  htmlFallbackAttempted?: boolean;
  htmlFallbackSuccessful?: boolean;
};

export type TournamentLiveAnalyzeFailure = {
  code:
    | 'unsupported_host'
    | 'id_not_found'
    | 'api_unreachable'
    | 'import_data_unavailable'
    | 'plan_incomplete'
    | 'parse_failed';
  message: string;
  provider: 'tournament-live';
  extractedId: string | null;
  attemptedEndpoints: string[];
  diagnostics: TournamentLiveAnalyzeDiagnostics;
};

export const TOURNAMENT_LIVE_INCOMPLETE_MESSAGE =
  'Turnier wurde erkannt, der Spielplan konnte aber noch nicht vollständig gelesen werden.';

const FETCH_TIMEOUT_MS = 15_000;
const FETCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

type LiveScheduleItem = {
  _id?: string;
  id?: string;
  type?: string;
  title?: string;
  gameNumber?: number;
  gameField?: string | number;
  date?: string;
  time?: string;
  assignment1?: string;
  assignment2?: string;
  scheduleType?: string;
  result1?: string | number | null;
  result2?: string | number | null;
  score1?: string | number | null;
  score2?: string | number | null;
  goals1?: string | number | null;
  goals2?: string | number | null;
  /** Real TURNIERlive results payload (not result1/result2). */
  assignment1ScoredGoals?: string | number | null;
  assignment2ScoredGoals?: string | number | null;
};

type LiveResultItem = {
  title?: string;
  parentTitle?: string;
  type?: string;
  scheduleItems?: LiveScheduleItem[];
  tableItems?: Array<{ title?: string }>;
};

type LiveTournamentMeta = {
  _id?: string;
  title?: string;
  alias?: string;
  key?: string | number;
  pages?: Array<{ _id?: string; slug?: string }>;
  settings?: {
    groupGameDuration?: number;
    koGameDuration?: number;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function unwrapData(json: unknown): unknown {
  const rec = asRecord(json);
  if (!rec) return json;
  if ('data' in rec) return rec.data;
  return json;
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: unknown; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'User-Agent': FETCH_UA,
        ...(init?.headers || {}),
      },
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': FETCH_UA,
      },
    });
    let text = '';
    try {
      text = await res.text();
    } catch {
      text = '';
    }
    return { ok: res.ok, status: res.status, text, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeLiveSchedulePayload(value: unknown): boolean {
  const rec = asRecord(value);
  const items = Array.isArray(value)
    ? value
    : Array.isArray(rec?.items)
      ? rec.items
      : Array.isArray(rec?.data)
        ? rec.data
        : null;
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.some((item) => {
    const type = String(asRecord(item)?.type ?? '');
    return type === 'groupSchedule' || type === 'koSchedule';
  });
}

function findLiveSchedulePayload(value: unknown, depth = 0): unknown | null {
  if (value == null || depth > 8) return null;
  if (looksLikeLiveSchedulePayload(value)) return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findLiveSchedulePayload(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const rec = asRecord(value);
  if (!rec) return null;
  for (const nested of Object.values(rec)) {
    const found = findLiveSchedulePayload(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

function extractJsonCandidatesFromHtml(html: string): unknown[] {
  const candidates: unknown[] = [];
  const tryParse = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    try {
      candidates.push(JSON.parse(trimmed));
    } catch {
      /* ignore */
    }
  };

  const jsonScripts = html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonScripts) {
    if (match[1]) tryParse(match[1]);
  }

  const assignments = html.matchAll(
    /(?:window\.)?__?(?:INITIAL_STATE|PRELOADED_STATE|NG_STATE|APP_STATE)__?\s*=\s*(\{[\s\S]*?\})\s*;/gi,
  );
  for (const match of assignments) {
    if (match[1]) tryParse(match[1]);
  }

  const ngState = html.match(/id=["']ng-state["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ngState?.[1]) tryParse(ngState[1]);

  return candidates;
}

function isPlaceholderAssignment(name: string): boolean {
  // Keep in sync with tournamentUnresolvedTeam — avoid importing React/supabase graph into API path.
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!n) return true;
  if (/^(tbd|n\/?a|\?+|-+|–+|—+)$/i.test(n)) return true;
  if (/gewinner|sieger|verlierer|loser|winner|runner.?up|bye\b/i.test(n)) return true;
  if (/^(1|2|3|4|5|6|7|8)\.\s*(gruppe|group|platz|place)\b/i.test(n)) return true;
  if (/^p\s*[1-8]\b/i.test(n)) return true;
  if (/^(gruppe|group)\s*[a-d0-9]+\b/i.test(n) && /platz|place|sieger|gewinner|[1-4]\./i.test(n)) {
    return true;
  }
  if (/^(hf|vf|af|sf|f)\s*\d*$/i.test(n)) return true;
  if (/^(spiel|match)\s*(um\s*)?platz\s*\d+/i.test(n)) return true;
  if (/^platz\s+\d+/i.test(n)) return true;
  return false;
}

function kickoffFromItem(item: LiveScheduleItem): string {
  const raw = String(item.time ?? '').trim();
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return '10:00';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function parseGoal(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 99) return null;
  return Math.trunc(n);
}

function extractScores(item: LiveScheduleItem): {
  hasResult: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
} {
  // TURNIERlive real payload uses assignment1ScoredGoals / assignment2ScoredGoals.
  const home = parseGoal(
    item.result1 ?? item.score1 ?? item.goals1 ?? item.assignment1ScoredGoals,
  );
  const away = parseGoal(
    item.result2 ?? item.score2 ?? item.goals2 ?? item.assignment2ScoredGoals,
  );
  if (home == null || away == null) {
    return { hasResult: false, homeGoals: null, awayGoals: null };
  }
  return { hasResult: true, homeGoals: home, awayGoals: away };
}

function inferPhase(item: LiveResultItem, match: LiveScheduleItem): TournamentMatchPhase {
  const blob = `${item.type ?? ''} ${item.title ?? ''} ${item.parentTitle ?? ''} ${match.title ?? ''} ${match.scheduleType ?? ''}`;
  if (/finale/i.test(blob) && !/platz/i.test(blob) && !/halb/i.test(blob)) return 'final';
  if (/halbfinale/i.test(blob)) return 'semifinal';
  if (/platz|placement/i.test(blob)) return 'placement';
  if (/ko/i.test(blob)) return 'unknown';
  return 'group';
}

function groupLabelFromItem(item: LiveResultItem): string | null {
  const title = String(item.title ?? '').trim();
  if (/^gruppe\s+/i.test(title)) {
    return title.replace(/^gruppe\s+/i, '').trim() || title;
  }
  return null;
}

function clampMinutes(value: unknown, fallback: number): number {
  const n = Math.trunc(Number(value) || fallback);
  return Math.max(1, Math.min(120, n || fallback));
}

export function parseTournamentLiveResults(
  resultsJson: unknown,
  meta: { title?: string | null; groupMinutes?: number; koMinutes?: number },
): TournamentLiveParsedPlan | null {
  const data = unwrapData(resultsJson);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const items: LiveResultItem[] = [];
  for (const row of rows) {
    const rec = asRecord(row);
    const nested = rec?.items;
    if (Array.isArray(nested)) {
      for (const it of nested) items.push(it as LiveResultItem);
    }
  }

  const scheduleBlocks = items.filter(
    (item) => item.type === 'groupSchedule' || item.type === 'koSchedule',
  );
  if (scheduleBlocks.length === 0) return null;

  const teams: TournamentLiveParsedPlan['teams'] = [];
  const seenTeams = new Set<string>();
  const groupSummaries: TournamentLiveParsedPlan['groupSummaries'] = [];
  const rawMatches: TournamentLiveParsedPlan['rawMatches'] = [];
  const seenMatchKeys = new Set<string>();

  const groupMinutes = clampMinutes(meta.groupMinutes, 15);
  const koMinutes = clampMinutes(meta.koMinutes, groupMinutes);

  for (const block of scheduleBlocks) {
    const label = groupLabelFromItem(block);
    const tableTeams = (block.tableItems ?? [])
      .map((t) => String(t.title ?? '').trim())
      .filter(Boolean);
    if (label && tableTeams.length > 0) {
      groupSummaries.push({ label, teamCount: tableTeams.length });
    }
    for (const teamName of tableTeams) {
      const key = teamName.toLowerCase();
      if (seenTeams.has(key)) continue;
      seenTeams.add(key);
      teams.push({ teamName, groupLabel: label });
    }

    for (const match of block.scheduleItems ?? []) {
      if (String(match.type ?? 'game') !== 'game') continue;
      const homeTeam = String(match.assignment1 ?? '').trim();
      const awayTeam = String(match.assignment2 ?? '').trim();
      if (!homeTeam || !awayTeam) continue;

      const matchKey = `${match._id ?? match.id ?? ''}::${match.gameNumber ?? ''}::${homeTeam}::${awayTeam}::${match.time ?? ''}`;
      if (seenMatchKeys.has(matchKey)) continue;
      seenMatchKeys.add(matchKey);

      if (!isPlaceholderAssignment(homeTeam)) {
        const key = homeTeam.toLowerCase();
        if (!seenTeams.has(key)) {
          seenTeams.add(key);
          teams.push({ teamName: homeTeam, groupLabel: label });
        }
      }
      if (!isPlaceholderAssignment(awayTeam)) {
        const key = awayTeam.toLowerCase();
        if (!seenTeams.has(key)) {
          seenTeams.add(key);
          teams.push({ teamName: awayTeam, groupLabel: label });
        }
      }

      const phase = inferPhase(block, match);
      const field = String(match.gameField ?? '').trim();
      const scores = extractScores(match);
      rawMatches.push({
        homeTeam,
        awayTeam,
        groupLabel: phase === 'group' ? label : null,
        phase,
        kickoffTimeHHmm: kickoffFromItem(match),
        plannedMinutes: phase === 'group' ? groupMinutes : koMinutes,
        pitch: field ? `Platz ${field}` : null,
        hasResult: scores.hasResult,
        homeGoals: scores.homeGoals,
        awayGoals: scores.awayGoals,
        // Prefer stable provider _id. Fallback must NOT include team names
        // (placeholder → concrete would otherwise change identity and create duplicates).
        externalMatchId: String(
          match._id ??
            match.id ??
            `g${match.gameNumber ?? ''}|${kickoffFromItem(match)}|${field || 'x'}|${phase}`,
        ),
      });
    }
  }

  if (teams.length === 0 && rawMatches.length === 0) return null;

  const preliminaryMatchCount = rawMatches.filter((m) => m.phase === 'group').length;
  return {
    provider: 'tournament-live',
    tournamentName: meta.title ?? null,
    teamCount: teams.length,
    groupCount: groupSummaries.length || (teams.length > 0 ? 1 : 0),
    matchCount: rawMatches.length,
    preliminaryMatchCount,
    knockoutMatchCount: rawMatches.length - preliminaryMatchCount,
    groupSummaries,
    teams,
    rawMatches,
  };
}

function liveDiagnostics(params: {
  resolution: TournamentLiveUrlResolution;
  extractedId: string | null;
  attemptedEndpoints: string[];
  apiReachable: boolean;
  tournamentName?: string | null;
  source?: TournamentLiveAnalyzeDiagnostics['source'];
  fallbackStage?: TournamentLiveAnalyzeDiagnostics['fallbackStage'];
  detectedTeamCount?: number;
  detectedMatchCount?: number;
  htmlFallbackAttempted?: boolean;
  htmlFallbackSuccessful?: boolean;
}): TournamentLiveAnalyzeDiagnostics {
  return {
    linkRecognized: true,
    idExtracted: Boolean(params.extractedId),
    extractedId: params.extractedId,
    apiReachable: params.apiReachable,
    provider: 'tournament-live',
    attemptedEndpoints: params.attemptedEndpoints,
    tournamentName: params.tournamentName ?? null,
    source: params.source ?? 'server_api',
    fallbackStage: params.fallbackStage ?? 'json',
    originalUrl: params.resolution.originalUrl,
    normalizedUrl: params.resolution.normalizedUrl,
    finalRedirectUrl: params.resolution.finalRedirectUrl,
    idDetectionSource: params.resolution.idSource,
    detectedTeamCount: params.detectedTeamCount,
    detectedMatchCount: params.detectedMatchCount,
    htmlFallbackAttempted: params.htmlFallbackAttempted,
    htmlFallbackSuccessful: params.htmlFallbackSuccessful,
  };
}

function applyShortLinkPayload(
  resolution: TournamentLiveUrlResolution,
  json: unknown,
): void {
  const unwrapped = unwrapData(json);
  const payload = asRecord(unwrapped);
  const redirect =
    (typeof unwrapped === 'string' ? unwrapped : null) ||
    (typeof payload?.data === 'string' ? payload.data : null);
  if (!redirect || !/^https?:\/\//i.test(redirect)) return;
  resolution.finalRedirectUrl = redirect;
  const fromRedirect = extractTournamentLiveKeyFromUrl(redirect);
  if (fromRedirect.id) {
    resolution.detectedId = fromRedirect.id;
    resolution.idSource = resolution.idSource ?? 'redirect';
  }
  if (fromRedirect.alias) {
    resolution.alias = fromRedirect.alias;
    resolution.pageSlug = fromRedirect.pageSlug;
  }
}

function analysisIsComplete(analysis: TournamentLiveParsedPlan | null): boolean {
  return Boolean(analysis && analysis.teamCount > 0 && analysis.matchCount > 0);
}

export async function analyzeTournamentLiveUrl(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<
  | { ok: true; analysis: TournamentLiveParsedPlan; diagnostics: TournamentLiveAnalyzeDiagnostics }
  | { ok: false; failure: TournamentLiveAnalyzeFailure; httpStatus: number }
> {
  const originalUrl = url.trim();
  const extracted = extractTournamentLiveKeyFromUrl(originalUrl);
  const resolution: TournamentLiveUrlResolution = {
    originalUrl,
    normalizedUrl: extracted.normalizedUrl || normalizeTournamentLiveUrl(originalUrl),
    finalRedirectUrl: null,
    detectedId: extracted.id,
    pageSlug: extracted.pageSlug,
    alias: extracted.alias,
    idSource: extracted.source,
  };

  if (!isTournamentLiveHost(originalUrl)) {
    const failure: TournamentLiveAnalyzeFailure = {
      code: 'unsupported_host',
      message: 'Turnierplan wird aktuell nicht unterstützt.',
      provider: 'tournament-live',
      extractedId: null,
      attemptedEndpoints: [],
      diagnostics: liveDiagnostics({
        resolution,
        extractedId: null,
        attemptedEndpoints: [],
        apiReachable: false,
      }),
    };
    failure.diagnostics.linkRecognized = false;
    return { ok: false, failure, httpStatus: 422 };
  }

  const attemptedEndpoints: string[] = [];
  let apiReachable = false;
  let meta: LiveTournamentMeta | null = null;

  const tryGet = async (path: string) => {
    const endpoint = `${TOURNAMENT_LIVE_API_BASE}${path}`;
    attemptedEndpoints.push(endpoint);
    const res = await fetchJson(endpoint, fetchImpl);
    if (res.status > 0) apiReachable = true;
    return res;
  };

  const tryShortLink = async (matchingKey: string) => {
    if (!matchingKey) return;
    const shortEndpoint = `${TOURNAMENT_LIVE_API_ORIGIN}/v1/action/shortLinkMatching`;
    attemptedEndpoints.push(shortEndpoint);
    try {
      const shortRes = await fetchJson(shortEndpoint, fetchImpl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchingKey }),
      });
      if (shortRes.status > 0) apiReachable = true;
      applyShortLinkPayload(resolution, shortRes.json);
    } catch {
      /* continue */
    }
  };

  const keyGuess =
    resolution.detectedId ||
    extractTournamentLiveKeyFromUrl(resolution.normalizedUrl).id ||
    resolution.normalizedUrl.split('/').filter(Boolean).pop() ||
    '';

  if (resolution.detectedId) {
    const [keyRes] = await Promise.all([
      tryGet(`/tournament/key/${encodeURIComponent(resolution.detectedId)}`),
      tryShortLink(keyGuess),
    ]);
    const data = unwrapData(keyRes.json);
    const rec = asRecord(data);
    if (keyRes.ok && rec?._id) {
      meta = rec as LiveTournamentMeta;
    }
  } else {
    await tryShortLink(keyGuess);
  }

  if (resolution.detectedId && !meta) {
    const keyRes = await tryGet(`/tournament/key/${encodeURIComponent(resolution.detectedId)}`);
    const data = unwrapData(keyRes.json);
    const rec = asRecord(data);
    if (keyRes.ok && rec?._id) {
      meta = rec as LiveTournamentMeta;
    }
  }

  if (!meta && resolution.alias) {
    const aliasRes = await tryGet(`/tournament/alias/${encodeURIComponent(resolution.alias)}`);
    const data = unwrapData(aliasRes.json);
    const rec = asRecord(data);
    if (aliasRes.ok && rec?._id) {
      meta = rec as LiveTournamentMeta;
      if (meta.key != null) resolution.detectedId = String(meta.key);
    }
  }

  const parseMeta = {
    title: meta?.title ?? null,
    groupMinutes: meta?.settings?.groupGameDuration,
    koMinutes: meta?.settings?.koGameDuration,
  };

  let analysis: TournamentLiveParsedPlan | null = null;
  let fallbackStage: TournamentLiveAnalyzeDiagnostics['fallbackStage'] = 'json';
  let source: TournamentLiveAnalyzeDiagnostics['source'] = 'server_api';
  let htmlFallbackAttempted = false;
  let htmlFallbackSuccessful = false;

  if (meta?._id) {
    const tournamentId = String(meta._id);
    const pageId = meta.pages?.[0]?._id ? String(meta.pages[0]._id) : null;
    const resultPaths = [`/tournament/${encodeURIComponent(tournamentId)}/results`];
    if (pageId) {
      resultPaths.push(
        `/page/${encodeURIComponent(pageId)}/tournament/${encodeURIComponent(tournamentId)}/results`,
      );
    }

    for (const path of resultPaths) {
      const res = await tryGet(path);
      if (!res.ok) continue;
      const parsed = parseTournamentLiveResults(res.json, parseMeta);
      if (parsed && (!analysis || parsed.matchCount > analysis.matchCount)) {
        analysis = parsed;
      }
      if (analysisIsComplete(analysis)) break;
    }
  }

  if (!analysisIsComplete(analysis)) {
    htmlFallbackAttempted = true;
    fallbackStage = 'html';
    const htmlTargets = [
      resolution.normalizedUrl,
      resolution.finalRedirectUrl,
      resolution.originalUrl,
    ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

    for (const htmlUrl of htmlTargets) {
      try {
        attemptedEndpoints.push(htmlUrl);
        const htmlRes = await fetchText(htmlUrl, fetchImpl);
        if (htmlRes.status > 0) apiReachable = true;
        if (htmlRes.finalUrl && isTournamentLiveHost(htmlRes.finalUrl)) {
          resolution.finalRedirectUrl = resolution.finalRedirectUrl ?? htmlRes.finalUrl;
        }
        if (!htmlRes.ok || !htmlRes.text) continue;
        for (const candidate of extractJsonCandidatesFromHtml(htmlRes.text)) {
          const payload = findLiveSchedulePayload(candidate);
          if (!payload) continue;
          const parsed = parseTournamentLiveResults(payload, parseMeta);
          if (parsed && (!analysis || parsed.matchCount > analysis.matchCount)) {
            analysis = parsed;
            htmlFallbackSuccessful = true;
            source = 'html_fallback';
          }
        }
        if (analysisIsComplete(analysis)) break;
      } catch {
        /* continue */
      }
    }
  }

  if (analysisIsComplete(analysis) && analysis) {
    return {
      ok: true,
      analysis,
      diagnostics: liveDiagnostics({
        resolution,
        extractedId: resolution.detectedId ?? (meta?.key != null ? String(meta.key) : null),
        attemptedEndpoints,
        apiReachable: true,
        tournamentName: meta?.title ?? analysis.tournamentName,
        source,
        fallbackStage: htmlFallbackSuccessful ? 'html' : 'json',
        detectedTeamCount: analysis.teamCount,
        detectedMatchCount: analysis.matchCount,
        htmlFallbackAttempted,
        htmlFallbackSuccessful,
      }),
    };
  }

  const extractedId = resolution.detectedId ?? (meta?.key != null ? String(meta.key) : null);
  const recognized = Boolean(extractedId || resolution.alias || meta);
  const failure: TournamentLiveAnalyzeFailure = {
    code: recognized ? 'plan_incomplete' : 'id_not_found',
    message: recognized
      ? TOURNAMENT_LIVE_INCOMPLETE_MESSAGE
      : 'Turnier-ID konnte aus dem Link nicht gelesen werden.',
    provider: 'tournament-live',
    extractedId,
    attemptedEndpoints,
    diagnostics: liveDiagnostics({
      resolution,
      extractedId,
      attemptedEndpoints,
      apiReachable,
      tournamentName: meta?.title ?? analysis?.tournamentName ?? null,
      source: htmlFallbackAttempted ? 'html_fallback' : 'server_api',
      fallbackStage,
      detectedTeamCount: analysis?.teamCount,
      detectedMatchCount: analysis?.matchCount,
      htmlFallbackAttempted,
      htmlFallbackSuccessful,
    }),
  };
  return { ok: false, failure, httpStatus: recognized && apiReachable ? 422 : extractedId ? 502 : 422 };
}
