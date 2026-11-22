import { extractMeinTurnierplanEmbeddedJson } from './meinTurnierplanEmbedded.js';
import { parseMeinTurnierplanModel } from './meinTurnierplanModel.js';
/**
 * MeinTurnierplan-Analyse mit eingebetteten Webseitendaten — colocated with Vercel API (no src/lib imports).
 */

const MEIN_TURNIERPLAN_FETCH_TIMEOUT_MS = 6_000;

const MEIN_TURNIERPLAN_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MEIN_TURNIERPLAN_JSON_ENDPOINT_HOSTS = [
  'https://www.meinturnierplan.de/json/json.php',
  'https://meinturnierplan.de/json/json.php',
  'https://www.meinturnierplan.com/json/json.php',
  'https://meinturnierplan.com/json/json.php',
  'http://www.meinturnierplan.de/json/json.php',
];

const MEIN_TURNIERPLAN_HOSTS = new Set([
  'meinturnierplan.de',
  'www.meinturnierplan.de',
  'meinturnierplan.com',
  'www.meinturnierplan.com',
  'tournamentbase.com',
  'www.tournamentbase.com',
]);

import {
  isSupportedTournamentPlanHost,
  isPlausibleMeinTurnierplanTournamentId,
  resolveMeinTurnierplanShowitUrl,
  resolveMeinTurnierplanTournamentId,
} from './meinTurnierplanUrl.js';
import { isTournamentLiveHost } from './tournamentLiveUrl.js';
import { analyzeTournamentLiveUrl } from './tournamentLiveAdapter.js';

function buildMeinTurnierplanJsonEndpoints(tournamentId) {
  const id = tournamentId.trim();
  return MEIN_TURNIERPLAN_JSON_ENDPOINT_HOSTS.map(
    (base) => `${base}?id=${encodeURIComponent(id)}`,
  );
}

function buildMeinTurnierplanShowitUrl(tournamentId) {
  return `https://www.meinturnierplan.de/showit.php?id=${encodeURIComponent(tournamentId.trim())}`;
}

function buildMeinTurnierplanFetchHeaders(refererUrl) {
  return {
    Accept: 'application/json,text/plain,*/*',
    'User-Agent': MEIN_TURNIERPLAN_BROWSER_USER_AGENT,
    Referer: refererUrl,
  };
}

function messageForCode(code) {
  switch (code) {
    case 'unsupported_host':
      return 'Turnierplan wird aktuell nicht unterstützt.';
    case 'id_not_found':
      return 'Turnier-ID konnte aus dem Link nicht gelesen werden.';
    case 'import_data_unavailable':
      return 'Webseite ist erreichbar, aber die Import-Daten sind für SpielzeitApp nicht abrufbar.';
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
      return 'Turnier wurde erkannt, der Spielplan konnte aber noch nicht vollständig gelesen werden.';
    case 'parse_failed':
    default:
      return 'Turnierplan konnte nicht analysiert werden.';
  }
}

function httpStatusForCode(code) {
  if (code === 'api_unreachable' || code === 'import_data_unavailable') return 502;
  if (code === 'unsupported_host' || code === 'id_not_found') return 422;
  return 422;
}

function buildFailure(code, extractedId, attemptedEndpoints) {
  return {
    ok: false,
    provider: 'meinturnierplan',
    code,
    message: messageForCode(code),
    extractedId,
    attemptedEndpoints,
    httpStatus: httpStatusForCode(code),
  };
}

