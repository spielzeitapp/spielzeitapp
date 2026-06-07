/**
 * JSON-only MeinTurnierplan-Analyse für Vercel API — ohne HTML/Browser/Supabase.
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
] as const;

const MEIN_TURNIERPLAN_HOSTS = new Set([
  'meinturnierplan.de',
  'www.meinturnierplan.de',
  'meinturnierplan.com',
  'www.meinturnierplan.com',
  'tournamentbase.com',
  'www.tournamentbase.com',
]);

type TournamentPlanAnalyzeErrorCode =
  | 'unsupported_host'
  | 'id_not_found'
  | 'api_unreachable'
  | 'import_data_unavailable'
  | 'no_groups'
  | 'no_teams'
  | 'no_matches'
  | 'plan_no_longer_provided'
  | 'parse_failed';

type TournamentMatchPhase = 'group' | 'placement' | 'semifinal' | 'final' | 'unknown';

type MeinTurnierplanParticipant = { id?: number; name?: string };
type MeinTurnierplanGroup = { displayId?: string };
type MeinTurnierplanGroupMatch = {
  groupId?: number;
  dateAndTime?: string;
  homeParticipant?: number;
  awayParticipant?: number;
  courtId?: number;
};
type MeinTurnierplanSourceTeam = { type?: string; group?: number; rank?: number };
type MeinTurnierplanModeMapping = { type?: string; round?: number; match?: number };
type MeinTurnierplanFinalMatch = {
  dateAndTime?: string;
  homeParticipant?: number;
  awayParticipant?: number;
  courtId?: number;
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

  ok: true;
  provider: 'meinturnierplan';
  teamCount: number;
  groupCount: number;
  matchCount: number;
};

export type TournamentPlanJsonAnalyzeFailure = {
  ok: false;
  provider: 'meinturnierplan';
  code: TournamentPlanAnalyzeErrorCode;
  message: string;
  extractedId: string | null;
  attemptedEndpoints: string[];
  httpStatus: number;
};

export type TournamentPlanJsonAnalyzeResult =
  | TournamentPlanJsonAnalyzeSuccess
  | TournamentPlanJsonAnalyzeFailure;

function normalizeTournamentPlanUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractMeinTurnierplanId(url: string): string | null {
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

function isSupportedTournamentPlanHost(url: string): boolean {
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

function buildMeinTurnierplanJsonEndpoints(tournamentId: string): string[] {
  const id = tournamentId.trim();
  return MEIN_TURNIERPLAN_JSON_ENDPOINT_HOSTS.map(
    (base) => `${base}?id=${encodeURIComponent(id)}`,
  );
}

function buildMeinTurnierplanShowitUrl(tournamentId: string): string {
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

function captureMeinTurnierplanFetchException(err: unknown): {
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
  const message = String(err).trim() || 'Unknown error';
  return { exceptionName: 'Error', exceptionMessage: message, errorDetail: message };
}

function messageForCode(code: TournamentPlanAnalyzeErrorCode): string {
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

function httpStatusForCode(code: TournamentPlanAnalyzeErrorCode): number {
  if (code === 'api_unreachable' || code === 'import_data_unavailable') return 502;
  if (code === 'unsupported_host' || code === 'id_not_found') return 422;
  return 422;
}

function buildFailure(
  code: TournamentPlanAnalyzeErrorCode,
  extractedId: string | null,
  attemptedEndpoints: string[],
): TournamentPlanJsonAnalyzeFailure {
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

function participantName(
  participants: Record<string, MeinTurnierplanParticipant>,
  id: number | undefined,
): string {
  if (id == null) return '';
  const entry = participants[String(id)] ?? participants[id as unknown as string];
  return (entry?.name ?? '').trim();
}

function diagnoseMeinTurnierplanPayload(data: unknown): TournamentPlanAnalyzeErrorCode | 'ok' {
  const json = data as MeinTurnierplanJson;
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

function kickoffHHmmFromDateTime(dateAndTime: string | undefined): string {
  const raw = (dateAndTime ?? '').trim();
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return '10:00';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function inferKnockoutPhaseFromMeinTurnierplan(
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

  if (round === 1 && matchNo === 1 && minRank === 1 && maxRank === 1) return 'final';
  if (maxRank >= 5 || matchNo >= 5) return 'placement';
  if (round >= 2) return 'semifinal';
  if (maxRank <= 2 && matchNo <= 2) return 'semifinal';
  if (maxRank === 3 || maxRank === 4) return 'placement';
  return 'unknown';
}

function parseMeinTurnierplanJson(data: unknown): {
  teamCount: number;
  groupCount: number;
  matchCount: number;
} | null {
  const json = data as MeinTurnierplanJson;
  if (
    !json?.participants ||
    typeof json.participants !== 'object' ||
    !Array.isArray(json.groups) ||
    json.groups.length === 0
  ) {
    return null;
  }

  const participants = json.participants;
  const teams: { teamName: string; groupLabel: string | null }[] = [];
  const groupSummaries: { label: string; teamCount: number }[] = [];

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
  const rawMatches: unknown[] = [];

  for (const match of json.groupMatches ?? []) {
    const homeTeam = participantName(participants, match.homeParticipant);
    const awayTeam = participantName(participants, match.awayParticipant);
    if (!homeTeam || !awayTeam) continue;

    rawMatches.push({
      homeTeam,
      awayTeam,
      plannedMinutes: groupMinutes,
      courtId: match.courtId,
      courts,
    });
  }

  for (const match of json.finalMatches ?? []) {
    const homeTeam = participantName(participants, match.homeParticipant);
    const awayTeam = participantName(participants, match.awayParticipant);
    if (!homeTeam || !awayTeam) continue;

    rawMatches.push({
      homeTeam,
      awayTeam,
      plannedMinutes: knockoutMinutes,
      phase: inferKnockoutPhaseFromMeinTurnierplan(
        match.modeMapping,
        match.sourceTeam1,
        match.sourceTeam2,
      ),
      kickoff: kickoffHHmmFromDateTime(match.dateAndTime),
    });
  }

  return {
    teamCount: teams.length,
    groupCount: groupSummaries.length > 0 ? groupSummaries.length : 1,
    matchCount: rawMatches.length,
  };
}

async function fetchMeinTurnierplanJsonWithFallbacks(
  tournamentId: string,
  fetchImpl: typeof fetch = fetch,
  options?: { refererUrl?: string },
): Promise<
  | { ok: true; json: unknown; attemptedEndpoints: string[] }
  | { ok: false; attemptedEndpoints: string[]; code: TournamentPlanAnalyzeErrorCode }
> {
  const attemptedEndpoints = buildMeinTurnierplanJsonEndpoints(tournamentId);
  const refererUrl = options?.refererUrl ?? buildMeinTurnierplanShowitUrl(tournamentId);
  let apiReachable = false;
  let bestFailureCode: TournamentPlanAnalyzeErrorCode = 'plan_no_longer_provided';

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

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        bestFailureCode = 'parse_failed';
        continue;
      }

      const diagnose = diagnoseMeinTurnierplanPayload(json);
      if (diagnose !== 'ok') {
        if (diagnose === 'no_groups' || diagnose === 'no_teams' || diagnose === 'no_matches') {
          bestFailureCode = diagnose;
        } else if (diagnose === 'plan_no_longer_provided') {
          bestFailureCode = diagnose;
        }
        continue;
      }

      const analysis = parseMeinTurnierplanJson(json);
      if (analysis) {
        return { ok: true, json, attemptedEndpoints };
      }
      bestFailureCode = 'parse_failed';
    } catch {
      /* try next endpoint */
    }
  }

  const code: TournamentPlanAnalyzeErrorCode = apiReachable ? bestFailureCode : 'api_unreachable';
  return { ok: false, attemptedEndpoints, code };
}

export async function analyzeTournamentPlanJson(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TournamentPlanJsonAnalyzeResult> {
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
