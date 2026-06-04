import {
  buildTournamentImportRecognition,
  isTeamAliasMatch,
  type TournamentImportRecognition,
} from './teamSeasonAliases';

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
};

export type TournamentPlanGroupSummary = {
  label: string;
  teamCount: number;
};

export type TournamentPlanAnalysis = {
  provider: 'meinturnierplan';
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
};

export type { TournamentImportRecognition };

export type TournamentPlanRefreshPreview = {
  newTeams: number;
  newMatches: number;
  existingMatches: number;
};

export const TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE = 'Turnierplan wird aktuell nicht unterstützt.';
export const TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE = 'Turnierplan konnte nicht analysiert werden.';

export const TOURNAMENT_IMPORT_MANUAL_HINT =
  'Dieser Turnierplan kann nicht automatisch importiert werden. Teams und Spiele können manuell oder per Schnellimport ergänzt werden.';

export type TournamentPlanAnalyzeErrorCode =
  | 'unsupported_host'
  | 'id_not_found'
  | 'api_unreachable'
  | 'no_groups'
  | 'no_teams'
  | 'no_matches'
  | 'plan_no_longer_provided'
  | 'parse_failed';

export type TournamentPlanAnalyzeDiagnostics = {
  linkRecognized: boolean;
  idExtracted: boolean;
  extractedId: string | null;
  apiReachable: boolean;
  provider: 'meinturnierplan';
  attemptedEndpoints: string[];
};

export type TournamentPlanAnalyzeFailure = {
  code: TournamentPlanAnalyzeErrorCode;
  message: string;
  provider: 'meinturnierplan';
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

const MEIN_TURNIERPLAN_HOSTS = new Set([
  'meinturnierplan.de',
  'www.meinturnierplan.de',
  'meinturnierplan.com',
  'www.meinturnierplan.com',
  'tournamentbase.com',
  'www.tournamentbase.com',
]);

type MeinTurnierplanParticipant = { id?: number; name?: string };
type MeinTurnierplanGroup = { displayId?: string };
type MeinTurnierplanGroupMatch = {
  groupId?: number;
  dateAndTime?: string;
  homeParticipant?: number;
  awayParticipant?: number;
  courtId?: number;
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

/** URL mit fehlendem Schema ergänzen (z. B. meinturnierplan.de/showit.php?id=…). */
export function normalizeTournamentPlanUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function extractMeinTurnierplanId(url: string): string | null {
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
  const fromRegex = match?.[1]?.trim();
  return fromRegex || null;
}

export function isSupportedTournamentPlanHost(url: string): boolean {
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

export function buildMeinTurnierplanJsonEndpoints(tournamentId: string): string[] {
  const id = tournamentId.trim();
  return MEIN_TURNIERPLAN_JSON_ENDPOINT_HOSTS.map(
    (base) => `${base}?id=${encodeURIComponent(id)}`,
  );
}

export function messageForTournamentPlanAnalyzeCode(code: TournamentPlanAnalyzeErrorCode): string {
  switch (code) {
    case 'unsupported_host':
      return TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE;
    case 'id_not_found':
      return 'Turnier-ID konnte aus dem Link nicht gelesen werden.';
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
      return TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE;
  }
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
  if (!Array.isArray(json.groups) || json.groups.length === 0) {
    return 'no_groups';
  }

  let teamCount = 0;
  for (let groupIndex = 0; groupIndex < json.groups.length; groupIndex += 1) {
    const participantIds = json.groupParticipants?.[groupIndex] ?? [];
    for (const participantId of participantIds) {
      const teamName = participantName(json.participants, participantId);
      if (teamName) teamCount += 1;
    }
  }
  if (teamCount === 0) return 'no_teams';

  const groupMatchCount = (json.groupMatches ?? []).filter((m) => {
    const home = participantName(json.participants, m.homeParticipant);
    const away = participantName(json.participants, m.awayParticipant);
    return Boolean(home && away);
  }).length;
  const finalMatchCount = (json.finalMatches ?? []).filter((m) => {
    const home = participantName(json.participants, m.homeParticipant);
    const away = participantName(json.participants, m.awayParticipant);
    return Boolean(home && away);
  }).length;
  if (groupMatchCount + finalMatchCount === 0) return 'no_matches';

  return 'ok';
}

type FetchMeinTurnierplanAttempt = {
  endpoint: string;
  httpStatus: number | null;
  networkError: boolean;
  parseCode: TournamentPlanAnalyzeErrorCode | 'ok' | null;
};

export async function fetchMeinTurnierplanJsonWithFallbacks(
  tournamentId: string,
  fetchImpl: typeof fetch = fetch,
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
  const attempts: FetchMeinTurnierplanAttempt[] = [];
  let apiReachable = false;
  let bestFailureCode: TournamentPlanAnalyzeErrorCode = 'plan_no_longer_provided';

  for (const endpoint of attemptedEndpoints) {
    const attempt: FetchMeinTurnierplanAttempt = {
      endpoint,
      httpStatus: null,
      networkError: false,
      parseCode: null,
    };
    attempts.push(attempt);

    try {
      const res = await fetchImpl(endpoint, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Spielzeitapp/1.0 (+tournament-import)',
        },
      });
      attempt.httpStatus = res.status;
      apiReachable = true;

      if (!res.ok) {
        if (res.status >= 500) bestFailureCode = 'api_unreachable';
        continue;
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        attempt.parseCode = 'parse_failed';
        bestFailureCode = 'parse_failed';
        continue;
      }

      const diagnose = diagnoseMeinTurnierplanPayload(json);
      attempt.parseCode = diagnose;
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
        return { ok: true, json, endpoint, attemptedEndpoints, attempts };
      }
      attempt.parseCode = 'parse_failed';
      bestFailureCode = 'parse_failed';
    } catch {
      attempt.networkError = true;
    }
  }

  const code: TournamentPlanAnalyzeErrorCode = apiReachable ? bestFailureCode : 'api_unreachable';
  return { ok: false, attemptedEndpoints, attempts, apiReachable, code };
}