async function fetchMeinTurnierplanWithTimeout(endpoint, init, fetchImpl) {
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

function participantName(participants, id) {
  if (id == null) return '';
  const entry = participants[String(id)] ?? participants[id];
  return (entry?.name ?? '').trim();
}

function diagnoseMeinTurnierplanPayload(data) {
  const json = data;
  if (!json?.participants || typeof json.participants !== 'object') return 'parse_failed';
  if (!Array.isArray(json.groups) || json.groups.length === 0) return 'no_groups';

  const participants = json.participants;
  let teamCount = 0;
  for (let groupIndex = 0; groupIndex < json.groups.length; groupIndex += 1) {
    const participantIds = json.groupParticipants?.[groupIndex] ?? [];
    for (const participantId of participantIds) {
      if (participantName(participants, participantId)) teamCount += 1;
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

function kickoffHHmmFromDateTime(dateAndTime) {
  const raw = (dateAndTime ?? '').trim();
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return '10:00';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** MeinTurnierplan JSON: score1 = Heim, score2 = Auswärts. */
function extractMeinTurnierplanMatchScores(match) {
  const rawHome = match?.score1;
  const rawAway = match?.score2;
  const hasHome = rawHome !== null && rawHome !== undefined && String(rawHome).trim() !== '';
  const hasAway = rawAway !== null && rawAway !== undefined && String(rawAway).trim() !== '';
  if (!hasHome || !hasAway) {
    return { hasResult: false, homeGoals: null, awayGoals: null };
  }
  const homeGoals = Number.parseInt(String(rawHome).trim(), 10);
  const awayGoals = Number.parseInt(String(rawAway).trim(), 10);
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals) || homeGoals < 0 || awayGoals < 0) {
    return { hasResult: false, homeGoals: null, awayGoals: null };
  }
  return { hasResult: true, homeGoals, awayGoals };
}

function pushRawMatch(rawMatches, entry) {
  const scores = extractMeinTurnierplanMatchScores(entry.source);
  rawMatches.push({
    homeTeam: entry.homeTeam,
    awayTeam: entry.awayTeam,
    groupLabel: entry.groupLabel,
    phase: entry.phase,
    kickoffTimeHHmm: entry.kickoffTimeHHmm,
    plannedMinutes: entry.plannedMinutes,
    pitch: entry.pitch,
    hasResult: scores.hasResult,
    homeGoals: scores.homeGoals,
    awayGoals: scores.awayGoals,
  });
}

function inferKnockoutPhaseFromMeinTurnierplan(modeMapping, sourceTeam1, sourceTeam2) {
  const round = modeMapping?.round ?? 1;
  const matchNo = modeMapping?.match ?? 0;
  const rank1 = sourceTeam1?.rank ?? 0;
  const rank2 = sourceTeam2?.rank ?? 0;
  const maxRank = Math.max(rank1, rank2);
  const minRank = Math.min(rank1, rank2);

  if (round === 1 && matchNo === 1 && minRank === 1 && maxRank === 1) return 'final';
  if (maxRank >= 5 || matchNo >= 5) return 'placement';
  if (round >= 2) return 'semifinal';
  if (maxRank <= 2 && matchNo <= 2) return 'semifinal';
  if (maxRank === 3 || maxRank === 4) return 'placement';
  return 'unknown';
}

export function parseMeinTurnierplanJson(data) {
  return parseMeinTurnierplanModel(data);
}

async function fetchMeinTurnierplanJsonWithFallbacks(tournamentId, fetchImpl = fetch, options = {}) {
  const attemptedEndpoints = buildMeinTurnierplanJsonEndpoints(tournamentId);
  const refererUrl = options.refererUrl ?? buildMeinTurnierplanShowitUrl(tournamentId);
  // Bound the complete API stage, leaving time for the webpage fallback.
  const attempts = await Promise.all(attemptedEndpoints.map(async (endpoint) => {
    try {
      const res = await fetchMeinTurnierplanWithTimeout(endpoint,
        { headers: buildMeinTurnierplanFetchHeaders(refererUrl) }, fetchImpl);
      if (!res.ok) return { endpoint, status: res.status, reachable: false };
      let payload;
      try { payload = await res.json(); } catch {
        return { endpoint, status: res.status, reachable: true, code: 'parse_failed' };
      }
      const analysis = parseMeinTurnierplanJson(payload);
      return { endpoint, status: res.status, reachable: true,
        analysis: analysis?.matchCount > 0 ? analysis : null,
        code: analysis ? 'no_matches' : diagnoseMeinTurnierplanPayload(payload) };
    } catch (err) {
      return { endpoint, reachable: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));
  const diagnostics = { apiReachable: attempts.some((a) => a.reachable),
    endpointAttempts: attempts.map((a) => ({ endpoint: a.endpoint, finalUrl: null,
      httpStatus: a.status ?? null, networkError: !a.status, errorDetail: a.error ?? null,
      exceptionName: null, exceptionMessage: a.error ?? null,
      parseCode: a.analysis ? 'ok' : a.code ?? null })) };
  const success = attempts.find((a) => a.analysis);
  if (success) return { ok: true, analysis: success.analysis, attemptedEndpoints, ...diagnostics };
  return { ok: false, attemptedEndpoints, ...diagnostics,
    code: diagnostics.apiReachable ? 'parse_failed' : 'api_unreachable' };
}

async function fetchEmbeddedPlan(pageUrl, tournamentId, fetchImpl) {
  try {
    const res = await fetchMeinTurnierplanWithTimeout(pageUrl, {
      headers: { ...buildMeinTurnierplanFetchHeaders(pageUrl), Accept: 'text/html,application/xhtml+xml' },
    }, fetchImpl);
    if (!res.ok) return { ok: false, reachable: false, error: `HTTP ${res.status}` };
    const payload = extractMeinTurnierplanEmbeddedJson(await res.text(), tournamentId);
    const analysis = payload && parseMeinTurnierplanJson(payload);
    const canonicalId = payload?.slugId === tournamentId
      && typeof payload.slug === 'string' && isPlausibleMeinTurnierplanTournamentId(payload.slug)
      ? payload.slug : null;
    if (!analysis?.matchCount) return { ok: false, reachable: true,
      canonicalId,
      error: 'Webseite erreichbar, aber keine lesbaren Teams und Spiele gefunden.' };
    return { ok: true, reachable: true, analysis, canonicalId, finalUrl: res.url || pageUrl };
  } catch (err) {
    return { ok: false, reachable: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function analyzeTournamentPlanJson(url, fetchImpl = fetch) {
  const trimmed = url.trim();
  if (!trimmed) {
    return buildFailure('id_not_found', null, []);
  }

  if (isTournamentLiveHost(trimmed)) {
    const live = await analyzeTournamentLiveUrl(trimmed, fetchImpl);
    if (live.ok) {
      return {
        ok: true,
        provider: 'tournament-live',
        extractedId: live.diagnostics.extractedId,
        attemptedEndpoints: live.diagnostics.attemptedEndpoints,
        analysis: live.analysis,
        diagnostics: {
          ...live.diagnostics,
          detectedTeamCount: live.analysis.teamCount,
          detectedMatchCount: live.analysis.matchCount,
        },
      };
    }
    return {
      ok: false,
      provider: 'tournament-live',
      code: live.failure.code,
      message: live.failure.message,
      extractedId: live.failure.extractedId,
      attemptedEndpoints: live.failure.attemptedEndpoints,
      httpStatus: live.httpStatus,
      diagnostics: live.failure.diagnostics,
    };
  }

  if (!isSupportedTournamentPlanHost(trimmed)) {
    return buildFailure('unsupported_host', null, []);
  }

  const resolution = await resolveMeinTurnierplanTournamentId(trimmed, fetchImpl);
  let extractedId = resolution.detectedId;
  const urlDiagnostics = {
    originalUrl: resolution.originalUrl,
    normalizedUrl: resolution.normalizedUrl,
    finalRedirectUrl: resolution.finalRedirectUrl,
    idDetectionSource: resolution.idSource,
  };

  if (!extractedId) {
    return {
      ...buildFailure('id_not_found', null, []),
      diagnostics: {
        linkRecognized: true,
        idExtracted: false,
        extractedId: null,
        apiReachable: false,
        provider: 'meinturnierplan',
        attemptedEndpoints: [],
        ...urlDiagnostics,
      },
    };
  }

  const refererUrl = resolveMeinTurnierplanShowitUrl(resolution);
  const pageUrl = resolution.finalRedirectUrl || resolution.normalizedUrl || refererUrl;
  const compactLink = /\/c\//i.test(new URL(pageUrl).pathname);
  let htmlResult = null;
  let fetchResult = { ok: false, attemptedEndpoints: [], apiReachable: false, endpointAttempts: [] };
  // Compact links expose a complete public schedule directly in their HTML.
  if (compactLink) htmlResult = await fetchEmbeddedPlan(pageUrl, extractedId, fetchImpl);
  if (htmlResult?.canonicalId) extractedId = htmlResult.canonicalId;
  if (!htmlResult?.ok) {
    fetchResult = await fetchMeinTurnierplanJsonWithFallbacks(extractedId, fetchImpl, {
      refererUrl: htmlResult?.canonicalId ? buildMeinTurnierplanShowitUrl(extractedId) : refererUrl,
    });
  }
  if (!htmlResult && !fetchResult.ok) {
    htmlResult = await fetchEmbeddedPlan(pageUrl, extractedId, fetchImpl);
  }
  const analysis = htmlResult?.ok ? htmlResult.analysis : fetchResult.analysis;
  const diagnostics = {
    linkRecognized: true,
    idExtracted: true,
    extractedId,
    apiReachable: fetchResult.apiReachable,
    provider: 'meinturnierplan',
    attemptedEndpoints: fetchResult.attemptedEndpoints,
    endpointAttempts: fetchResult.endpointAttempts,
    source: htmlResult?.ok ? 'html_fallback' : 'server_api',
    fallbackStage: htmlResult ? 'html' : 'json',
    htmlFallbackAttempted: Boolean(htmlResult),
    htmlFallbackSuccessful: Boolean(htmlResult?.ok),
    showitPageReachable: htmlResult?.reachable ?? null,
    htmlFallbackError: htmlResult?.error ?? null,
    htmlFallbackTeamsFound: htmlResult?.analysis?.teamCount ?? 0,
    htmlFallbackMatchesFound: htmlResult?.analysis?.matchCount ?? 0,
    detectedTeamCount: analysis?.teamCount ?? 0,
    detectedMatchCount: analysis?.matchCount ?? 0,
    ...urlDiagnostics,
    finalRedirectUrl: htmlResult?.finalUrl ?? urlDiagnostics.finalRedirectUrl,
  };
  if (!analysis) {
    const code = htmlResult?.reachable ? 'import_data_unavailable' : fetchResult.code || 'api_unreachable';
    return { ...buildFailure(code, extractedId, fetchResult.attemptedEndpoints), diagnostics };
  }
  return { ok: true, provider: 'meinturnierplan', extractedId,
    attemptedEndpoints: fetchResult.attemptedEndpoints, analysis, diagnostics };
}
