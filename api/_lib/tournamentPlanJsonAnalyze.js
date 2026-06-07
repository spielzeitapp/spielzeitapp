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

function normalizeTournamentPlanUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractMeinTurnierplanId(url) {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(normalizeTournamentPlanUrl(trimmed));
    const fromQuery = parsed.searchParams.get('id')?.trim();
    if (fromQuery) return fromQuery;
  } catch {
    /* Regex-Fallback */
  }

  const match = trimmed.match(/[?&]id=([^&#]+)/i);
  return match?.[1]?.trim() || null;
}

function isSupportedTournamentPlanHost(url) {
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const host = new URL(normalizeTournamentPlanUrl(trimmed)).hostname.toLowerCase();
    if (MEIN_TURNIERPLAN_HOSTS.has(host)) return true;
    return /(^|\.)meinturnierplan\.(de|com)$/.test(host) || /(^|\.)tournamentbase\.com$/.test(host);
  } catch {
    return /meinturnierplan\.(de|com)/i.test(trimmed) && /showit\.php/i.test(trimmed);
  }
}

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

function parseMeinTurnierplanJson(data) {
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

  let matchCount = 0;

  for (const match of json.groupMatches ?? []) {
    const homeTeam = participantName(participants, match.homeParticipant);
    const awayTeam = participantName(participants, match.awayParticipant);
    if (homeTeam && awayTeam) matchCount += 1;
  }

  for (const match of json.finalMatches ?? []) {
    const homeTeam = participantName(participants, match.homeParticipant);
    const awayTeam = participantName(participants, match.awayParticipant);
    if (homeTeam && awayTeam) matchCount += 1;
  }

  return {
    teamCount: teams.length,
    groupCount: groupSummaries.length > 0 ? groupSummaries.length : 1,
    matchCount,
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
        return { ok: true, json: payload, attemptedEndpoints };
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

  if (!isSupportedTournamentPlanHost(trimmed)) {
    return buildFailure('unsupported_host', null, []);
  }

  const extractedId = extractMeinTurnierplanId(trimmed);
  if (!extractedId) {
    return buildFailure('id_not_found', null, []);
  }

  const refererUrl = /showit\.php/i.test(trimmed)
    ? normalizeTournamentPlanUrl(trimmed)
    : buildMeinTurnierplanShowitUrl(extractedId);

  const fetchResult = await fetchMeinTurnierplanJsonWithFallbacks(extractedId, fetchImpl, {
    refererUrl,
  });

  if (!fetchResult.ok) {
    return buildFailure(fetchResult.code, extractedId, fetchResult.attemptedEndpoints);
  }

  const analysis = parseMeinTurnierplanJson(fetchResult.json);
  if (!analysis) {
    return buildFailure('parse_failed', extractedId, fetchResult.attemptedEndpoints);
  }

  return {
    ok: true,
    provider: 'meinturnierplan',
    teamCount: analysis.teamCount,
    groupCount: analysis.groupCount,
    matchCount: analysis.matchCount,
  };
}
