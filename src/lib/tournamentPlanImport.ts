import { isTeamAliasMatch } from './teamSeasonAliasMatch';
import { safeOptionalText, safeText } from './safeText';
import type { TournamentImportRecognition } from './teamSeasonAliases';
import {
  captureMeinTurnierplanHtmlFallbackException,
  extractMeinTurnierplanJsonFromShowitHtml,
  fetchMeinTurnierplanShowitPageHtml,
  type MeinTurnierplanHtmlFallbackException,
} from './meinTurnierplanHtmlFallback';
import {
  extractMeinTurnierplanId,
  extractMeinTurnierplanIdFromHtml,
  isSupportedTournamentPlanHost,
  labelMeinTurnierplanIdSource,
  normalizeTournamentPlanUrl,
  resolveMeinTurnierplanShowitUrl,
  resolveMeinTurnierplanTournamentId,
  type MeinTurnierplanIdSource,
  type MeinTurnierplanUrlResolution,
} from './meinTurnierplanUrl';
import {
  extractTournamentLiveKeyFromUrl,
  isTournamentLiveHost,
  labelTournamentLiveIdSource,
  type TournamentLiveIdSource,
} from './tournamentLiveUrl';
import {
  analyzeTournamentLiveUrl,
  TOURNAMENT_LIVE_INCOMPLETE_MESSAGE,
} from './tournamentLiveAdapter';
import { looksLikeUnresolvedTournamentTeamName } from './tournamentUnresolvedTeam';

export {
  extractMeinTurnierplanId,
  isSupportedTournamentPlanHost,
  labelMeinTurnierplanIdSource,
  normalizeTournamentPlanUrl,
} from './meinTurnierplanUrl';
export { isTournamentLiveHost } from './tournamentLiveUrl';
export { TOURNAMENT_LIVE_INCOMPLETE_MESSAGE } from './tournamentLiveAdapter';

export type { MeinTurnierplanHtmlFallbackException as TournamentPlanHtmlFallbackException };

export type TournamentMatchPhase = 'group' | 'placement' | 'semifinal' | 'final' | 'unknown';

export type TournamentPlanImportTeam = {
  teamName: string;
  groupLabel: string | null;
};

export type TournamentPlanImportRawMatch = {
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
};

export type TournamentPlanGroupSummary = {
  label: string;
  teamCount: number;
};

export type TournamentPlanProvider = 'meinturnierplan' | 'tournament-live';

export type TournamentPlanAnalysis = {
  provider: TournamentPlanProvider;
  tournamentName?: string | null;
  teamCount: number;
  groupCount: number;
  matchCount: number;
  preliminaryMatchCount: number;
  knockoutMatchCount: number;
  groupSummaries: TournamentPlanGroupSummary[];
  teams: TournamentPlanImportTeam[];
  rawMatches: TournamentPlanImportRawMatch[];
};

export type TournamentPlanImportMatch = {
  opponentName: string;
  groupLabel: string | null;
  phase: TournamentMatchPhase;
  kickoffTimeHHmm: string;
  plannedMinutes: number;
  pitch: string | null;
  dedupeKey: string;
  hasResult: boolean;
  ourGoals: number | null;
  oppGoals: number | null;
};

export type TournamentPlanOwnMatchPreview = {
  opponentName: string;
  kickoffTimeHHmm: string;
  hasResult: boolean;
  ourGoals: number | null;
  oppGoals: number | null;
};

export type { TournamentImportRecognition };

export type TournamentPlanRefreshPreview = {
  newTeams: number;
  newMatches: number;
  existingMatches: number;
  resultUpdates: number;
  matchesWithResult: number;
  matchesWithoutResult: number;
};

export const TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE = 'Turnierplan wird aktuell nicht unterstützt.';
export const TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE = 'Turnierplan konnte nicht analysiert werden.';
export const TOURNAMENT_IMPORT_PLAN_INCOMPLETE_MESSAGE = TOURNAMENT_LIVE_INCOMPLETE_MESSAGE;

export const TOURNAMENT_IMPORT_MANUAL_HINT =
  'Dieser Turnierplan kann nicht automatisch importiert werden. Teams und Spiele können manuell oder per Schnellimport ergänzt werden.';

export const TOURNAMENT_IMPORT_DATA_UNAVAILABLE_MESSAGE =
  'Webseite ist erreichbar, aber die Import-Daten sind für SpielzeitApp nicht abrufbar.';

export const MEIN_TURNIERPLAN_HTML_FALLBACK_EMPTY_MESSAGE =
  'HTML-Fallback konnte keine Teams oder Spiele erkennen.';

const MEIN_TURNIERPLAN_FETCH_TIMEOUT_MS = 15_000;
const TOURNAMENT_ANALYZE_SERVER_API_TIMEOUT_MS = 15_000;
const TOURNAMENT_ANALYZE_BROWSER_FALLBACK_TIMEOUT_MS = 10_000;
const TOURNAMENT_ANALYZE_HTML_FALLBACK_TIMEOUT_MS = 15_000;

export const TOURNAMENT_ANALYZE_TIMEOUT_MESSAGE =
  'Analyse hat zu lange gedauert. Bitte erneut versuchen.';

export const TOURNAMENT_ANALYZE_NON_JSON_MESSAGE = 'Server hat keine JSON-Antwort geliefert.';

export type TournamentPlanAnalyzeLastStep = 'server_api' | 'browser_fallback' | 'html_fallback';

export class TournamentPlanAnalyzeNonJsonResponseError extends Error {
  readonly status: number;
  readonly contentType: string | null;
  readonly rawResponsePreview: string;

  constructor(status: number, contentType: string | null, rawResponsePreview: string) {
    super(TOURNAMENT_ANALYZE_NON_JSON_MESSAGE);
    this.name = 'TournamentPlanAnalyzeNonJsonResponseError';
    this.status = status;
    this.contentType = contentType;
    this.rawResponsePreview = rawResponsePreview;
  }
}

const MEIN_TURNIERPLAN_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export type TournamentPlanAnalyzeErrorCode =
  | 'unsupported_host'
  | 'id_not_found'
  | 'api_unreachable'
  | 'import_data_unavailable'
  | 'no_groups'
  | 'no_teams'
  | 'no_matches'
  | 'plan_no_longer_provided'
  | 'plan_incomplete'
  | 'parse_failed'
  | 'html_fallback_server_error';

export type TournamentPlanAnalyzeDataSource = 'server_api' | 'browser_fallback' | 'html_fallback';

export type TournamentPlanAnalyzeFallbackStage = 'json' | 'browser' | 'html';

export type TournamentPlanEndpointAttempt = {
  endpoint: string;
  finalUrl: string | null;
  httpStatus: number | null;
  networkError: boolean;
  errorDetail: string | null;
  exceptionName: string | null;
  exceptionMessage: string | null;
  parseCode: TournamentPlanAnalyzeErrorCode | 'ok' | null;
};

export type TournamentPlanFetchRuntimeDiagnostics = {
  vercel: boolean;
  region: string | null;
  nodeVersion: string | null;
};

export type TournamentPlanAnalyzeDiagnostics = {
  linkRecognized: boolean;
  idExtracted: boolean;
  extractedId: string | null;
  apiReachable: boolean;
  provider: TournamentPlanProvider;
  attemptedEndpoints: string[];
  endpointAttempts?: TournamentPlanEndpointAttempt[];
  showitPageReachable?: boolean | null;
  browserFallbackAttempted?: boolean;
  browserFallbackError?: string | null;
  htmlFallbackAttempted?: boolean;
  htmlFallbackSuccessful?: boolean;
  htmlFallbackTeamsFound?: number;
  htmlFallbackMatchesFound?: number;
  htmlFallbackError?: string | null;
  htmlFallbackException?: MeinTurnierplanHtmlFallbackException | null;
  htmlFallbackRequestUrl?: string | null;
  htmlFallbackResponseStatus?: number | null;
  htmlFallbackResponseContentType?: string | null;
  rawResponsePreview?: string | null;
  tournamentName?: string | null;
  serverException?: { name: string; message: string } | null;
  fetchRuntime?: TournamentPlanFetchRuntimeDiagnostics;
  /** Wo die Analyse-Daten herkamen (Serverless vs. Browser-Fetch). */
  source?: TournamentPlanAnalyzeDataSource;
  /** Letzte bzw. entscheidende Fallback-Stufe im Analysepfad. */
  fallbackStage?: TournamentPlanAnalyzeFallbackStage;
  analyzeTimedOut?: boolean;
  analyzeLastStep?: TournamentPlanAnalyzeLastStep;
  originalUrl?: string | null;
  normalizedUrl?: string | null;
  finalRedirectUrl?: string | null;
  idDetectionSource?: MeinTurnierplanIdSource | TournamentLiveIdSource | null;
  detectedTeamCount?: number;
  detectedMatchCount?: number;
};

export function labelForTournamentPlanAnalyzeSource(
  source: TournamentPlanAnalyzeDataSource | undefined,
): string {
  if (source === 'html_fallback') return 'HTML-Fallback';
  if (source === 'browser_fallback') return 'Browser-Fallback';
  if (source === 'server_api') return 'Server API';
  return '—';
}

export function labelForTournamentPlanProvider(provider: TournamentPlanProvider | undefined): string {
  if (provider === 'tournament-live') return 'tournament-live';
  if (provider === 'meinturnierplan') return 'MeinTurnierplan';
  return '—';
}

export function labelForTournamentPlanIdSource(
  source: MeinTurnierplanIdSource | TournamentLiveIdSource | null | undefined,
  provider?: TournamentPlanProvider,
): string {
  if (!source) return '—';
  if (provider === 'tournament-live' || source === 'query' || source === 'alias') {
    return labelTournamentLiveIdSource(source as TournamentLiveIdSource);
  }
  return labelMeinTurnierplanIdSource(source as MeinTurnierplanIdSource);
}

export function isRecognizedTournamentPlanHost(url: string): boolean {
  return isSupportedTournamentPlanHost(url) || isTournamentLiveHost(url);
}

export type TournamentPlanAnalyzeFailure = {
  code: TournamentPlanAnalyzeErrorCode;
  message: string;
  provider: TournamentPlanProvider;
  extractedId: string | null;
  attemptedEndpoints: string[];
  diagnostics: TournamentPlanAnalyzeDiagnostics;
};

/** Bekannte JSON-Endpoints (Reihenfolge = Fallback-Kette, dokumentiert in Code-Kommentar). */
export const MEIN_TURNIERPLAN_JSON_ENDPOINT_HOSTS = [
  'https://www.meinturnierplan.de/json/json.php',
  'https://meinturnierplan.de/json/json.php',
  'https://www.meinturnierplan.com/json/json.php',
  'https://meinturnierplan.com/json/json.php',
  'http://www.meinturnierplan.de/json/json.php',
] as const;

type MeinTurnierplanParticipant = { id?: number; name?: string };
type MeinTurnierplanGroup = { displayId?: string };
type MeinTurnierplanGroupMatch = {
  groupId?: number;
  dateAndTime?: string;
  homeParticipant?: number;
  awayParticipant?: number;
  courtId?: number;
  score1?: string | number | null;
  score2?: string | number | null;
};
type MeinTurnierplanSourceTeam = {
  type?: string;
  group?: number;
  rank?: number;
};
type MeinTurnierplanModeMapping = {
  type?: string;
  round?: number;
  match?: number;
};
type MeinTurnierplanFinalMatch = {
  dateAndTime?: string;
  homeParticipant?: number;
  awayParticipant?: number;
  courtId?: number;
  score1?: string | number | null;
  score2?: string | number | null;
  modeMapping?: MeinTurnierplanModeMapping;
  sourceTeam1?: MeinTurnierplanSourceTeam;
  sourceTeam2?: MeinTurnierplanSourceTeam;
};
type MeinTurnierplanJson = {
  participants?: Record<string, MeinTurnierplanParticipant>;
  groups?: MeinTurnierplanGroup[];
  groupParticipants?: number[][];
  groupMatches?: MeinTurnierplanGroupMatch[];
  finalMatches?: MeinTurnierplanFinalMatch[];
  groupMatchDuration?: number;
  finalMatchDuration?: number;
  courts?: { displayId?: string }[];
};

/** URL mit fehlendem Schema ergänzen — re-exported from meinTurnierplanUrl.ts */

function urlResolutionDiagnostics(
  resolution: MeinTurnierplanUrlResolution,
): Pick<
  TournamentPlanAnalyzeDiagnostics,
  'originalUrl' | 'normalizedUrl' | 'finalRedirectUrl' | 'idDetectionSource'
> {
  return {
    originalUrl: resolution.originalUrl,
    normalizedUrl: resolution.normalizedUrl,
    finalRedirectUrl: resolution.finalRedirectUrl,
    idDetectionSource: resolution.idSource,
  };
}

export function buildMeinTurnierplanJsonEndpoints(tournamentId: string): string[] {
  const id = tournamentId.trim();
  return MEIN_TURNIERPLAN_JSON_ENDPOINT_HOSTS.map(
    (base) => `${base}?id=${encodeURIComponent(id)}`,
  );
}

export function buildMeinTurnierplanShowitUrl(tournamentId: string): string {
  return `https://www.meinturnierplan.de/showit.php?id=${encodeURIComponent(tournamentId.trim())}`;
}

function buildMeinTurnierplanFetchHeaders(refererUrl: string): HeadersInit {
  return {
    Accept: 'application/json,text/plain,*/*',
    'User-Agent': MEIN_TURNIERPLAN_BROWSER_USER_AGENT,
    Referer: refererUrl,
  };
}

function nodeErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const direct = (err as { code?: unknown }).code;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object') {
    const causeCode = (cause as { code?: unknown }).code;
    if (typeof causeCode === 'string' && causeCode.trim()) return causeCode.trim();
  }
  return null;
}