export function buildTournamentPlanAnalyzeFailure(params: {
  code: TournamentPlanAnalyzeErrorCode;
  extractedId: string | null;
  attemptedEndpoints: string[];
  apiReachable: boolean;
  linkRecognized: boolean;
  idExtracted: boolean;
}): TournamentPlanAnalyzeFailure {
  return {
    code: params.code,
    message: messageForTournamentPlanAnalyzeCode(params.code),
    provider: 'meinturnierplan',
    extractedId: params.extractedId,
    attemptedEndpoints: params.attemptedEndpoints,
    diagnostics: {
      linkRecognized: params.linkRecognized,
      idExtracted: params.idExtracted,
      extractedId: params.extractedId,
      apiReachable: params.apiReachable,
      provider: 'meinturnierplan',
      attemptedEndpoints: params.attemptedEndpoints,
    },
  };
}

export type AnalyzeMeinTurnierplanUrlResult =
  | { ok: true; analysis: TournamentPlanAnalysis; diagnostics: TournamentPlanAnalyzeDiagnostics }
  | { ok: false; failure: TournamentPlanAnalyzeFailure; httpStatus: number };

export async function analyzeMeinTurnierplanUrl(
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
    });
    return { ok: false, failure, httpStatus: 422 };
  }

  const extractedId = extractMeinTurnierplanId(trimmed);
  const idExtracted = Boolean(extractedId);

  if (!extractedId) {
    const failure = buildTournamentPlanAnalyzeFailure({
      code: 'id_not_found',
      extractedId: null,
      attemptedEndpoints: [],
      apiReachable: false,
      linkRecognized: true,
      idExtracted: false,
    });
    return { ok: false, failure, httpStatus: 422 };
  }

  const fetchResult = await fetchMeinTurnierplanJsonWithFallbacks(extractedId, fetchImpl);

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
        },
      };
    }

    const parseFailure = buildTournamentPlanAnalyzeFailure({
      code: 'parse_failed',
      extractedId,
      attemptedEndpoints: fetchResult.attemptedEndpoints,
      apiReachable: true,
      linkRecognized: true,
      idExtracted: true,
    });
    return { ok: false, failure: parseFailure, httpStatus: 422 };
  }

  const failure = buildTournamentPlanAnalyzeFailure({
    code: fetchResult.code,
    extractedId,
    attemptedEndpoints: fetchResult.attemptedEndpoints,
    apiReachable: fetchResult.apiReachable,
    linkRecognized: true,
    idExtracted: true,
  });

  const httpStatus = failure.code === 'api_unreachable' ? 502 : 422;
  return { ok: false, failure, httpStatus };
}

