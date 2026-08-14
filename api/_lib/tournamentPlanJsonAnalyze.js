/**
 * JSON-only MeinTurnierplan-Analyse — colocated with Vercel API (no src/lib imports).
 */

const MEIN_TURNIERPLAN_FETCH_TIMEOUT_MS = 15_000;

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
  const json = data;
  if (
    !json?.participants ||
    typeof json.participants !== 'object' ||
    !Array.isArray(json.groups) ||
    json.groups.length === 0
  ) {
    return null;
  }

  const participants = json.participants;
  const teams = [];
  const groupSummaries = [];

  for (let groupIndex = 0; groupIndex < json.groups.length; groupIndex += 1) {
    const displayId = (json.groups[groupIndex]?.displayId ?? '').trim();
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

  const groupMinutes = Math.max(1, Math.min(120, Math.trunc(json.groupMatchDuration ?? 10) || 10));
  const knockoutMinutes = Math.max(
    1,
    Math.min(120, Math.trunc(json.finalMatchDuration ?? json.groupMatchDuration ?? 10) || 10),
  );
  const courts = json.courts ?? [];
  const rawMatches = [];

  for (const match of json.groupMatches ?? []) {
    const homeTeam = participantName(participants, match.homeParticipant);
    const awayTeam = participantName(participants, match.awayParticipant);
    if (!homeTeam || !awayTeam) continue;

    const groupIdx = match.groupId ?? 0;
    const groupLabel = (json.groups[groupIdx]?.displayId ?? '').trim() || null;
    const court = courts[match.courtId ?? -1];
    const pitch = court?.displayId?.trim() ? `Platz ${court.displayId.trim()}` : null;

    pushRawMatch(rawMatches, {
      source: match,
      homeTeam,
      awayTeam,
      groupLabel,
      phase: 'group',
      kickoffTimeHHmm: kickoffHHmmFromDateTime(match.dateAndTime),
      plannedMinutes: groupMinutes,
      pitch,
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
    const pitch = court?.displayId?.trim() ? `Platz ${court.displayId.trim()}` : null;

    pushRawMatch(rawMatches, {
      source: match,
      homeTeam,
      awayTeam,
      groupLabel: null,
      phase,
      kickoffTimeHHmm: kickoffHHmmFromDateTime(match.dateAndTime),
      plannedMinutes: knockoutMinutes,
      pitch,
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

async function fetchMeinTurnierplanJsonWithFallbacks(tournamentId, fetchImpl = fetch, options = {}) {
  const attemptedEndpoints = buildMeinTurnierplanJsonEndpoints(tournamentId);
  const refererUrl = options.refererUrl ?? buildMeinTurnierplanShowitUrl(tournamentId);
  let apiReachable = false;
  let bestFailureCode = 'plan_no_longer_provided';

  for (const endpoint of attemptedEndpoints) {
    try {
      const res = await fetchMeinTurnierplanWithTimeout(
        endpoint,
        { headers: buildMeinTurnierplanFetchHeaders(refererUrl) },
        fetchImpl,
      );
      apiReachable = true;

      if (!res.ok) {
        if (res.status >= 500) bestFailureCode = 'api_unreachable';
        continue;
      }

      let payload;
      try {
        payload = await res.json();
      } catch {
        bestFailureCode = 'parse_failed';
        continue;
      }

      const diagnose = diagnoseMeinTurnierplanPayload(payload);
      if (diagnose !== 'ok') {
        if (diagnose === 'no_groups' || diagnose === 'no_teams' || diagnose === 'no_matches') {
          bestFailureCode = diagnose;
        } else if (diagnose === 'plan_no_longer_provided') {
          bestFailureCode = diagnose;
        }
        continue;
      }

      const analysis = parseMeinTurnierplanJson(payload);
      if (analysis) {
        return { ok: true, json: payload, attemptedEndpoints, analysis };
      }
      bestFailureCode = 'parse_failed';
    } catch {
      /* try next endpoint */
    }
  }

  const code = apiReachable ? bestFailureCode : 'api_unreachable';
  return { ok: false, attemptedEndpoints, code };
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
  const extractedId = resolution.detectedId;
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

  const fetchResult = await fetchMeinTurnierplanJsonWithFallbacks(extractedId, fetchImpl, {
    refererUrl,
  });

  if (!fetchResult.ok) {
    return buildFailure(fetchResult.code, extractedId, fetchResult.attemptedEndpoints);
  }

  const analysis = fetchResult.analysis ?? parseMeinTurnierplanJson(fetchResult.json);
  if (!analysis) {
    return buildFailure('parse_failed', extractedId, fetchResult.attemptedEndpoints);
  }

  return {
    ok: true,
    provider: 'meinturnierplan',
    extractedId,
    attemptedEndpoints: fetchResult.attemptedEndpoints,
    analysis,
    diagnostics: {
      linkRecognized: true,
      idExtracted: true,
      extractedId,
      apiReachable: true,
      provider: 'meinturnierplan',
      attemptedEndpoints: fetchResult.attemptedEndpoints,
      source: 'server_api',
      fallbackStage: 'json',
      ...urlDiagnostics,
    },
  };
}