function classifyFetchException(name: string, message: string, err: unknown): string {
  const code = nodeErrorCode(err);
  const combined = `${name} ${message} ${code ?? ''}`.toLowerCase();

  if (name === 'AbortError' || code === 'ETIMEDOUT' || /timeout|timed out|aborted/i.test(combined)) {
    return 'Timeout';
  }
  if (
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    /enotfound|getaddrinfo|dns|nxdomain|eai_again/i.test(combined)
  ) {
    return 'DNS';
  }
  if (
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'CERT_HAS_EXPIRED' ||
    /cert|tls|ssl|unable to verify|self signed|handshake|depth zero/i.test(combined)
  ) {
    return 'TLS';
  }
  if (code === 'ERR_TOO_MANY_REDIRECTS' || /too many redirects|redirect loop|err_too_many_redirects/i.test(combined)) {
    return 'Redirect';
  }
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    /econnrefused|econnreset|epipe|fetch failed|network/i.test(combined)
  ) {
    return 'Network';
  }
  return message.trim() || name || 'Network';
}

/** Für Server-Diagnostics: exakte Fetch-Exception (DNS/TLS/Timeout/…). */
export function captureMeinTurnierplanFetchException(err: unknown): {
  exceptionName: string;
  exceptionMessage: string;
  errorDetail: string;
} {
  if (err instanceof Error) {
    const exceptionName = err.name || 'Error';
    const exceptionMessage = err.message.trim() || 'Unknown error';
    return {
      exceptionName,
      exceptionMessage,
      errorDetail: classifyFetchException(exceptionName, exceptionMessage, err),
    };
  }
  const exceptionMessage = String(err);
  return {
    exceptionName: 'UnknownError',
    exceptionMessage,
    errorDetail: 'Network',
  };
}

function describeFetchFailure(err: unknown): string {
  return captureMeinTurnierplanFetchException(err).errorDetail;
}

/** Client → `/api/tournament-plan-analyze` (`url` immer über URLSearchParams encoded). */
export function buildTournamentPlanAnalyzeRequestUrl(
  tournamentUrl: string,
  options?: { forceHtmlFallback?: boolean },
): string {
  const trimmed = normalizeTournamentPlanUrl(tournamentUrl.trim());
  const params = new URLSearchParams();
  params.set('url', trimmed);
  if (options?.forceHtmlFallback) {
    params.set('forceHtmlFallback', '1');
  }
  const path = `/api/tournament-plan-analyze?${params.toString()}`;

  if (typeof window === 'undefined') return path;

  const origin = window.location.origin;
  if (origin && origin !== 'null' && !origin.startsWith('file:')) {
    return `${origin}${path}`;
  }

  try {
    return new URL(path, window.location.href).href;
  } catch (err) {
    console.warn('[HTML FALLBACK URL] absolute URL build failed, using relative path', {
      path,
      href: window.location.href,
      error: err instanceof Error ? err.message : String(err),
    });
    return path;
  }
}

type TournamentPlanAnalyzeApiBody = {
  ok?: boolean;
  analysis?: TournamentPlanAnalysis;
  diagnostics?: TournamentPlanAnalyzeDiagnostics;
  error?: string;
  code?: TournamentPlanAnalyzeErrorCode;
  message?: string;
  provider?: TournamentPlanProvider;
  extractedId?: string | null;
  attemptedEndpoints?: string[];
};

function logHtmlFallbackRequestUrl(url: string): void {
  console.log('[HTML FALLBACK URL]', url);
  console.log('HTML Fallback Request URL:', url);
}