function participantName(
  participants: Record<string, MeinTurnierplanParticipant>,
  id: number | undefined,
): string {
  if (id == null) return '';
  const entry = participants[String(id)] ?? participants[id as unknown as string];
  return (entry?.name ?? '').trim();
}

function kickoffHHmmFromDateTime(dateAndTime: string | undefined): string {
  const raw = (dateAndTime ?? '').trim();
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return '10:00';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
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

export function normalizeTeamMatchKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizePhaseForDedupe(phase: string | null | undefined): string {
  const p = (phase ?? '').trim().toLowerCase();
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
    (params.groupLabel?.trim() ? 'group' : 'unknown');
  const groupKey =
    phaseKey === 'group' ? normalizeTeamMatchKey(params.groupLabel ?? '') : phaseKey;
  return `${params.kickoffTimeHHmm}|${normalizeTeamMatchKey(params.opponentName)}|${groupKey}`;
}

export function parseMeinTurnierplanJson(data: unknown): TournamentPlanAnalysis | null {
  const json = data as MeinTurnierplanJson;
  if (!json?.participants || !Array.isArray(json.groups) || json.groups.length === 0) {
    return null;
  }

  const participants = json.participants;
  const teams: TournamentPlanImportTeam[] = [];
  const groupSummaries: TournamentPlanGroupSummary[] = [];

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
    const groupLabel = (json.groups[groupIdx]?.displayId ?? '').trim() || null;
    const court = courts[match.courtId ?? -1];
    const pitch = court?.displayId?.trim() ? `Platz ${court.displayId.trim()}` : null;

    rawMatches.push({
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

    rawMatches.push({
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

  const { isTeamAliasMatch } = require('./teamSeasonAliases') as typeof import('./teamSeasonAliases');

  let count = 0;
  for (const match of analysis.rawMatches) {
    const homeOurs = isTeamAliasMatch(match.homeTeam, knownNames);
    const awayOurs = isTeamAliasMatch(match.awayTeam, knownNames);
    if (homeOurs !== awayOurs) count += 1;
  }
  return count;
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

    result.push({
      opponentName,
      groupLabel: match.groupLabel,
      phase: match.phase,
      kickoffTimeHHmm: match.kickoffTimeHHmm,
      plannedMinutes: match.plannedMinutes,
      pitch: match.pitch,
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
    opponent_name: string;
    kickoff_at: string;
    group_label: string | null;
    phase?: string | null;
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

  const existingMatchKeys = new Set(
    params.existingSlots.map((slot) =>
      buildTournamentMatchDedupeKey({
        kickoffTimeHHmm: formatTournamentKickoffTime(slot.kickoff_at),
        opponentName: slot.opponent_name,
        groupLabel: slot.group_label,
        phase: slot.phase ?? (slot.group_label?.trim() ? 'group' : null),
      }),
    ),
  );

  const knownNames = params.knownNames ?? [];
  const importMatches = buildImportMatchesForOwnTeam(params.analysis.rawMatches, knownNames);

  let newMatches = 0;
  let existingMatches = 0;
  for (const match of importMatches) {
    if (existingMatchKeys.has(match.dedupeKey)) {
      existingMatches += 1;
    } else {
      newMatches += 1;
    }
  }

  return { newTeams, newMatches, existingMatches };
}

export type AnalyzeTournamentUrlResult =
  | { ok: true; analysis: TournamentPlanAnalysis; diagnostics?: TournamentPlanAnalyzeDiagnostics }
  | { ok: false; error: string; failure?: TournamentPlanAnalyzeFailure };

function analyzeResultFromMeinTurnierplan(
  result: AnalyzeMeinTurnierplanUrlResult,
): AnalyzeTournamentUrlResult {
  if (result.ok) {
    return { ok: true, analysis: result.analysis, diagnostics: result.diagnostics };
  }
  return { ok: false, error: result.failure.message, failure: result.failure };
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

  const params = new URLSearchParams({ url: trimmed });

  try {
    const res = await fetch(`/api/tournament-plan/analyze?${params.toString()}`);
    const body = (await res.json()) as {
      ok?: boolean;
      analysis?: TournamentPlanAnalysis;
      diagnostics?: TournamentPlanAnalyzeDiagnostics;
      error?: string;
      code?: TournamentPlanAnalyzeErrorCode;
      message?: string;
      provider?: 'meinturnierplan';
      extractedId?: string | null;
      attemptedEndpoints?: string[];
    };

    if (res.ok && body.ok && body.analysis) {
      return {
        ok: true,
        analysis: body.analysis,
        diagnostics: body.diagnostics,
      };
    }

    if (body.code && body.message) {
      const failure: TournamentPlanAnalyzeFailure = {
        code: body.code,
        message: body.message,
        provider: body.provider ?? 'meinturnierplan',
        extractedId: body.extractedId ?? null,
        attemptedEndpoints: body.attemptedEndpoints ?? [],
        diagnostics: {
          linkRecognized: isSupportedTournamentPlanHost(trimmed),
          idExtracted: Boolean(body.extractedId),
          extractedId: body.extractedId ?? null,
          apiReachable: body.code !== 'api_unreachable',
          provider: 'meinturnierplan',
          attemptedEndpoints: body.attemptedEndpoints ?? [],
        },
      };
      return { ok: false, error: failure.message, failure };
    }

    if (body.error && res.status !== 404) {
      return { ok: false, error: body.error };
    }
  } catch {
    /* API nicht erreichbar — Client-Fallback */
  }

  return analyzeResultFromMeinTurnierplan(await analyzeMeinTurnierplanUrl(trimmed));
}

export async function fetchTournamentImportRecognition(
  teamSeasonId: string,
): Promise<TournamentImportRecognition> {
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
    opponent_name: string;
    kickoff_at: string;
    group_label: string | null;
    phase?: string | null;
  }>;
  knownNames?: string[];
}): Promise<{
  importedTeams: number;
  importedMatches: number;
  skippedMatches: number;
  error: string | null;
}> {
  const {
    addTournamentParticipant,
    createTournamentMatchSlot,
    formatTournamentKickoffTime,
    normalizeTournamentDbError,
  } = await import('./tournamentPlan');

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
        error: normalizeTournamentDbError(error, null),
      };
    }
    existingTeamKeys.add(key);
    importedTeams += 1;
  }

  const knownNames = params.knownNames ?? [];
  const importMatches = buildImportMatchesForOwnTeam(params.analysis.rawMatches, knownNames);
  const existingMatchKeys = new Set(
    params.existingSlots.map((slot) =>
      buildTournamentMatchDedupeKey({
        kickoffTimeHHmm: formatTournamentKickoffTime(slot.kickoff_at),
        opponentName: slot.opponent_name,
        groupLabel: slot.group_label,
        phase: slot.phase ?? (slot.group_label?.trim() ? 'group' : null),
      }),
    ),
  );

  let importedMatches = 0;
  let skippedMatches = 0;

  for (const match of importMatches) {
    if (existingMatchKeys.has(match.dedupeKey)) {
      skippedMatches += 1;
      continue;
    }

    const { error } = await createTournamentMatchSlot({
      tournamentEventId: params.tournamentEventId,
      teamSeasonId: params.teamSeasonId,
      tournamentDayIso: params.tournamentDayIso,
      location: params.location,
      opponentName: match.opponentName,
      kickoffTimeHHmm: match.kickoffTimeHHmm,
      plannedMinutes: match.plannedMinutes,
      pitch: match.pitch,
      groupLabel: match.groupLabel,
      phase: match.phase === 'unknown' ? null : match.phase,
    });

    if (error) {
      return {
        importedTeams,
        importedMatches,
        skippedMatches,
        error: normalizeTournamentDbError(error, null),
      };
    }

    existingMatchKeys.add(match.dedupeKey);
    importedMatches += 1;
  }

  return { importedTeams, importedMatches, skippedMatches, error: null };
}