async function fetchTournamentPlanAnalyzeApi(
  requestUrl: string,
  context: string,
  timeoutMs: number,
): Promise<{ res: Response; body: TournamentPlanAnalyzeApiBody }> {
  logHtmlFallbackRequestUrl(requestUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(requestUrl, { signal: controller.signal });
    const contentType = res.headers.get('content-type');
    console.log('HTML Fallback Response Status:', res.status);
    console.log('HTML Fallback Response Content-Type:', contentType ?? '—');
    const rawText = await res.text();
    let body: TournamentPlanAnalyzeApiBody;
    try {
      body = JSON.parse(rawText) as TournamentPlanAnalyzeApiBody;
    } catch (parseErr) {
      logHtmlFallbackFetchError(`${context} (json parse)`, parseErr);
      throw new TournamentPlanAnalyzeNonJsonResponseError(
        res.status,
        contentType,
        rawText.slice(0, 300),
      );
    }
    return { res, body };
  } catch (err) {
    if (!(err instanceof TournamentPlanAnalyzeNonJsonResponseError)) {
      logHtmlFallbackFetchError(context, err);
    }
    if (isAnalyzeTimeoutError(err)) {
      throw Object.assign(new Error(TOURNAMENT_ANALYZE_TIMEOUT_MESSAGE), { name: 'AbortError' });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isAnalyzeTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return true;
  return err.message.trim() === TOURNAMENT_ANALYZE_TIMEOUT_MESSAGE;
}

async function runAnalyzeStageWithTimeout<T>(
  ms: number,
  run: () => Promise<T>,
): Promise<{ timedOut: false; value: T } | { timedOut: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      run().then((value) => ({ timedOut: false as const, value })),
      new Promise<{ timedOut: true }>((resolve) => {
        timer = setTimeout(() => resolve({ timedOut: true }), ms);
      }),
    ]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildAnalyzeTimeoutFailure(
  trimmed: string,
  lastStep: TournamentPlanAnalyzeLastStep,
  extra?: Partial<{
    browserFallbackAttempted: boolean;
    browserFallbackError: string | null;
    htmlFallbackAttempted: boolean;
    htmlFallbackError: string | null;
    showitPageReachable: boolean | null;
  }>,
): TournamentPlanAnalyzeFailure {
  const extractedId = extractMeinTurnierplanId(trimmed);
  return buildTournamentPlanAnalyzeFailure({
    code: 'api_unreachable',
    message: TOURNAMENT_ANALYZE_TIMEOUT_MESSAGE,
    extractedId,
    attemptedEndpoints: extractedId ? buildMeinTurnierplanJsonEndpoints(extractedId) : [],
    apiReachable: false,
    linkRecognized: isSupportedTournamentPlanHost(trimmed),
    idExtracted: Boolean(extractedId),
    analyzeTimedOut: true,
    analyzeLastStep: lastStep,
    source:
      lastStep === 'html_fallback'
        ? 'html_fallback'
        : lastStep === 'browser_fallback'
          ? 'browser_fallback'
          : 'server_api',
    fallbackStage:
      lastStep === 'html_fallback' ? 'html' : lastStep === 'browser_fallback' ? 'json' : 'json',
    ...extra,
  });
}

function logHtmlFallbackFetchError(context: string, err: unknown): void {
  if (err instanceof Error) {
    console.error(`[HTML FALLBACK FETCH ERROR] ${context}`, {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    return;
  }
  console.error(`[HTML FALLBACK FETCH ERROR] ${context}`, { value: String(err) });
}

export function formatEndpointAttemptSummary(attempt: TournamentPlanEndpointAttempt): string {
  if (attempt.networkError) {
    const parts = [attempt.errorDetail ?? 'Network'];
    if (attempt.exceptionName) parts.push(attempt.exceptionName);
    if (attempt.exceptionMessage && attempt.exceptionMessage !== attempt.exceptionName) {
      parts.push(attempt.exceptionMessage);
    }
    return parts.join(' · ');
  }
  if (attempt.httpStatus != null && (attempt.httpStatus < 200 || attempt.httpStatus >= 300)) {
    const redirect =
      attempt.finalUrl && attempt.finalUrl !== attempt.endpoint
        ? ` → ${attempt.finalUrl}`
        : '';
    return `HTTP ${attempt.httpStatus}${redirect}`;
  }
  if (attempt.parseCode && attempt.parseCode !== 'ok') return attempt.parseCode;
  if (attempt.httpStatus != null) {
    const redirect =
      attempt.finalUrl && attempt.finalUrl !== attempt.endpoint
        ? ` → ${attempt.finalUrl}`
        : '';
    return `HTTP ${attempt.httpStatus}${redirect}`;
  }
  return '—';
}

function summarizeEndpointAttempts(attempts: TournamentPlanEndpointAttempt[] | undefined): string | null {
  if (!attempts?.length) return null;
  return attempts
    .map((attempt) => `${attempt.endpoint} → ${formatEndpointAttemptSummary(attempt)}`)
    .join('; ');
}

export function resolveFinalImportFailureCode(params: {
  code: TournamentPlanAnalyzeErrorCode;
  showitPageReachable: boolean | null;
  linkRecognized: boolean;
  idExtracted: boolean;
}): TournamentPlanAnalyzeErrorCode {
  if (
    params.linkRecognized &&
    params.idExtracted &&
    params.showitPageReachable === true &&
    (params.code === 'api_unreachable' ||
      params.code === 'parse_failed' ||
      params.code === 'plan_no_longer_provided')
  ) {
    return 'import_data_unavailable';
  }
  return params.code;
}

async function fetchMeinTurnierplanWithTimeout(
  endpoint: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEIN_TURNIERPLAN_FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(endpoint, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkShowitPageReachable(
  showitUrl: string,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    const res = await fetchMeinTurnierplanWithTimeout(
      showitUrl,
      {
        method: 'GET',
        headers: buildMeinTurnierplanFetchHeaders(showitUrl),
      },
      fetchImpl,
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function messageForTournamentPlanAnalyzeCode(code: TournamentPlanAnalyzeErrorCode): string {
  switch (code) {
    case 'unsupported_host':
      return TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE;
    case 'id_not_found':
      return 'Turnier-ID konnte aus dem Link nicht gelesen werden.';
    case 'import_data_unavailable':
      return TOURNAMENT_IMPORT_DATA_UNAVAILABLE_MESSAGE;
    case 'api_unreachable':
      return 'Die Turnierplan-API von MeinTurnierplan ist nicht erreichbar.';
    case 'no_groups':
      return 'Keine Gruppen gefunden.';
    case 'no_teams':
      return 'Keine Teams im Turnierplan gefunden.';
    case 'no_matches':
      return 'Keine Spiele gefunden.';
    case 'plan_no_longer_provided':
      return 'Turnierplan wird von diesem Link nicht mehr bereitgestellt.';
    case 'plan_incomplete':
      return TOURNAMENT_IMPORT_PLAN_INCOMPLETE_MESSAGE;
    case 'parse_failed':
    default:
      return TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE;
  }
}

function buildNonJsonHtmlFallbackFailure(
  trimmed: string,
  requestUrl: string,
  err: TournamentPlanAnalyzeNonJsonResponseError,
  browserFailure: TournamentPlanAnalyzeFailure,
  browserFallbackError: string | null,
): TournamentPlanAnalyzeFailure {
  const extractedId = extractMeinTurnierplanId(trimmed);
  return {
    code: 'html_fallback_server_error',
    message: TOURNAMENT_ANALYZE_NON_JSON_MESSAGE,
    provider: 'meinturnierplan',
    extractedId,
    attemptedEndpoints: extractedId ? buildMeinTurnierplanJsonEndpoints(extractedId) : [],
    diagnostics: {
      ...browserFailure.diagnostics,
      linkRecognized: isSupportedTournamentPlanHost(trimmed),
      idExtracted: Boolean(extractedId),
      extractedId,
      apiReachable: false,
      provider: 'meinturnierplan',
      attemptedEndpoints: extractedId ? buildMeinTurnierplanJsonEndpoints(extractedId) : [],
      browserFallbackAttempted: true,
      browserFallbackError,
      htmlFallbackAttempted: true,
      htmlFallbackSuccessful: false,
      htmlFallbackError: TOURNAMENT_ANALYZE_NON_JSON_MESSAGE,
      htmlFallbackRequestUrl: requestUrl,
      htmlFallbackResponseStatus: err.status,
      htmlFallbackResponseContentType: err.contentType,
      rawResponsePreview: err.rawResponsePreview,
      fallbackStage: 'html',
      source: 'html_fallback',
      analyzeLastStep: 'html_fallback',
    },
  };
}

/** Rohdaten vor parseMeinTurnierplanJson prüfen (genauere Fehlercodes). */
export function diagnoseMeinTurnierplanPayload(data: unknown): TournamentPlanAnalyzeErrorCode | 'ok' {
  if (data == null || typeof data !== 'object') {
    return 'plan_no_longer_provided';
  }
  const json = data as MeinTurnierplanJson;
  if (!json.participants || typeof json.participants !== 'object') {
    return 'plan_no_longer_provided';
  }
  const participants = json.participants;
  if (!Array.isArray(json.groups) || json.groups.length === 0) {
    return 'no_groups';
  }

  let teamCount = 0;
  for (let groupIndex = 0; groupIndex < json.groups.length; groupIndex += 1) {
    const participantIds = json.groupParticipants?.[groupIndex] ?? [];
    for (const participantId of participantIds) {
      const teamName = participantName(participants, participantId);
      if (teamName) teamCount += 1;
    }
  }
  if (teamCount === 0) return 'no_teams';

  const groupMatchCount = (json.groupMatches ?? []).filter((m) => {
    const home = participantName(participants, m.homeParticipant);
    const away = participantName(participants, m.awayParticipant);
    return Boolean(home && away);
  }).length;
  const finalMatchCount = (json.finalMatches ?? []).filter((m) => {
    const home = participantName(participants, m.homeParticipant);
    const away = participantName(participants, m.awayParticipant);
    return Boolean(home && away);
  }).length;
  if (groupMatchCount + finalMatchCount === 0) return 'no_matches';

  return 'ok';
}

type FetchMeinTurnierplanAttempt = TournamentPlanEndpointAttempt;

export async function fetchMeinTurnierplanJsonWithFallbacks(
  tournamentId: string,
  fetchImpl: typeof fetch = fetch,
  options?: { refererUrl?: string },
): Promise<
  | { ok: true; json: unknown; endpoint: string; attemptedEndpoints: string[]; attempts: FetchMeinTurnierplanAttempt[] }
  | {
      ok: false;
      attemptedEndpoints: string[];
      attempts: FetchMeinTurnierplanAttempt[];
      apiReachable: boolean;
      code: TournamentPlanAnalyzeErrorCode;
    }
> {
  const attemptedEndpoints = buildMeinTurnierplanJsonEndpoints(tournamentId);
  const refererUrl = options?.refererUrl ?? buildMeinTurnierplanShowitUrl(tournamentId);
  const attempts: FetchMeinTurnierplanAttempt[] = [];
  let apiReachable = false;
  let bestFailureCode: TournamentPlanAnalyzeErrorCode = 'plan_no_longer_provided';

  for (const endpoint of attemptedEndpoints) {
    const attempt: FetchMeinTurnierplanAttempt = {
      endpoint,
      finalUrl: null,
      httpStatus: null,
      networkError: false,
      errorDetail: null,
      exceptionName: null,
      exceptionMessage: null,
      parseCode: null,
    };
    attempts.push(attempt);

    try {
      const res = await fetchMeinTurnierplanWithTimeout(
        endpoint,
        {
          headers: buildMeinTurnierplanFetchHeaders(refererUrl),
        },
        fetchImpl,
      );
      attempt.finalUrl = res.url?.trim() || endpoint;
      attempt.httpStatus = res.status;
      apiReachable = true;

      if (!res.ok) {
        attempt.errorDetail = `HTTP ${res.status}`;
        if (res.status >= 500) bestFailureCode = 'api_unreachable';
        continue;
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch (jsonErr) {
        const captured = captureMeinTurnierplanFetchException(jsonErr);
        attempt.parseCode = 'parse_failed';
        attempt.errorDetail = 'JSON parse failed';
        attempt.exceptionName = captured.exceptionName;
        attempt.exceptionMessage = captured.exceptionMessage;
        bestFailureCode = 'parse_failed';
        continue;
      }

      const diagnose = diagnoseMeinTurnierplanPayload(json);
      attempt.parseCode = diagnose;
      if (diagnose !== 'ok') {
        attempt.errorDetail = diagnose;
        if (diagnose === 'no_groups' || diagnose === 'no_teams' || diagnose === 'no_matches') {
          bestFailureCode = diagnose;
        } else if (diagnose === 'plan_no_longer_provided') {
          bestFailureCode = diagnose;
        }
        continue;
      }

      const analysis = parseMeinTurnierplanJson(json);
      if (analysis) {
        return { ok: true, json, endpoint, attemptedEndpoints, attempts };
      }
      attempt.parseCode = 'parse_failed';
      attempt.errorDetail = 'parse_failed';
      bestFailureCode = 'parse_failed';
    } catch (err) {
      const captured = captureMeinTurnierplanFetchException(err);
      attempt.networkError = true;
      attempt.errorDetail = captured.errorDetail;
      attempt.exceptionName = captured.exceptionName;
      attempt.exceptionMessage = captured.exceptionMessage;
    }
  }

  const code: TournamentPlanAnalyzeErrorCode = apiReachable ? bestFailureCode : 'api_unreachable';
  return { ok: false, attemptedEndpoints, attempts, apiReachable, code };
}

export function buildTournamentPlanAnalyzeFailure(params: {
  code: TournamentPlanAnalyzeErrorCode;
  message?: string;
  extractedId: string | null;
  attemptedEndpoints: string[];
  endpointAttempts?: TournamentPlanEndpointAttempt[];
  apiReachable: boolean;
  linkRecognized: boolean;
  idExtracted: boolean;
  showitPageReachable?: boolean | null;
  browserFallbackAttempted?: boolean;
  browserFallbackError?: string | null;
  htmlFallbackAttempted?: boolean;
  htmlFallbackSuccessful?: boolean;
  htmlFallbackTeamsFound?: number;
  htmlFallbackMatchesFound?: number;
  htmlFallbackError?: string | null;
  htmlFallbackException?: MeinTurnierplanHtmlFallbackException | null;
  tournamentName?: string | null;
  serverException?: { name: string; message: string } | null;
  fetchRuntime?: TournamentPlanFetchRuntimeDiagnostics;
  source?: TournamentPlanAnalyzeDataSource;
  fallbackStage?: TournamentPlanAnalyzeFallbackStage;
  analyzeTimedOut?: boolean;
  analyzeLastStep?: TournamentPlanAnalyzeLastStep;
  htmlFallbackResponseContentType?: string | null;
  rawResponsePreview?: string | null;
  originalUrl?: string | null;
  normalizedUrl?: string | null;
  finalRedirectUrl?: string | null;
  idDetectionSource?: MeinTurnierplanIdSource | TournamentLiveIdSource | null;
  provider?: TournamentPlanProvider;
  detectedTeamCount?: number;
  detectedMatchCount?: number;
}): TournamentPlanAnalyzeFailure {
  const resolvedCode = resolveFinalImportFailureCode({
    code: params.code,
    showitPageReachable: params.showitPageReachable ?? null,
    linkRecognized: params.linkRecognized,
    idExtracted: params.idExtracted,
  });
  const provider = params.provider ?? 'meinturnierplan';
  return {
    code: resolvedCode,
    message: params.message ?? messageForTournamentPlanAnalyzeCode(resolvedCode),
    provider,
    extractedId: params.extractedId,
    attemptedEndpoints: params.attemptedEndpoints,
    diagnostics: {
      linkRecognized: params.linkRecognized,
      idExtracted: params.idExtracted,
      extractedId: params.extractedId,
      apiReachable: params.apiReachable,
      provider,
      attemptedEndpoints: params.attemptedEndpoints,
      endpointAttempts: params.endpointAttempts,
      showitPageReachable: params.showitPageReachable ?? null,
      browserFallbackAttempted: params.browserFallbackAttempted,
      browserFallbackError: params.browserFallbackError ?? null,
      htmlFallbackAttempted: params.htmlFallbackAttempted,
      htmlFallbackSuccessful: params.htmlFallbackSuccessful,
      htmlFallbackTeamsFound: params.htmlFallbackTeamsFound,
      htmlFallbackMatchesFound: params.htmlFallbackMatchesFound,
      htmlFallbackError: params.htmlFallbackError ?? null,
      htmlFallbackException: params.htmlFallbackException ?? null,
      tournamentName: params.tournamentName ?? null,
      serverException: params.serverException ?? null,
      fetchRuntime: params.fetchRuntime,
      source: params.source,
      fallbackStage: params.fallbackStage,
      analyzeTimedOut: params.analyzeTimedOut,
      analyzeLastStep: params.analyzeLastStep,
      htmlFallbackResponseContentType: params.htmlFallbackResponseContentType ?? null,
      rawResponsePreview: params.rawResponsePreview ?? null,
      originalUrl: params.originalUrl ?? null,
      normalizedUrl: params.normalizedUrl ?? null,
      finalRedirectUrl: params.finalRedirectUrl ?? null,
      idDetectionSource: params.idDetectionSource ?? null,
      detectedTeamCount: params.detectedTeamCount,
      detectedMatchCount: params.detectedMatchCount,
    },
  };
}

function analyzeTrace(message: string, detail?: Record<string, unknown>): void {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    if (detail) console.warn(message, detail);
    else console.warn(message);
  }
}

const HTML_FALLBACK_AFTER_JSON_CODES = new Set<TournamentPlanAnalyzeErrorCode>([
  'api_unreachable',
  'import_data_unavailable',
  'parse_failed',
  'no_groups',
  'no_teams',
  'no_matches',
  'plan_no_longer_provided',
]);

const BROWSER_FALLBACK_AFTER_SERVER_CODES = HTML_FALLBACK_AFTER_JSON_CODES;

function mergeHtmlFallbackDiagnostics(
  ...sources: Array<TournamentPlanAnalyzeDiagnostics | undefined | null>
): Pick<
  TournamentPlanAnalyzeDiagnostics,
  | 'htmlFallbackAttempted'
  | 'htmlFallbackSuccessful'
  | 'htmlFallbackTeamsFound'
  | 'htmlFallbackMatchesFound'
  | 'htmlFallbackError'
  | 'htmlFallbackException'
  | 'tournamentName'
  | 'fallbackStage'
> {
  const list = sources.filter((s): s is TournamentPlanAnalyzeDiagnostics => Boolean(s));
  const successful = list.find((s) => s.htmlFallbackSuccessful);
  if (successful) {
    return {
      htmlFallbackAttempted: true,
      htmlFallbackSuccessful: true,
      htmlFallbackTeamsFound: successful.htmlFallbackTeamsFound,
      htmlFallbackMatchesFound: successful.htmlFallbackMatchesFound,
      htmlFallbackError: null,
      htmlFallbackException: null,
      tournamentName: successful.tournamentName ?? null,
      fallbackStage: 'html',
    };
  }

  const attemptedSources = list.filter((s) => s.htmlFallbackAttempted);
  if (attemptedSources.length > 0) {
    const last = attemptedSources[attemptedSources.length - 1];
    const htmlFallbackException =
      [...attemptedSources].reverse().find((s) => s.htmlFallbackException)?.htmlFallbackException ?? null;
    return {
      htmlFallbackAttempted: true,
      htmlFallbackSuccessful: false,
      htmlFallbackTeamsFound: last.htmlFallbackTeamsFound,
      htmlFallbackMatchesFound: last.htmlFallbackMatchesFound,
      htmlFallbackError: last.htmlFallbackError ?? MEIN_TURNIERPLAN_HTML_FALLBACK_EMPTY_MESSAGE,
      htmlFallbackException,
      tournamentName: last.tournamentName ?? null,
      fallbackStage: 'html',
    };
  }

  return {
    htmlFallbackAttempted: false,
    htmlFallbackSuccessful: false,
    htmlFallbackError: null,
    htmlFallbackException: null,
    tournamentName: null,
    fallbackStage: 'browser',
  };
}

export async function tryMeinTurnierplanHtmlFallbackAnalyze(params: {
  showitUrl: string;
  extractedId: string;
  fetchImpl: typeof fetch;
  attemptedEndpoints: string[];
  endpointAttempts?: TournamentPlanEndpointAttempt[];
  apiReachable: boolean;
  showitPageReachable: boolean | null;
}): Promise<
  | { ok: true; analysis: TournamentPlanAnalysis; diagnostics: TournamentPlanAnalyzeDiagnostics }
  | { ok: false; error: string; htmlFallbackException?: MeinTurnierplanHtmlFallbackException | null }
> {
  analyzeTrace('[ANALYZE] START HTML FALLBACK', {
    showitUrl: params.showitUrl,
    extractedId: params.extractedId,
  });

  const htmlFetch = await fetchMeinTurnierplanShowitPageHtml(params.showitUrl, params.fetchImpl);
  if (!htmlFetch.ok) {
    analyzeTrace('[ANALYZE] HTML FETCH FAILED', {
      error: htmlFetch.error,
      exception: htmlFetch.exception,
    });
    return {
      ok: false,
      error: htmlFetch.error,
      htmlFallbackException: htmlFetch.exception,
    };
  }
  analyzeTrace('[ANALYZE] HTML FETCH SUCCESS');

  const embedded = extractMeinTurnierplanJsonFromShowitHtml(htmlFetch.html, params.extractedId);
  const analysis = parseMeinTurnierplanHtml(htmlFetch.html, params.extractedId);
  if (analysis) {
    analyzeTrace('[ANALYZE] HTML PARSE SUCCESS', {
      teams: analysis.teamCount,
      matches: analysis.preliminaryMatchCount,
    });
    return {
      ok: true,
      analysis,
      diagnostics: {
        linkRecognized: true,
        idExtracted: true,
        extractedId: params.extractedId,
        apiReachable: params.apiReachable,
        provider: 'meinturnierplan',
        attemptedEndpoints: params.attemptedEndpoints,
        endpointAttempts: params.endpointAttempts,
        showitPageReachable: params.showitPageReachable ?? true,
        htmlFallbackAttempted: true,
        htmlFallbackSuccessful: true,
        htmlFallbackTeamsFound: analysis.teamCount,
        htmlFallbackMatchesFound: analysis.preliminaryMatchCount,
        htmlFallbackError: null,
        tournamentName: embedded.ok ? embedded.tournamentName : null,
        source: 'html_fallback',
        fallbackStage: 'html',
      },
    };
  }

  analyzeTrace('[ANALYZE] HTML PARSE FAILED');
  return { ok: false, error: MEIN_TURNIERPLAN_HTML_FALLBACK_EMPTY_MESSAGE };
}

export type AnalyzeMeinTurnierplanUrlResult =
  | { ok: true; analysis: TournamentPlanAnalysis; diagnostics: TournamentPlanAnalyzeDiagnostics }
  | { ok: false; failure: TournamentPlanAnalyzeFailure; httpStatus: number };

export type AnalyzeMeinTurnierplanUrlOptions = {
  /** Browser: kein showit.php (CORS) — HTML nur serverseitig. */
  skipHtmlFallback?: boolean;
};

export async function analyzeMeinTurnierplanUrlForceHtmlFallback(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnalyzeMeinTurnierplanUrlResult> {
  const trimmed = url.trim();
  const linkRecognized = Boolean(trimmed) && isSupportedTournamentPlanHost(trimmed);

  if (!linkRecognized) {
    const failure = buildTournamentPlanAnalyzeFailure({
      code: 'unsupported_host',
      extractedId: null,
      attemptedEndpoints: [],
      apiReachable: false,
      linkRecognized: false,
      idExtracted: false,
      fallbackStage: 'html',
    });
    return { ok: false, failure, httpStatus: 422 };
  }

  const urlResolution = await resolveMeinTurnierplanTournamentId(trimmed, fetchImpl);
  const urlDiag = urlResolutionDiagnostics(urlResolution);
  const extractedId = urlResolution.detectedId;

  if (!extractedId) {
    const failure = buildTournamentPlanAnalyzeFailure({
      code: 'id_not_found',
      extractedId: null,
      attemptedEndpoints: [],
      apiReachable: false,
      linkRecognized: true,
      idExtracted: false,
      fallbackStage: 'html',
      ...urlDiag,
    });
    return { ok: false, failure, httpStatus: 422 };
  }

  const refererUrl = resolveMeinTurnierplanShowitUrl(urlResolution);
  const showitPageReachable = await checkShowitPageReachable(refererUrl, fetchImpl);
  const attemptedEndpoints = buildMeinTurnierplanJsonEndpoints(extractedId);

  analyzeTrace('[ANALYZE] FORCE SERVER HTML FALLBACK', { url: trimmed, extractedId });

  const htmlResult = await tryMeinTurnierplanHtmlFallbackAnalyze({
    showitUrl: refererUrl,
    extractedId,
    fetchImpl,
    attemptedEndpoints,
    apiReachable: false,
    showitPageReachable,
  });

  if (htmlResult.ok) {
    return {
      ok: true,
      analysis: htmlResult.analysis,
      diagnostics: {
        ...htmlResult.diagnostics,
        htmlFallbackAttempted: true,
        htmlFallbackSuccessful: true,
        fallbackStage: 'html',
        source: 'html_fallback',
      },
    };
  }

  const failure = buildTournamentPlanAnalyzeFailure({
    code: 'import_data_unavailable',
    extractedId,
    attemptedEndpoints,
    apiReachable: false,
    linkRecognized: true,
    idExtracted: true,
    showitPageReachable,
    htmlFallbackAttempted: true,
    htmlFallbackSuccessful: false,
    htmlFallbackError: htmlResult.error,
    htmlFallbackException: htmlResult.htmlFallbackException ?? null,
    source: 'html_fallback',
    fallbackStage: 'html',
  });
  return { ok: false, failure, httpStatus: 502 };
}

export async function analyzeMeinTurnierplanUrl(
  url: string,
  fetchImpl: typeof fetch = fetch,
  options?: AnalyzeMeinTurnierplanUrlOptions,
): Promise<AnalyzeMeinTurnierplanUrlResult> {
  const skipHtmlFallback = options?.skipHtmlFallback === true;
  const trimmed = url.trim();
  const linkRecognized = Boolean(trimmed) && isSupportedTournamentPlanHost(trimmed);

  if (!linkRecognized) {
    const failure = buildTournamentPlanAnalyzeFailure({
      code: 'unsupported_host',
      extractedId: null,
      attemptedEndpoints: [],
      apiReachable: false,
      linkRecognized: false,
      idExtracted: false,
    });
    return { ok: false, failure, httpStatus: 422 };
  }

  const urlResolution = await resolveMeinTurnierplanTournamentId(trimmed, fetchImpl);
  const urlDiag = urlResolutionDiagnostics(urlResolution);
  let extractedId = urlResolution.detectedId;

  if (!extractedId && !skipHtmlFallback) {
    const showitUrl = resolveMeinTurnierplanShowitUrl(urlResolution);
    const htmlFetch = await fetchMeinTurnierplanShowitPageHtml(showitUrl, fetchImpl);
    if (htmlFetch.ok) {
      const discovered = extractMeinTurnierplanIdFromHtml(htmlFetch.html);
      if (discovered) {
        extractedId = discovered.id;
        urlResolution.detectedId = discovered.id;
        urlResolution.idSource = discovered.source;
      } else {
        const visibleAnalysis = parseMeinTurnierplanVisibleHtml(htmlFetch.html);
        if (visibleAnalysis) {
          return {
            ok: true,
            analysis: visibleAnalysis,
            diagnostics: {
              linkRecognized: true,
              idExtracted: false,
              extractedId: null,
              apiReachable: false,
              provider: 'meinturnierplan',
              attemptedEndpoints: [],
              showitPageReachable: true,
              htmlFallbackAttempted: true,
              htmlFallbackSuccessful: true,
              htmlFallbackTeamsFound: visibleAnalysis.teamCount,
              htmlFallbackMatchesFound: visibleAnalysis.preliminaryMatchCount,
              source: 'html_fallback',
              fallbackStage: 'html',
              ...urlDiag,
            },
          };
        }
      }
    }
  }

  if (!extractedId) {
    const failure = buildTournamentPlanAnalyzeFailure({
      code: 'id_not_found',
      extractedId: null,
      attemptedEndpoints: [],
      apiReachable: false,
      linkRecognized: true,
      idExtracted: false,
      htmlFallbackAttempted: !skipHtmlFallback,
      ...urlDiag,
    });
    return { ok: false, failure, httpStatus: 422 };
  }

  const refererUrl = resolveMeinTurnierplanShowitUrl(urlResolution);
  const showitPageReachable = await checkShowitPageReachable(refererUrl, fetchImpl);
  const fetchResult = await fetchMeinTurnierplanJsonWithFallbacks(extractedId, fetchImpl, {
    refererUrl,
  });

  if (fetchResult.ok) {
    const analysis = parseMeinTurnierplanJson(fetchResult.json);
    if (analysis) {
      return {
        ok: true,
        analysis,
        diagnostics: {
          linkRecognized: true,
          idExtracted: true,
          extractedId,
          apiReachable: true,
          provider: 'meinturnierplan',
          attemptedEndpoints: fetchResult.attemptedEndpoints,
          endpointAttempts: fetchResult.attempts,
          showitPageReachable,
          source: 'server_api',
          fallbackStage: 'json',
          ...urlDiag,
        },
      };
    }

    analyzeTrace('[ANALYZE] JSON FAILED', { stage: 'parse', extractedId });

    if (!skipHtmlFallback) {
      const htmlAfterParse = await tryMeinTurnierplanHtmlFallbackAnalyze({
        showitUrl: refererUrl,
        extractedId,
        fetchImpl,
        attemptedEndpoints: fetchResult.attemptedEndpoints,
        endpointAttempts: fetchResult.attempts,
        apiReachable: true,
        showitPageReachable,
      });
      if (htmlAfterParse.ok) {
        return { ok: true, analysis: htmlAfterParse.analysis, diagnostics: htmlAfterParse.diagnostics };
      }

      const parseFailure = buildTournamentPlanAnalyzeFailure({
        code: 'parse_failed',
        extractedId,
        attemptedEndpoints: fetchResult.attemptedEndpoints,
        endpointAttempts: fetchResult.attempts,
        apiReachable: true,
        linkRecognized: true,
        idExtracted: true,
        showitPageReachable,
        htmlFallbackAttempted: true,
        htmlFallbackSuccessful: false,
        htmlFallbackError: htmlAfterParse.error,
        htmlFallbackException: htmlAfterParse.htmlFallbackException ?? null,
        source: 'server_api',
        fallbackStage: 'html',
      });
      return { ok: false, failure: parseFailure, httpStatus: 422 };
    }

    const parseFailure = buildTournamentPlanAnalyzeFailure({
      code: 'parse_failed',
      extractedId,
      attemptedEndpoints: fetchResult.attemptedEndpoints,
      endpointAttempts: fetchResult.attempts,
      apiReachable: true,
      linkRecognized: true,
      idExtracted: true,
      showitPageReachable,
      browserFallbackAttempted: true,
      source: 'browser_fallback',
      fallbackStage: 'json',
    });
    return { ok: false, failure: parseFailure, httpStatus: 422 };
  }

  const jsonFailureCode = fetchResult.code;
  analyzeTrace('[ANALYZE] JSON FAILED', {
    code: jsonFailureCode,
    apiReachable: fetchResult.apiReachable,
    extractedId,
  });

  if (HTML_FALLBACK_AFTER_JSON_CODES.has(jsonFailureCode)) {
    if (!skipHtmlFallback) {
      const htmlAfterJsonFail = await tryMeinTurnierplanHtmlFallbackAnalyze({
        showitUrl: refererUrl,
        extractedId,
        fetchImpl,
        attemptedEndpoints: fetchResult.attemptedEndpoints,
        endpointAttempts: fetchResult.attempts,
        apiReachable: fetchResult.apiReachable,
        showitPageReachable,
      });
      if (htmlAfterJsonFail.ok) {
        return { ok: true, analysis: htmlAfterJsonFail.analysis, diagnostics: htmlAfterJsonFail.diagnostics };
      }

      const failure = buildTournamentPlanAnalyzeFailure({
        code: jsonFailureCode,
        extractedId,
        attemptedEndpoints: fetchResult.attemptedEndpoints,
        endpointAttempts: fetchResult.attempts,
        apiReachable: fetchResult.apiReachable,
        linkRecognized: true,
        idExtracted: true,
        showitPageReachable,
        htmlFallbackAttempted: true,
        htmlFallbackSuccessful: false,
        htmlFallbackError: htmlAfterJsonFail.error,
        htmlFallbackException: htmlAfterJsonFail.htmlFallbackException ?? null,
        source: 'server_api',
        fallbackStage: 'html',
      });

      const httpStatus =
        failure.code === 'api_unreachable' || failure.code === 'import_data_unavailable' ? 502 : 422;
      return { ok: false, failure, httpStatus };
    }

    const browserJsonFailure = buildTournamentPlanAnalyzeFailure({
      code: jsonFailureCode,
      extractedId,
      attemptedEndpoints: fetchResult.attemptedEndpoints,
      endpointAttempts: fetchResult.attempts,
      apiReachable: fetchResult.apiReachable,
      linkRecognized: true,
      idExtracted: true,
      showitPageReachable,
      browserFallbackAttempted: true,
      source: 'browser_fallback',
      fallbackStage: 'json',
    });
    const httpStatus =
      browserJsonFailure.code === 'api_unreachable' || browserJsonFailure.code === 'import_data_unavailable'
        ? 502
        : 422;
    return { ok: false, failure: browserJsonFailure, httpStatus };
  }

  analyzeTrace('[ANALYZE] JSON FAILED', {
    code: fetchResult.code,
    htmlFallbackSkipped: true,
    extractedId,
  });

  const failure = buildTournamentPlanAnalyzeFailure({
    code: fetchResult.code,
    extractedId,
    attemptedEndpoints: fetchResult.attemptedEndpoints,
    endpointAttempts: fetchResult.attempts,
    apiReachable: fetchResult.apiReachable,
    linkRecognized: true,
    idExtracted: true,
    showitPageReachable,
    fallbackStage: 'json',
  });

  const httpStatus =
    failure.code === 'api_unreachable' || failure.code === 'import_data_unavailable' ? 502 : 422;
  return { ok: false, failure, httpStatus };
}

function participantName(
  participants: Record<string, MeinTurnierplanParticipant>,
  id: number | undefined,
): string {
  if (id == null) return '';
  const entry = participants[String(id)] ?? participants[id as unknown as string];
  return safeText(entry?.name);
}

function kickoffHHmmFromDateTime(dateAndTime: unknown): string {
  const raw = safeText(dateAndTime);
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return '10:00';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** MeinTurnierplan JSON: score1 = Heim, score2 = Auswärts. */
function extractMeinTurnierplanMatchScores(match: {
  score1?: string | number | null;
  score2?: string | number | null;
}): { hasResult: boolean; homeGoals: number | null; awayGoals: number | null } {
  const rawHome = match.score1;
  const rawAway = match.score2;
  const hasHome = rawHome !== null && rawHome !== undefined && String(rawHome).trim() !== '';
  const hasAway = rawAway !== null && rawAway !== undefined && String(rawAway).trim() !== '';
  if (!hasHome || !hasAway) {
    return { hasResult: false, homeGoals: null, awayGoals: null };
  }
  const homeGoals = Number.parseInt(String(rawHome).trim(), 10);
  const awayGoals = Number.parseInt(String(rawAway).trim(), 10);
  if (
    !Number.isFinite(homeGoals) ||
    !Number.isFinite(awayGoals) ||
    homeGoals < 0 ||
    awayGoals < 0
  ) {
    return { hasResult: false, homeGoals: null, awayGoals: null };
  }
  return { hasResult: true, homeGoals, awayGoals };
}

/** KO-Phase aus MeinTurnierplan modeMapping + Gruppen-Rängen (Heuristik). */
export function inferKnockoutPhaseFromMeinTurnierplan(
  modeMapping: MeinTurnierplanModeMapping | undefined,
  sourceTeam1?: MeinTurnierplanSourceTeam,
  sourceTeam2?: MeinTurnierplanSourceTeam,
): TournamentMatchPhase {
  const round = modeMapping?.round ?? 1;
  const matchNo = modeMapping?.match ?? 0;
  const rank1 = sourceTeam1?.rank ?? 0;
  const rank2 = sourceTeam2?.rank ?? 0;
  const maxRank = Math.max(rank1, rank2);
  const minRank = Math.min(rank1, rank2);

  if (round === 1 && matchNo === 1 && minRank === 1 && maxRank === 1) {
    return 'final';
  }
  if (maxRank >= 5 || matchNo >= 5) {
    return 'placement';
  }
  if (round >= 2) {
    return 'semifinal';
  }
  if (maxRank <= 2 && matchNo <= 2) {
    return 'semifinal';
  }
  if (maxRank === 3 || maxRank === 4) {
    return 'placement';
  }
  return 'unknown';
}

export function normalizeTeamMatchKey(name: unknown): string {
  return safeText(name).toLowerCase().replace(/\s+/g, ' ');
}

export function normalizePhaseForDedupe(phase: unknown): string {
  const p = safeText(phase).toLowerCase();
  if (p === 'group' || p === 'placement' || p === 'semifinal' || p === 'final' || p === 'unknown') {
    return p;
  }
  return '';
}

export function buildTournamentMatchDedupeKey(params: {
  kickoffTimeHHmm: string;
  opponentName: string;
  groupLabel: string | null;
  phase: TournamentMatchPhase | string | null | undefined;
}): string {
  const phaseKey =
    normalizePhaseForDedupe(params.phase) ||
    (safeOptionalText(params.groupLabel) ? 'group' : 'unknown');
  const groupKey =
    phaseKey === 'group' ? normalizeTeamMatchKey(params.groupLabel) : phaseKey;
  return `${params.kickoffTimeHHmm}|${normalizeTeamMatchKey(params.opponentName)}|${groupKey}`;
}

const VISIBLE_HTML_TIME_RE = /\b([01]?\d|2[0-3]):[0-5]\d\b/;
const VISIBLE_HTML_GROUP_RE = /\bGruppe\s+([A-Z0-9]+)\b/gi;
const VISIBLE_HTML_SKIP_LINE_RE =
  /^(spielplan|vorrunde|endrunde|halbfinale|finale|platzierung|ergebnis|tabelle|uhrzeit|zeit|team\s*1|team\s*2|nr\.?|#)$/i;

function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function stripHtmlForVisibleParse(html: string): string {
  return decodeBasicHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/t[dh]>/gi, '\t')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '\n'),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeVisibleTeamName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 80) return null;
  if (VISIBLE_HTML_TIME_RE.test(name) && name.length <= 5) return null;
  if (VISIBLE_HTML_SKIP_LINE_RE.test(name)) return null;
  if (/^\d+$/.test(name)) return null;
  return name;
}

function parseVisibleHtmlTableMatches(html: string): TournamentPlanImportRawMatch[] {
  const matches: TournamentPlanImportRawMatch[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      stripHtmlForVisibleParse(cell[1]),
    );
    if (cells.length < 3) continue;

    const timeCell = cells.find((c) => VISIBLE_HTML_TIME_RE.test(c));
    if (!timeCell) continue;
    const kickoffTimeHHmm = timeCell.match(VISIBLE_HTML_TIME_RE)?.[0] ?? '';
    if (!kickoffTimeHHmm) continue;

    const teamCells = cells
      .map((c) => normalizeVisibleTeamName(c))
      .filter((c): c is string => Boolean(c))
      .filter((c) => !VISIBLE_HTML_TIME_RE.test(c));

    if (teamCells.length < 2) continue;
    const homeTeam = teamCells[0];
    const awayTeam = teamCells[1];
    matches.push({
      homeTeam,
      awayTeam,
      groupLabel: null,
      phase: 'group',
      kickoffTimeHHmm,
      plannedMinutes: 10,
      pitch: null,
      hasResult: false,
      homeGoals: null,
      awayGoals: null,
    });
  }
  return matches;
}

function parseVisibleHtmlTextBlocks(text: string): {
  teams: TournamentPlanImportTeam[];
  groupSummaries: TournamentPlanGroupSummary[];
  rawMatches: TournamentPlanImportRawMatch[];
} {
  const teams: TournamentPlanImportTeam[] = [];
  const groupSummaries: TournamentPlanGroupSummary[] = [];
  const rawMatches: TournamentPlanImportRawMatch[] = [];
  const teamNames = new Set<string>();

  const groupSections: Array<{ label: string; body: string }> = [];
  let lastIndex = 0;
  let groupMatch: RegExpExecArray | null;
  VISIBLE_HTML_GROUP_RE.lastIndex = 0;
  while ((groupMatch = VISIBLE_HTML_GROUP_RE.exec(text)) !== null) {
    if (groupSections.length > 0) {
      groupSections[groupSections.length - 1].body = text.slice(lastIndex, groupMatch.index);
    }
    groupSections.push({ label: groupMatch[1].trim(), body: '' });
    lastIndex = groupMatch.index + groupMatch[0].length;
  }
  if (groupSections.length > 0) {
    groupSections[groupSections.length - 1].body = text.slice(lastIndex);
  }

  const sections =
    groupSections.length > 0 ? groupSections : [{ label: '', body: text }];

  for (const section of sections) {
    const groupLabel = section.label || null;
    let teamCountInGroup = 0;
    const lines = section.body
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const timeMatch = line.match(VISIBLE_HTML_TIME_RE);
      if (timeMatch) {
        const kickoffTimeHHmm = timeMatch[0];
        const rest = line.slice(timeMatch.index! + kickoffTimeHHmm.length).trim();
        const parts = rest
          .split(/\s+[-–—vs.]+\s+|\s{2,}/i)
          .map((p) => normalizeVisibleTeamName(p))
          .filter((p): p is string => Boolean(p));
        if (parts.length >= 2) {
          rawMatches.push({
            homeTeam: parts[0],
            awayTeam: parts[1],
            groupLabel,
            phase: 'group',
            kickoffTimeHHmm,
            plannedMinutes: 10,
            pitch: null,
            hasResult: false,
            homeGoals: null,
            awayGoals: null,
          });
          for (const name of parts) teamNames.add(name);
        }
        continue;
      }

      if (/vorrunde|spielplan|endrunde|ergebnis|tabelle/i.test(line)) continue;
      const teamName = normalizeVisibleTeamName(line);
      if (!teamName || teamNames.has(teamName)) continue;
      teamNames.add(teamName);
      teams.push({ teamName, groupLabel });
      teamCountInGroup += 1;
    }

    if (groupLabel && teamCountInGroup > 0) {
      groupSummaries.push({ label: groupLabel, teamCount: teamCountInGroup });
    }
  }

  return { teams, groupSummaries, rawMatches };
}

function parseMeinTurnierplanVisibleHtml(html: string): TournamentPlanAnalysis | null {
  const tableMatches = parseVisibleHtmlTableMatches(html);
  const plainText = stripHtmlForVisibleParse(html);
  const textParsed = parseVisibleHtmlTextBlocks(plainText);

  const teams = textParsed.teams;
  const groupSummaries = textParsed.groupSummaries;
  const rawMatches = [...textParsed.rawMatches];

  for (const match of tableMatches) {
    const key = `${match.kickoffTimeHHmm}|${match.homeTeam}|${match.awayTeam}`;
    if (rawMatches.some((m) => `${m.kickoffTimeHHmm}|${m.homeTeam}|${m.awayTeam}` === key)) {
      continue;
    }
    rawMatches.push(match);
    if (!teams.some((t) => t.teamName === match.homeTeam)) {
      teams.push({ teamName: match.homeTeam, groupLabel: match.groupLabel });
    }
    if (!teams.some((t) => t.teamName === match.awayTeam)) {
      teams.push({ teamName: match.awayTeam, groupLabel: match.groupLabel });
    }
  }

  if (teams.length === 0 || rawMatches.length === 0) return null;

  const summaries =
    groupSummaries.length > 0
      ? groupSummaries
      : [{ label: '1', teamCount: teams.length }];

  return {
    provider: 'meinturnierplan',
    teamCount: teams.length,
    groupCount: summaries.length,
    matchCount: rawMatches.length,
    preliminaryMatchCount: rawMatches.length,
    knockoutMatchCount: 0,
    groupSummaries: summaries,
    teams,
    rawMatches,
  };
}

/**
 * HTML-Fallback: zuerst eingebettetes preloadedState (wie json.php), sonst sichtbare Tabellen/Texte.
 */
export function parseMeinTurnierplanHtml(html: string, tournamentId: string): TournamentPlanAnalysis | null {
  const slug = tournamentId?.trim();
  if (!slug || !html?.trim()) return null;

  const embedded = extractMeinTurnierplanJsonFromShowitHtml(html, slug);
  if (embedded.ok) {
    const fromJson = parseMeinTurnierplanJson(embedded.tournamentJson);
    if (fromJson) return fromJson;
  }

  return parseMeinTurnierplanVisibleHtml(html);
}

export function parseMeinTurnierplanJson(data: unknown): TournamentPlanAnalysis | null {
  const json = data as MeinTurnierplanJson;
  if (!json?.participants || typeof json.participants !== 'object' || !Array.isArray(json.groups) || json.groups.length === 0) {
    return null;
  }

  const participants = json.participants;
  const teams: TournamentPlanImportTeam[] = [];
  const groupSummaries: TournamentPlanGroupSummary[] = [];

  for (let groupIndex = 0; groupIndex < json.groups.length; groupIndex += 1) {
    const displayId = safeText(json.groups[groupIndex]?.displayId);
    const label = displayId || String(groupIndex + 1);
    const participantIds = json.groupParticipants?.[groupIndex] ?? [];
    let teamCountInGroup = 0;

    for (const participantId of participantIds) {
      const teamName = participantName(participants, participantId);
      if (!teamName) continue;
      teams.push({ teamName, groupLabel: label });
      teamCountInGroup += 1;
    }

    if (teamCountInGroup > 0) {
      groupSummaries.push({ label, teamCount: teamCountInGroup });
    }
  }

  if (teams.length === 0) return null;

  const groupMinutes = Math.max(
    1,
    Math.min(120, Math.trunc(json.groupMatchDuration ?? 10) || 10),
  );
  const knockoutMinutes = Math.max(
    1,
    Math.min(120, Math.trunc(json.finalMatchDuration ?? json.groupMatchDuration ?? 10) || 10),
  );
  const courts = json.courts ?? [];
  const rawMatches: TournamentPlanImportRawMatch[] = [];

  for (const match of json.groupMatches ?? []) {
    const homeTeam = participantName(participants, match.homeParticipant);
    const awayTeam = participantName(participants, match.awayParticipant);
    if (!homeTeam || !awayTeam) continue;

    const groupIdx = match.groupId ?? 0;
    const groupLabel = safeOptionalText(json.groups[groupIdx]?.displayId);
    const court = courts[match.courtId ?? -1];
    const pitchDisplay = safeOptionalText(court?.displayId);
    const pitch = pitchDisplay ? `Platz ${pitchDisplay}` : null;

    const scores = extractMeinTurnierplanMatchScores(match);
    rawMatches.push({
      homeTeam,
      awayTeam,
      groupLabel,
      phase: 'group',
      kickoffTimeHHmm: kickoffHHmmFromDateTime(match.dateAndTime),
      plannedMinutes: groupMinutes,
      pitch,
      hasResult: scores.hasResult,
      homeGoals: scores.homeGoals,
      awayGoals: scores.awayGoals,
      externalMatchId: `mtp-g-${match.homeParticipant ?? ''}-${match.awayParticipant ?? ''}-${kickoffHHmmFromDateTime(match.dateAndTime)}`,
    });
  }

  const preliminaryMatchCount = rawMatches.length;

  for (const match of json.finalMatches ?? []) {
    const homeTeam = participantName(participants, match.homeParticipant);
    const awayTeam = participantName(participants, match.awayParticipant);
    if (!homeTeam || !awayTeam) continue;

    const phase = inferKnockoutPhaseFromMeinTurnierplan(
      match.modeMapping,
      match.sourceTeam1,
      match.sourceTeam2,
    );
    const court = courts[match.courtId ?? -1];
    const pitchDisplay = safeOptionalText(court?.displayId);
    const pitch = pitchDisplay ? `Platz ${pitchDisplay}` : null;
    const scores = extractMeinTurnierplanMatchScores(match);

    rawMatches.push({
      homeTeam,
      awayTeam,
      groupLabel: null,
      phase,
      kickoffTimeHHmm: kickoffHHmmFromDateTime(match.dateAndTime),
      plannedMinutes: knockoutMinutes,
      pitch,
      hasResult: scores.hasResult,
      homeGoals: scores.homeGoals,
      awayGoals: scores.awayGoals,
      externalMatchId: `mtp-ko-${match.homeParticipant ?? ''}-${match.awayParticipant ?? ''}-${kickoffHHmmFromDateTime(match.dateAndTime)}`,
    });
  }

  const knockoutMatchCount = rawMatches.length - preliminaryMatchCount;

  return {
    provider: 'meinturnierplan',
    teamCount: teams.length,
    groupCount: groupSummaries.length,
    matchCount: rawMatches.length,
    preliminaryMatchCount,
    knockoutMatchCount,
    groupSummaries,
    teams,
    rawMatches,
  };
}

export function findOwnTeamInImport(
  teams: TournamentPlanImportTeam[],
  knownNames: string[],
): string | null {
  if (knownNames.length === 0) return null;

  for (const team of teams) {
    if (isTeamAliasMatch(team.teamName, knownNames)) {
      return team.teamName;
    }
  }
  return null;
}

export function countOwnTeamMatchesInAnalysis(
  analysis: TournamentPlanAnalysis,
  knownNames: string[],
): number {
  if (knownNames.length === 0) return 0;

  let count = 0;
  for (const match of analysis.rawMatches) {
    const homeOurs = isTeamAliasMatch(match.homeTeam, knownNames);
    const awayOurs = isTeamAliasMatch(match.awayTeam, knownNames);
    if (homeOurs !== awayOurs) count += 1;
  }
  return count;
}

function mapOwnTeamGoalsFromRawMatch(
  match: TournamentPlanImportRawMatch,
  homeOurs: boolean,
): { hasResult: boolean; ourGoals: number | null; oppGoals: number | null } {
  if (!match.hasResult || match.homeGoals == null || match.awayGoals == null) {
    return { hasResult: false, ourGoals: null, oppGoals: null };
  }
  return homeOurs
    ? { hasResult: true, ourGoals: match.homeGoals, oppGoals: match.awayGoals }
    : { hasResult: true, ourGoals: match.awayGoals, oppGoals: match.homeGoals };
}

export function countAnalysisMatchResults(analysis: TournamentPlanAnalysis): {
  withResult: number;
  withoutResult: number;
} {
  let withResult = 0;
  for (const match of analysis.rawMatches) {
    if (match.hasResult) withResult += 1;
  }
  return { withResult, withoutResult: analysis.rawMatches.length - withResult };
}

export function listOwnTeamMatchesForImportPreview(
  analysis: TournamentPlanAnalysis,
  knownNames: string[],
): TournamentPlanOwnMatchPreview[] {
  if (knownNames.length === 0) return [];

  const previews: TournamentPlanOwnMatchPreview[] = [];
  for (const match of analysis.rawMatches) {
    const homeOurs = isTeamAliasMatch(match.homeTeam, knownNames);
    const awayOurs = isTeamAliasMatch(match.awayTeam, knownNames);
    let opponentName: string | null = null;

    if (homeOurs && !awayOurs) opponentName = match.awayTeam;
    else if (awayOurs && !homeOurs) opponentName = match.homeTeam;
    if (!opponentName) continue;

    const goals = mapOwnTeamGoalsFromRawMatch(match, homeOurs);
    previews.push({
      opponentName,
      kickoffTimeHHmm: match.kickoffTimeHHmm,
      hasResult: goals.hasResult,
      ourGoals: goals.ourGoals,
      oppGoals: goals.oppGoals,
    });
  }
  return previews;
}

export function labelTournamentMatchPhase(phase: TournamentMatchPhase): string {
  switch (phase) {
    case 'group':
      return 'Vorrunde';
    case 'semifinal':
      return 'Halbfinale';
    case 'final':
      return 'Finale';
    case 'placement':
      return 'Platzierungsspiele';
    default:
      return 'KO';
  }
}

export function lastRecognizedPhaseLabel(analysis: TournamentPlanAnalysis): string | null {
  const rank: Record<TournamentMatchPhase, number> = {
    group: 1,
    unknown: 2,
    placement: 3,
    semifinal: 4,
    final: 5,
  };
  let best: TournamentMatchPhase | null = null;
  for (const match of analysis.rawMatches) {
    if (!best || rank[match.phase] > rank[best]) best = match.phase;
  }
  return best ? labelTournamentMatchPhase(best) : null;
}

export type TournamentPlanImportPreviewSummary = {
  tournamentName: string | null;
  teamCount: number;
  matchCount: number;
  ownTeamRecognized: boolean;
  ownTeamName: string | null;
  groups: TournamentPlanGroupSummary[];
  firstOwnMatch: TournamentPlanOwnMatchPreview | null;
  lastPhaseLabel: string | null;
};

export function buildTournamentPlanImportPreviewSummary(
  analysis: TournamentPlanAnalysis,
  knownNames: string[],
): TournamentPlanImportPreviewSummary {
  const ownTeamName = findOwnTeamInImport(analysis.teams, knownNames);
  const ownMatches = listOwnTeamMatchesForImportPreview(analysis, knownNames);
  return {
    tournamentName: analysis.tournamentName ?? null,
    teamCount: analysis.teamCount,
    matchCount: analysis.matchCount,
    ownTeamRecognized: Boolean(ownTeamName),
    ownTeamName,
    groups: analysis.groupSummaries,
    firstOwnMatch: ownMatches[0] ?? null,
    lastPhaseLabel: lastRecognizedPhaseLabel(analysis),
  };
}

export function canApplyImportedTournamentResult(slot: {
  match_status?: string | null;
  score_home?: number;
  score_away?: number;
}): boolean {
  const st = (slot.match_status ?? 'upcoming').toLowerCase();
  if (st === 'live') return false;
  if (st === 'finished') {
    const sh = Number(slot.score_home ?? 0);
    const sa = Number(slot.score_away ?? 0);
    return sh === 0 && sa === 0;
  }
  return true;
}

export function classifyPlanMatchSides(
  match: { homeTeam: string; awayTeam: string },
  knownNames: string[],
): { homeOurs: boolean; awayOurs: boolean; isOwn: boolean; opponentName: string | null } {
  const homeOurs = isTeamAliasMatch(match.homeTeam, knownNames);
  const awayOurs = isTeamAliasMatch(match.awayTeam, knownNames);
  const isOwn = homeOurs !== awayOurs;
  const opponentName = homeOurs && !awayOurs ? match.awayTeam : awayOurs && !homeOurs ? match.homeTeam : null;
  return { homeOurs, awayOurs, isOwn, opponentName };
}

export function buildOfficialExternalMatchId(
  provider: string,
  match: TournamentPlanImportRawMatch,
): string {
  const raw = safeOptionalText(match.externalMatchId);
  if (raw) return `${provider}:${raw}`;
  return `${provider}:${match.kickoffTimeHHmm}:${normalizeTeamMatchKey(match.homeTeam)}:${normalizeTeamMatchKey(match.awayTeam)}:${normalizePhaseForDedupe(match.phase) || 'unknown'}`;
}

export function buildImportMatchesForOwnTeam(
  rawMatches: TournamentPlanImportRawMatch[],
  knownNames: string[],
): TournamentPlanImportMatch[] {
  if (knownNames.length === 0) return [];

  const result: TournamentPlanImportMatch[] = [];

  for (const match of rawMatches) {
    const homeOurs = isTeamAliasMatch(match.homeTeam, knownNames);
    const awayOurs = isTeamAliasMatch(match.awayTeam, knownNames);
    let opponentName: string | null = null;

    if (homeOurs && !awayOurs) opponentName = match.awayTeam;
    else if (awayOurs && !homeOurs) opponentName = match.homeTeam;

    if (!opponentName) continue;

    const goals = mapOwnTeamGoalsFromRawMatch(match, homeOurs);

    result.push({
      opponentName,
      groupLabel: match.groupLabel,
      phase: match.phase,
      kickoffTimeHHmm: match.kickoffTimeHHmm,
      plannedMinutes: match.plannedMinutes,
      pitch: match.pitch,
      hasResult: goals.hasResult,
      ourGoals: goals.ourGoals,
      oppGoals: goals.oppGoals,
      dedupeKey: buildTournamentMatchDedupeKey({
        kickoffTimeHHmm: match.kickoffTimeHHmm,
        opponentName,
        groupLabel: match.groupLabel,
        phase: match.phase,
      }),
    });
  }

  return result;
}

export async function computeTournamentPlanRefreshPreview(params: {
  analysis: TournamentPlanAnalysis;
  existingTeamNames: string[];
  existingSlots: Array<{
    id?: string;
    opponent_name: string;
    kickoff_at: string;
    group_label: string | null;
    phase?: string | null;
    match_id?: string | null;
    match_status?: string | null;
    score_home?: number;
    score_away?: number;
    is_own_team?: boolean | null;
    external_match_id?: string | null;
    home_team?: string | null;
    away_team?: string | null;
    official_home_goals?: number | null;
    official_away_goals?: number | null;
  }>;
  knownNames?: string[];
}): Promise<TournamentPlanRefreshPreview> {
  const { formatTournamentKickoffTime } = await import('./tournamentPlan');

  const existingTeamKeys = new Set(params.existingTeamNames.map(normalizeTeamMatchKey));
  let newTeams = 0;
  for (const team of params.analysis.teams) {
    if (!existingTeamKeys.has(normalizeTeamMatchKey(team.teamName))) {
      newTeams += 1;
    }
  }

  const knownNames = params.knownNames ?? [];
  const provider = params.analysis.provider;
  const resultCounts = countAnalysisMatchResults(params.analysis);
  const usedSlotIds = new Set<string>();

  let newMatches = 0;
  let existingMatches = 0;
  let resultUpdates = 0;

  for (const match of params.analysis.rawMatches) {
    const sides = classifyPlanMatchSides(match, knownNames);
    const externalId = buildOfficialExternalMatchId(provider, match);
    const existingSlot = params.existingSlots.find((slot) => {
      if (usedSlotIds.has(slot.id ?? '')) return false;
      if (slot.external_match_id && slot.external_match_id === externalId) return true;
      const slotHome = normalizeTeamMatchKey(slot.home_team);
      const slotAway = normalizeTeamMatchKey(slot.away_team);
      if (slotHome && slotAway) {
        return (
          `${formatTournamentKickoffTime(slot.kickoff_at)}|${slotHome}|${slotAway}` ===
          `${match.kickoffTimeHHmm}|${normalizeTeamMatchKey(match.homeTeam)}|${normalizeTeamMatchKey(match.awayTeam)}`
        );
      }
      if (!sides.opponentName) return false;
      return (
        buildTournamentMatchDedupeKey({
          kickoffTimeHHmm: formatTournamentKickoffTime(slot.kickoff_at),
          opponentName: slot.opponent_name,
          groupLabel: slot.group_label,
          phase: slot.phase ?? (safeOptionalText(slot.group_label) ? 'group' : null),
        }) ===
        buildTournamentMatchDedupeKey({
          kickoffTimeHHmm: match.kickoffTimeHHmm,
          opponentName: sides.opponentName,
          groupLabel: match.groupLabel,
          phase: match.phase,
        })
      );
    });
    if (existingSlot?.id) usedSlotIds.add(existingSlot.id);

    const existingIsOwn = Boolean(existingSlot?.match_id) && existingSlot?.is_own_team !== false;
    if (sides.isOwn) {
      if (existingIsOwn) existingMatches += 1;
      else newMatches += 1;
      continue;
    }

    if (existingIsOwn) {
      existingMatches += 1;
      continue;
    }

    if (!existingSlot) {
      newMatches += 1;
      continue;
    }

    existingMatches += 1;
    if (!match.hasResult) continue;
    const prevHome = existingSlot.official_home_goals ?? existingSlot.score_home;
    const prevAway = existingSlot.official_away_goals ?? existingSlot.score_away;
    if (prevHome !== match.homeGoals || prevAway !== match.awayGoals) {
      resultUpdates += 1;
    }
  }

  return {
    newTeams,
    newMatches,
    existingMatches,
    resultUpdates,
    matchesWithResult: resultCounts.withResult,
    matchesWithoutResult: resultCounts.withoutResult,
  };
}

export type AnalyzeTournamentUrlResult =
  | { ok: true; analysis: TournamentPlanAnalysis; diagnostics?: TournamentPlanAnalyzeDiagnostics }
  | { ok: false; error: string; failure?: TournamentPlanAnalyzeFailure };

function analyzeResultFromMeinTurnierplan(
  result: AnalyzeMeinTurnierplanUrlResult,
  source: TournamentPlanAnalyzeDataSource = 'browser_fallback',
): AnalyzeTournamentUrlResult {
  if (result.ok) {
    return {
      ok: true,
      analysis: result.analysis,
      diagnostics: {
        ...result.diagnostics,
        source: result.diagnostics.source ?? source,
      },
    };
  }
  return { ok: false, error: result.failure.message, failure: result.failure };
}

function serverDiagnosticsFromAnalyzeBody(
  trimmed: string,
  body: {
    extractedId?: string | null;
    attemptedEndpoints?: string[];
    diagnostics?: TournamentPlanAnalyzeDiagnostics;
    provider?: TournamentPlanProvider;
    analysis?: TournamentPlanAnalysis;
  },
): TournamentPlanAnalyzeDiagnostics {
  const liveHost = isTournamentLiveHost(trimmed);
  const extractedId =
    body.extractedId ??
    (liveHost ? extractTournamentLiveKeyFromUrl(trimmed).id : extractMeinTurnierplanId(trimmed));
  const provider =
    body.diagnostics?.provider ?? body.provider ?? (liveHost ? 'tournament-live' : 'meinturnierplan');
  return {
    linkRecognized:
      body.diagnostics?.linkRecognized ?? (isSupportedTournamentPlanHost(trimmed) || liveHost),
    idExtracted: body.diagnostics?.idExtracted ?? Boolean(extractedId),
    extractedId,
    apiReachable: body.diagnostics?.apiReachable ?? true,
    provider,
    attemptedEndpoints: body.diagnostics?.attemptedEndpoints ?? body.attemptedEndpoints ?? [],
    endpointAttempts: body.diagnostics?.endpointAttempts,
    showitPageReachable: body.diagnostics?.showitPageReachable ?? null,
    browserFallbackAttempted: body.diagnostics?.browserFallbackAttempted,
    browserFallbackError: body.diagnostics?.browserFallbackError ?? null,
    htmlFallbackAttempted: body.diagnostics?.htmlFallbackAttempted,
    htmlFallbackSuccessful: body.diagnostics?.htmlFallbackSuccessful,
    htmlFallbackTeamsFound: body.diagnostics?.htmlFallbackTeamsFound,
    htmlFallbackMatchesFound: body.diagnostics?.htmlFallbackMatchesFound,
    htmlFallbackError: body.diagnostics?.htmlFallbackError ?? null,
    htmlFallbackException: body.diagnostics?.htmlFallbackException ?? null,
    tournamentName: body.diagnostics?.tournamentName ?? body.analysis?.tournamentName ?? null,
    serverException: body.diagnostics?.serverException ?? null,
    fetchRuntime: body.diagnostics?.fetchRuntime,
    source: body.diagnostics?.source ?? 'server_api',
    fallbackStage: body.diagnostics?.fallbackStage ?? 'json',
    originalUrl: body.diagnostics?.originalUrl ?? trimmed,
    normalizedUrl: body.diagnostics?.normalizedUrl ?? null,
    finalRedirectUrl: body.diagnostics?.finalRedirectUrl ?? null,
    idDetectionSource: body.diagnostics?.idDetectionSource ?? null,
    detectedTeamCount: body.diagnostics?.detectedTeamCount ?? body.analysis?.teamCount,
    detectedMatchCount: body.diagnostics?.detectedMatchCount ?? body.analysis?.matchCount,
  };
}

function mergeTournamentImportFailures(
  serverFailure: TournamentPlanAnalyzeFailure | null,
  browserFailure: TournamentPlanAnalyzeFailure,
  browserFallbackError: string | null,
): TournamentPlanAnalyzeFailure {
  const showitPageReachable =
    browserFailure.diagnostics.showitPageReachable ??
    serverFailure?.diagnostics.showitPageReachable ??
    null;
  const endpointAttempts =
    browserFailure.diagnostics.endpointAttempts?.length
      ? browserFailure.diagnostics.endpointAttempts
      : serverFailure?.diagnostics.endpointAttempts;
  const attemptedEndpoints = browserFailure.attemptedEndpoints.length
    ? browserFailure.attemptedEndpoints
    : (serverFailure?.attemptedEndpoints ?? []);
  const resolvedCode = resolveFinalImportFailureCode({
    code: browserFailure.code,
    showitPageReachable,
    linkRecognized: browserFailure.diagnostics.linkRecognized,
    idExtracted: browserFailure.diagnostics.idExtracted,
  });

  const htmlDiagnostics = mergeHtmlFallbackDiagnostics(
    serverFailure?.diagnostics,
    browserFailure.diagnostics,
  );

  const analyzeTimedOut = Boolean(
    browserFailure.diagnostics.analyzeTimedOut || serverFailure?.diagnostics.analyzeTimedOut,
  );
  const analyzeLastStep =
    browserFailure.diagnostics.analyzeLastStep ?? serverFailure?.diagnostics.analyzeLastStep;

  return {
    code:
      browserFailure.code === 'html_fallback_server_error'
        ? 'html_fallback_server_error'
        : resolvedCode,
    message: analyzeTimedOut
      ? TOURNAMENT_ANALYZE_TIMEOUT_MESSAGE
      : browserFailure.code === 'html_fallback_server_error'
        ? browserFailure.message
        : messageForTournamentPlanAnalyzeCode(resolvedCode),
    provider: 'meinturnierplan',
    extractedId: browserFailure.extractedId ?? serverFailure?.extractedId ?? null,
    attemptedEndpoints,
    diagnostics: {
      linkRecognized:
        browserFailure.diagnostics.linkRecognized || Boolean(serverFailure?.diagnostics.linkRecognized),
      idExtracted:
        browserFailure.diagnostics.idExtracted || Boolean(serverFailure?.diagnostics.idExtracted),
      extractedId: browserFailure.extractedId ?? serverFailure?.extractedId ?? null,
      apiReachable:
        browserFailure.diagnostics.apiReachable || Boolean(serverFailure?.diagnostics.apiReachable),
      provider: 'meinturnierplan',
      attemptedEndpoints,
      endpointAttempts,
      showitPageReachable,
      browserFallbackAttempted: true,
      browserFallbackError,
      htmlFallbackAttempted: htmlDiagnostics.htmlFallbackAttempted,
      htmlFallbackSuccessful: htmlDiagnostics.htmlFallbackSuccessful,
      htmlFallbackTeamsFound: htmlDiagnostics.htmlFallbackTeamsFound,
      htmlFallbackMatchesFound: htmlDiagnostics.htmlFallbackMatchesFound,
      htmlFallbackError: htmlDiagnostics.htmlFallbackError ?? null,
      htmlFallbackException: htmlDiagnostics.htmlFallbackException ?? null,
      htmlFallbackRequestUrl:
        browserFailure.diagnostics.htmlFallbackRequestUrl ??
        serverFailure?.diagnostics.htmlFallbackRequestUrl ??
        null,
      htmlFallbackResponseStatus:
        browserFailure.diagnostics.htmlFallbackResponseStatus ??
        serverFailure?.diagnostics.htmlFallbackResponseStatus ??
        null,
      htmlFallbackResponseContentType:
        browserFailure.diagnostics.htmlFallbackResponseContentType ??
        serverFailure?.diagnostics.htmlFallbackResponseContentType ??
        null,
      rawResponsePreview:
        browserFailure.diagnostics.rawResponsePreview ??
        serverFailure?.diagnostics.rawResponsePreview ??
        null,
      tournamentName: htmlDiagnostics.tournamentName ?? null,
      serverException: serverFailure?.diagnostics.serverException ?? null,
      fetchRuntime: serverFailure?.diagnostics.fetchRuntime ?? browserFailure.diagnostics.fetchRuntime,
      source: htmlDiagnostics.htmlFallbackSuccessful ? 'html_fallback' : 'browser_fallback',
      fallbackStage: htmlDiagnostics.fallbackStage ?? 'browser',
      analyzeTimedOut,
      analyzeLastStep,
    },
  };
}

async function tryServerHtmlTournamentPlanFallback(
  trimmed: string,
  serverFailure: TournamentPlanAnalyzeFailure | null,
  browserFailure: TournamentPlanAnalyzeFailure,
  browserFallbackError: string | null,
): Promise<AnalyzeTournamentUrlResult> {
  analyzeTrace('[ANALYZE] START SERVER HTML FALLBACK', { url: trimmed });
  const requestUrl = buildTournamentPlanAnalyzeRequestUrl(trimmed, { forceHtmlFallback: true });

  try {
    const { res, body } = await fetchTournamentPlanAnalyzeApi(
      requestUrl,
      'tryServerHtmlTournamentPlanFallback',
      TOURNAMENT_ANALYZE_HTML_FALLBACK_TIMEOUT_MS,
    );

    if (res.ok && body.ok && body.analysis) {
      analyzeTrace('[ANALYZE] SERVER HTML FALLBACK SUCCESS', {
        teams: body.analysis.teamCount,
        matches: body.analysis.preliminaryMatchCount,
      });
      const diagnostics = serverDiagnosticsFromAnalyzeBody(trimmed, body);
      return {
        ok: true,
        analysis: body.analysis,
        diagnostics: {
          ...diagnostics,
          browserFallbackAttempted: true,
          browserFallbackError,
          htmlFallbackAttempted: true,
          htmlFallbackSuccessful: true,
          htmlFallbackTeamsFound: body.analysis.teamCount,
          htmlFallbackMatchesFound: body.analysis.preliminaryMatchCount,
          fallbackStage: 'html',
          source: 'html_fallback',
        },
      };
    }

    const extractedId = body.extractedId ?? extractMeinTurnierplanId(trimmed);
    const htmlFallbackError =
      body.diagnostics?.htmlFallbackError ??
      body.message ??
      body.error ??
      MEIN_TURNIERPLAN_HTML_FALLBACK_EMPTY_MESSAGE;

    const htmlFailure: TournamentPlanAnalyzeFailure =
      body.code && body.message
        ? {
            code: body.code,
            message: body.message,
            provider: body.provider ?? 'meinturnierplan',
            extractedId,
            attemptedEndpoints: body.attemptedEndpoints ?? body.diagnostics?.attemptedEndpoints ?? [],
            diagnostics: {
              ...serverDiagnosticsFromAnalyzeBody(trimmed, body),
              browserFallbackAttempted: true,
              browserFallbackError,
              htmlFallbackAttempted: true,
              htmlFallbackSuccessful: false,
              htmlFallbackError,
              htmlFallbackRequestUrl: requestUrl,
              htmlFallbackResponseStatus: res.status,
              htmlFallbackException: body.diagnostics?.htmlFallbackException ?? null,
              fallbackStage: 'html',
              source: 'html_fallback',
            },
          }
        : {
            ...browserFailure,
            diagnostics: {
              ...browserFailure.diagnostics,
              browserFallbackAttempted: true,
              browserFallbackError,
              htmlFallbackAttempted: true,
              htmlFallbackSuccessful: false,
              htmlFallbackError,
              htmlFallbackRequestUrl: requestUrl,
              htmlFallbackResponseStatus: res.status,
              fallbackStage: 'html',
              source: 'html_fallback',
            },
          };

    analyzeTrace('[ANALYZE] SERVER HTML FALLBACK FAILED', {
      code: htmlFailure.code,
      htmlFallbackError,
    });
    const merged = mergeTournamentImportFailures(serverFailure, htmlFailure, browserFallbackError);
    return { ok: false, error: merged.message, failure: merged };
  } catch (err) {
    if (err instanceof TournamentPlanAnalyzeNonJsonResponseError) {
      analyzeTrace('[ANALYZE] SERVER HTML FALLBACK NON-JSON', {
        status: err.status,
        contentType: err.contentType,
      });
      const nonJsonFailure = buildNonJsonHtmlFallbackFailure(
        trimmed,
        requestUrl,
        err,
        browserFailure,
        browserFallbackError,
      );
      const merged = mergeTournamentImportFailures(serverFailure, nonJsonFailure, browserFallbackError);
      return { ok: false, error: merged.message, failure: merged };
    }
    if (isAnalyzeTimeoutError(err)) {
      analyzeTrace('[ANALYZE] SERVER HTML FALLBACK TIMEOUT', { url: trimmed });
      const timeoutFailure = buildAnalyzeTimeoutFailure(trimmed, 'html_fallback', {
        browserFallbackAttempted: true,
        browserFallbackError,
        htmlFallbackAttempted: true,
        htmlFallbackError: TOURNAMENT_ANALYZE_TIMEOUT_MESSAGE,
      });
      const merged = mergeTournamentImportFailures(serverFailure, timeoutFailure, browserFallbackError);
      return { ok: false, error: merged.message, failure: merged };
    }
    const captured = captureMeinTurnierplanFetchException(err);
    const apiErr = captured.exceptionMessage || captured.errorDetail;
    analyzeTrace('[ANALYZE] SERVER HTML FALLBACK UNREACHABLE', {
      error: apiErr,
      exceptionName: captured.exceptionName,
    });
    const htmlFailure: TournamentPlanAnalyzeFailure = {
      ...browserFailure,
      diagnostics: {
        ...browserFailure.diagnostics,
        browserFallbackAttempted: true,
        browserFallbackError,
        htmlFallbackAttempted: true,
        htmlFallbackSuccessful: false,
        htmlFallbackError: `Server HTML-Fallback nicht erreichbar: ${apiErr}`,
        htmlFallbackRequestUrl: requestUrl,
        htmlFallbackResponseStatus: null,
        htmlFallbackException: captureMeinTurnierplanHtmlFallbackException(err),
        fallbackStage: 'html',
        source: 'html_fallback',
      },
    };
    const merged = mergeTournamentImportFailures(serverFailure, htmlFailure, browserFallbackError);
    return { ok: false, error: merged.message, failure: merged };
  }
}

async function runBrowserTournamentPlanFallback(
  trimmed: string,
  serverFailure: TournamentPlanAnalyzeFailure | null,
): Promise<AnalyzeTournamentUrlResult> {
  let browserResult: AnalyzeMeinTurnierplanUrlResult;
  let browserFetchError: string | null = null;

  try {
    browserResult = await analyzeMeinTurnierplanUrl(trimmed, fetch, { skipHtmlFallback: true });
  } catch (err) {
    browserFetchError = describeFetchFailure(err);
    const extractedId = extractMeinTurnierplanId(trimmed);
    browserResult = {
      ok: false,
      failure: buildTournamentPlanAnalyzeFailure({
        code: 'api_unreachable',
        extractedId,
        attemptedEndpoints: extractedId ? buildMeinTurnierplanJsonEndpoints(extractedId) : [],
        apiReachable: false,
        linkRecognized: isSupportedTournamentPlanHost(trimmed),
        idExtracted: Boolean(extractedId),
        showitPageReachable: null,
        browserFallbackAttempted: true,
        browserFallbackError: browserFetchError,
        source: 'browser_fallback',
        fallbackStage: 'json',
      }),
      httpStatus: 502,
    };
  }

  if (browserResult.ok) {
    return analyzeResultFromMeinTurnierplan(browserResult, 'browser_fallback');
  }

  const browserFailure = browserResult.failure;
  analyzeTrace('[ANALYZE] BROWSER FAILED', {
    code: browserFailure.code,
    message: browserFailure.message,
  });

  const browserFallbackError =
    browserFetchError ??
    browserFailure.diagnostics.browserFallbackError ??
    summarizeEndpointAttempts(browserFailure.diagnostics.endpointAttempts) ??
    browserFailure.message;

  return tryServerHtmlTournamentPlanFallback(trimmed, serverFailure, browserFailure, browserFallbackError);
}

async function tryBrowserTournamentPlanFallback(
  trimmed: string,
  serverFailure: TournamentPlanAnalyzeFailure | null,
): Promise<AnalyzeTournamentUrlResult> {
  const stage = await runAnalyzeStageWithTimeout(TOURNAMENT_ANALYZE_BROWSER_FALLBACK_TIMEOUT_MS, () =>
    runBrowserTournamentPlanFallback(trimmed, serverFailure),
  );

  if (stage.timedOut) {
    analyzeTrace('[ANALYZE] BROWSER FALLBACK TIMEOUT', { url: trimmed });
    const browserFailure = buildAnalyzeTimeoutFailure(trimmed, 'browser_fallback', {
      browserFallbackAttempted: true,
      browserFallbackError: TOURNAMENT_ANALYZE_TIMEOUT_MESSAGE,
    });
    return tryServerHtmlTournamentPlanFallback(
      trimmed,
      serverFailure,
      browserFailure,
      TOURNAMENT_ANALYZE_TIMEOUT_MESSAGE,
    );
  }

  return stage.value;
}

function analyzeResultFromTournamentLive(
  result: Awaited<ReturnType<typeof analyzeTournamentLiveUrl>>,
): AnalyzeTournamentUrlResult {
  if (result.ok) {
    return {
      ok: true,
      analysis: result.analysis,
      diagnostics: {
        ...result.diagnostics,
        detectedTeamCount: result.analysis.teamCount,
        detectedMatchCount: result.analysis.matchCount,
      },
    };
  }
  return {
    ok: false,
    error: result.failure.message,
    failure: {
      code: result.failure.code as TournamentPlanAnalyzeErrorCode,
      message: result.failure.message,
      provider: 'tournament-live',
      extractedId: result.failure.extractedId,
      attemptedEndpoints: result.failure.attemptedEndpoints,
      diagnostics: result.failure.diagnostics,
    },
  };
}

async function analyzeTournamentLiveWithClientFallback(
  trimmed: string,
  serverResult?: AnalyzeTournamentUrlResult | null,
): Promise<AnalyzeTournamentUrlResult> {
  if (serverResult?.ok) return serverResult;
  if (
    serverResult &&
    !serverResult.ok &&
    serverResult.failure?.provider === 'tournament-live' &&
    serverResult.failure.code !== 'unsupported_host'
  ) {
    return serverResult;
  }
  try {
    return analyzeResultFromTournamentLive(await analyzeTournamentLiveUrl(trimmed));
  } catch (err) {
    if (serverResult && !serverResult.ok) return serverResult;
    const extracted = extractTournamentLiveKeyFromUrl(trimmed);
    const failure = buildTournamentPlanAnalyzeFailure({
      code: 'plan_incomplete',
      message: TOURNAMENT_IMPORT_PLAN_INCOMPLETE_MESSAGE,
      extractedId: extracted.id,
      attemptedEndpoints: [],
      apiReachable: false,
      linkRecognized: true,
      idExtracted: Boolean(extracted.id),
      provider: 'tournament-live',
      source: 'browser_fallback',
      fallbackStage: 'json',
      originalUrl: trimmed,
      normalizedUrl: extracted.normalizedUrl,
      idDetectionSource: extracted.source,
    });
    return { ok: false, error: failure.message, failure };
  }
}

export async function analyzeTournamentUrl(
  url: string,
  _ownTeamNameHint?: string | null,
): Promise<AnalyzeTournamentUrlResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    const failure = buildTournamentPlanAnalyzeFailure({
      code: 'id_not_found',
      extractedId: null,
      attemptedEndpoints: [],
      apiReachable: false,
      linkRecognized: false,
      idExtracted: false,
    });
    return { ok: false, error: failure.message, failure };
  }

  const liveHost = isTournamentLiveHost(trimmed);
  const requestUrl = buildTournamentPlanAnalyzeRequestUrl(trimmed);

  try {
    const { res, body } = await fetchTournamentPlanAnalyzeApi(
      requestUrl,
      'analyzeTournamentUrl',
      TOURNAMENT_ANALYZE_SERVER_API_TIMEOUT_MS,
    );

    if (res.ok && body.ok && body.analysis) {
      return {
        ok: true,
        analysis: body.analysis,
        diagnostics: serverDiagnosticsFromAnalyzeBody(trimmed, body),
      };
    }

    if (liveHost) {
      const serverFailure: AnalyzeTournamentUrlResult | null =
        body.code && body.message
          ? {
              ok: false,
              error: body.message,
              failure: {
                code: body.code,
                message: body.message,
                provider: body.provider ?? 'tournament-live',
                extractedId: body.extractedId ?? extractTournamentLiveKeyFromUrl(trimmed).id,
                attemptedEndpoints: body.attemptedEndpoints ?? body.diagnostics?.attemptedEndpoints ?? [],
                diagnostics: serverDiagnosticsFromAnalyzeBody(trimmed, body),
              },
            }
          : null;
      return analyzeTournamentLiveWithClientFallback(trimmed, serverFailure);
    }

    if (body.code && body.message) {
      const extractedId = body.extractedId ?? extractMeinTurnierplanId(trimmed);
      const failure: TournamentPlanAnalyzeFailure = {
        code: body.code,
        message: body.message,
        provider: body.provider ?? 'meinturnierplan',
        extractedId,
        attemptedEndpoints: body.attemptedEndpoints ?? body.diagnostics?.attemptedEndpoints ?? [],
        diagnostics: body.diagnostics ?? serverDiagnosticsFromAnalyzeBody(trimmed, body),
      };
      return { ok: false, error: failure.message, failure };
    }

    return {
      ok: false,
      error: body.error ?? body.message ?? TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
    };
  } catch (err) {
    logHtmlFallbackFetchError('analyzeTournamentUrl (flat API)', err);
    if (liveHost) {
      return analyzeTournamentLiveWithClientFallback(trimmed);
    }
    if (isAnalyzeTimeoutError(err)) {
      analyzeTrace('[ANALYZE] FLAT API TIMEOUT', { url: trimmed });
      const failure = buildAnalyzeTimeoutFailure(trimmed, 'server_api');
      return { ok: false, error: failure.message, failure };
    }
    if (err instanceof TournamentPlanAnalyzeNonJsonResponseError) {
      const failure = buildNonJsonHtmlFallbackFailure(trimmed, requestUrl, err, buildTournamentPlanAnalyzeFailure({
        code: 'api_unreachable',
        extractedId: extractMeinTurnierplanId(trimmed),
        attemptedEndpoints: [],
        apiReachable: false,
        linkRecognized: isSupportedTournamentPlanHost(trimmed),
        idExtracted: Boolean(extractMeinTurnierplanId(trimmed)),
        source: 'server_api',
        fallbackStage: 'json',
      }), null);
      return { ok: false, error: failure.message, failure };
    }
    const captured = captureMeinTurnierplanFetchException(err);
    const failure = buildTournamentPlanAnalyzeFailure({
      code: 'api_unreachable',
      message: captured.exceptionMessage || TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
      extractedId: extractMeinTurnierplanId(trimmed),
      attemptedEndpoints: extractMeinTurnierplanId(trimmed)
        ? buildMeinTurnierplanJsonEndpoints(extractMeinTurnierplanId(trimmed)!)
        : [],
      apiReachable: false,
      linkRecognized: isSupportedTournamentPlanHost(trimmed),
      idExtracted: Boolean(extractMeinTurnierplanId(trimmed)),
      serverException: {
        name: captured.exceptionName,
        message: captured.exceptionMessage,
      },
      source: 'server_api',
      fallbackStage: 'json',
    });
    return { ok: false, error: failure.message, failure };
  }
}

export async function fetchTournamentImportRecognition(
  teamSeasonId: string,
): Promise<TournamentImportRecognition> {
  if (String(teamSeasonId ?? '').startsWith('00000000-demo-')) {
    const { demoFixtures } = await import('../demo/demoFixtures');
    const name = demoFixtures.teamName;
    return {
      teamSeasonName: name,
      teamName: name,
      aliases: [],
      knownNames: [name],
    };
  }
  const { buildTournamentImportRecognition } = await import('./teamSeasonAliases');
  return buildTournamentImportRecognition(teamSeasonId);
}

/** @deprecated Nutze fetchTournamentImportRecognition — erster bekannter Name. */
export async function fetchOwnTeamNameHint(teamSeasonId: string): Promise<string | null> {
  const recognition = await fetchTournamentImportRecognition(teamSeasonId);
  return recognition.knownNames[0] ?? null;
}

export async function importTournamentPlanFromAnalysis(params: {
  tournamentEventId: string;
  teamSeasonId: string;
  tournamentDayIso: string;
  location: string | null;
  analysis: TournamentPlanAnalysis;
  existingTeamNames: string[];
  existingSlots: Array<{
    id?: string;
    opponent_name: string;
    kickoff_at: string;
    group_label: string | null;
    phase?: string | null;
    match_id?: string | null;
    match_status?: string | null;
    score_home?: number;
    score_away?: number;
    is_own_team?: boolean | null;
    external_match_id?: string | null;
    home_team?: string | null;
    away_team?: string | null;
    pitch?: string | null;
  }>;
  knownNames?: string[];
}): Promise<{
  importedTeams: number;
  importedMatches: number;
  skippedMatches: number;
  updatedResults: number;
  error: string | null;
}> {
  if (String(params.tournamentEventId ?? '').trim() === 'ev-tournament') {
    return {
      importedTeams: 0,
      importedMatches: 0,
      skippedMatches: 0,
      updatedResults: 0,
      error: 'Externer Turnierplan-Import ist in der Demo deaktiviert.',
    };
  }

  const { assertTeamSeasonWritable } = await import('./seasonTransition');
  const writable = await assertTeamSeasonWritable(params.teamSeasonId);
  if (!writable.ok) {
    return {
      importedTeams: 0,
      importedMatches: 0,
      skippedMatches: 0,
      updatedResults: 0,
      error: writable.message,
    };
  }

  const {
    addTournamentParticipant,
    attachMatchToExistingSlot,
    convertOfficialSlotToOwnMatch,
    createTournamentMatchSlot,
    formatTournamentKickoffTime,
    normalizeTournamentDbError,
    updateOwnTournamentSlotSchedule,
    upsertOfficialTournamentMatch,
  } = await import('./tournamentPlan');
  const { meetupUtcIsoOnViennaEventDay } = await import('./viennaTime');

  const existingTeamKeys = new Set(params.existingTeamNames.map(normalizeTeamMatchKey));
  let importedTeams = 0;

  for (const team of params.analysis.teams) {
    const key = normalizeTeamMatchKey(team.teamName);
    if (existingTeamKeys.has(key)) continue;

    const { error } = await addTournamentParticipant({
      tournamentEventId: params.tournamentEventId,
      teamName: team.teamName,
      groupLabel: team.groupLabel,
    });
    if (error) {
      return {
        importedTeams,
        importedMatches: 0,
        skippedMatches: 0,
        updatedResults: 0,
        error: normalizeTournamentDbError(error, null),
      };
    }
    existingTeamKeys.add(key);
    importedTeams += 1;
  }

  const knownNames = params.knownNames ?? [];
  const provider = params.analysis.provider;
  const usedSlotIds = new Set<string>();

  const findExistingSlot = (
    match: TournamentPlanImportRawMatch,
    opponentName: string | null,
    externalId: string,
  ) => {
    const byExternal = params.existingSlots.find(
      (slot) => slot.external_match_id && slot.external_match_id === externalId && !usedSlotIds.has(slot.id ?? ''),
    );
    if (byExternal) return byExternal;

    const homeAwayKey = `${match.kickoffTimeHHmm}|${normalizeTeamMatchKey(match.homeTeam)}|${normalizeTeamMatchKey(match.awayTeam)}`;
    const bySides = params.existingSlots.find((slot) => {
      if (usedSlotIds.has(slot.id ?? '')) return false;
      const slotHome = normalizeTeamMatchKey(slot.home_team);
      const slotAway = normalizeTeamMatchKey(slot.away_team);
      if (slotHome && slotAway) {
        const key = `${formatTournamentKickoffTime(slot.kickoff_at)}|${slotHome}|${slotAway}`;
        return key === homeAwayKey;
      }
      return false;
    });
    if (bySides) return bySides;

    // Physical slot identity: same kickoff + pitch + phase when prior side was unresolved.
    // Covers Placeholder → concrete without relying on unstable synthetic external IDs.
    const physicalKey = `${match.kickoffTimeHHmm}|${safeOptionalText(match.pitch) ?? ''}|${normalizePhaseForDedupe(match.phase) || 'unknown'}`;
    const byPhysical = params.existingSlots.find((slot) => {
      if (usedSlotIds.has(slot.id ?? '')) return false;
      const slotKey = `${formatTournamentKickoffTime(slot.kickoff_at)}|${safeOptionalText(slot.pitch) ?? ''}|${normalizePhaseForDedupe(slot.phase) || 'unknown'}`;
      if (slotKey !== physicalKey) return false;
      const unresolved =
        looksLikeUnresolvedTournamentTeamName(slot.home_team) ||
        looksLikeUnresolvedTournamentTeamName(slot.away_team) ||
        looksLikeUnresolvedTournamentTeamName(match.homeTeam) ||
        looksLikeUnresolvedTournamentTeamName(match.awayTeam);
      return unresolved;
    });
    if (byPhysical) return byPhysical;

    if (!opponentName) return undefined;
    const ownKey = buildTournamentMatchDedupeKey({
      kickoffTimeHHmm: match.kickoffTimeHHmm,
      opponentName,
      groupLabel: match.groupLabel,
      phase: match.phase,
    });
    return params.existingSlots.find((slot) => {
      if (usedSlotIds.has(slot.id ?? '')) return false;
      const slotKey = buildTournamentMatchDedupeKey({
        kickoffTimeHHmm: formatTournamentKickoffTime(slot.kickoff_at),
        opponentName: slot.opponent_name,
        groupLabel: slot.group_label,
        phase: slot.phase ?? (safeOptionalText(slot.group_label) ? 'group' : null),
      });
      return slotKey === ownKey;
    });
  };

  let importedMatches = 0;
  let skippedMatches = 0;
  let updatedResults = 0;

  for (const match of params.analysis.rawMatches) {
    const sides = classifyPlanMatchSides(match, knownNames);
    const externalId = buildOfficialExternalMatchId(provider, match);
    const existingSlot = findExistingSlot(match, sides.opponentName, externalId);
    if (existingSlot?.id) usedSlotIds.add(existingSlot.id);

    const kickoffIso = meetupUtcIsoOnViennaEventDay(params.tournamentDayIso, match.kickoffTimeHHmm);
    if (!kickoffIso) continue;

    if (sides.isOwn && sides.opponentName) {
      const existingIsOwn = Boolean(existingSlot?.match_id) && existingSlot?.is_own_team !== false;

      if (existingIsOwn && existingSlot) {
        skippedMatches += 1;
        if ((existingSlot.match_status ?? 'upcoming').toLowerCase() === 'upcoming' && existingSlot.id) {
          await updateOwnTournamentSlotSchedule({
            slotId: existingSlot.id,
            kickoffAtIso: kickoffIso,
            pitch: match.pitch,
            groupLabel: match.groupLabel,
            phase: match.phase === 'unknown' ? null : match.phase,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            provider,
            externalMatchId: externalId,
          });
        }
        continue;
      }

      if (existingSlot?.id && !existingSlot.match_id) {
        const { error } = await convertOfficialSlotToOwnMatch({
          slotId: existingSlot.id,
          teamSeasonId: params.teamSeasonId,
          tournamentDayIso: params.tournamentDayIso,
          location: params.location,
          opponentName: sides.opponentName,
          kickoffTimeHHmm: match.kickoffTimeHHmm,
          plannedMinutes: match.plannedMinutes,
          pitch: match.pitch,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          provider,
          externalMatchId: externalId,
        });
        if (error) {
          return {
            importedTeams,
            importedMatches,
            skippedMatches,
            updatedResults,
            error: normalizeTournamentDbError(error, null),
          };
        }
        importedMatches += 1;
        continue;
      }

      const { matchId, slotId, error } = await createTournamentMatchSlot({
        tournamentEventId: params.tournamentEventId,
        teamSeasonId: params.teamSeasonId,
        tournamentDayIso: params.tournamentDayIso,
        location: params.location,
        opponentName: sides.opponentName,
        kickoffTimeHHmm: match.kickoffTimeHHmm,
        plannedMinutes: match.plannedMinutes,
        pitch: match.pitch,
        groupLabel: match.groupLabel,
        phase: match.phase === 'unknown' ? null : match.phase,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        provider,
        externalMatchId: externalId,
      });
      if (error) {
        return {
          importedTeams,
          importedMatches,
          skippedMatches,
          updatedResults,
          error: normalizeTournamentDbError(error, null),
        };
      }
      if (slotId && matchId) {
        await attachMatchToExistingSlot({
          slotId,
          matchId,
          opponentName: sides.opponentName,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          provider,
          externalMatchId: externalId,
        });
      }
      importedMatches += 1;
      continue;
    }

    if (existingSlot?.match_id && existingSlot.is_own_team !== false) {
      skippedMatches += 1;
      continue;
    }

    const officialStatus =
      match.hasResult && match.homeGoals != null && match.awayGoals != null ? 'finished' : 'upcoming';
    const { created, updated, error } = await upsertOfficialTournamentMatch({
      tournamentEventId: params.tournamentEventId,
      existingSlotId: existingSlot?.id ?? null,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      opponentName: `${match.homeTeam} vs ${match.awayTeam}`,
      kickoffAtIso: kickoffIso,
      plannedMinutes: match.plannedMinutes,
      pitch: match.pitch,
      groupLabel: match.groupLabel,
      phase: match.phase === 'unknown' ? null : match.phase,
      provider,
      externalMatchId: externalId,
      officialStatus,
      homeGoals: match.hasResult ? match.homeGoals : null,
      awayGoals: match.hasResult ? match.awayGoals : null,
    });
    if (error) {
      return {
        importedTeams,
        importedMatches,
        skippedMatches,
        updatedResults,
        error: normalizeTournamentDbError(error, null),
      };
    }
    if (created) importedMatches += 1;
    else if (updated) updatedResults += 1;
    else skippedMatches += 1;
  }

  return { importedTeams, importedMatches, skippedMatches, updatedResults, error: null };
}
