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

export type TournamentPlanRefreshPreview = {
  newTeams: number;
  newMatches: number;
  existingMatches: number;
};

export const TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE = 'Turnierplan wird aktuell nicht unterstützt.';
export const TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE = 'Turnierplan konnte nicht analysiert werden.';

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

export function extractMeinTurnierplanId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const id = parsed.searchParams.get('id')?.trim();
  return id || null;
}

export function isSupportedTournamentPlanHost(url: string): boolean {
  try {
    return MEIN_TURNIERPLAN_HOSTS.has(new URL(url.trim()).hostname.toLowerCase());
  } catch {
    return false;
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
  ownTeamNameHint: string | null | undefined,
): string | null {
  const hint = normalizeTeamMatchKey(ownTeamNameHint ?? '');
  if (!hint) return null;

  const exact = teams.find((t) => normalizeTeamMatchKey(t.teamName) === hint);
  if (exact) return exact.teamName;

  const contains = teams.find((t) => {
    const key = normalizeTeamMatchKey(t.teamName);
    return key.includes(hint) || hint.includes(key);
  });
  return contains?.teamName ?? null;
}

export function buildImportMatchesForOwnTeam(
  rawMatches: TournamentPlanImportRawMatch[],
  ownTeamName: string | null,
): TournamentPlanImportMatch[] {
  if (!ownTeamName) return [];

  const ownKey = normalizeTeamMatchKey(ownTeamName);
  const result: TournamentPlanImportMatch[] = [];

  for (const match of rawMatches) {
    const homeKey = normalizeTeamMatchKey(match.homeTeam);
    const awayKey = normalizeTeamMatchKey(match.awayTeam);
    let opponentName: string | null = null;

    if (homeKey === ownKey) opponentName = match.awayTeam;
    else if (awayKey === ownKey) opponentName = match.homeTeam;

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
  ownTeamNameHint?: string | null;
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

  const ownTeamName = findOwnTeamInImport(params.analysis.teams, params.ownTeamNameHint);
  const importMatches = buildImportMatchesForOwnTeam(params.analysis.rawMatches, ownTeamName);

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

export async function analyzeTournamentUrl(
  url: string,
  _ownTeamNameHint?: string | null,
): Promise<{ ok: true; analysis: TournamentPlanAnalysis } | { ok: false; error: string }> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, error: TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE };
  }

  const params = new URLSearchParams({ url: trimmed });

  try {
    const res = await fetch(`/api/tournament-plan/analyze?${params.toString()}`);
    const body = (await res.json()) as {
      ok?: boolean;
      analysis?: TournamentPlanAnalysis;
      error?: string;
    };

    if (res.ok && body.ok && body.analysis) {
      return { ok: true, analysis: body.analysis };
    }

    if (body.error && res.status !== 404) {
      return { ok: false, error: body.error };
    }
  } catch {
    /* API nicht erreichbar */
  }

  return analyzeTournamentUrlDirect(trimmed);
}

async function analyzeTournamentUrlDirect(
  url: string,
): Promise<{ ok: true; analysis: TournamentPlanAnalysis } | { ok: false; error: string }> {
  if (!isSupportedTournamentPlanHost(url)) {
    return { ok: false, error: TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE };
  }

  const tournamentId = extractMeinTurnierplanId(url);
  if (!tournamentId) {
    return { ok: false, error: TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE };
  }

  try {
    const res = await fetch(
      `https://www.meinturnierplan.de/json/json.php?id=${encodeURIComponent(tournamentId)}`,
    );
    if (!res.ok) {
      return { ok: false, error: TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE };
    }
    const analysis = parseMeinTurnierplanJson(await res.json());
    if (!analysis) {
      return { ok: false, error: TOURNAMENT_IMPORT_UNSUPPORTED_MESSAGE };
    }
    return { ok: true, analysis };
  } catch {
    return { ok: false, error: TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE };
  }
}

export async function fetchOwnTeamNameHint(teamSeasonId: string): Promise<string | null> {
  const { supabase } = await import('./supabaseClient');
  const { data, error } = await supabase
    .from('team_seasons')
    .select('name, teams(name)')
    .eq('id', teamSeasonId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { name?: string | null; teams?: { name?: string } | { name?: string }[] | null };
  const teams = row.teams;
  const teamObj = Array.isArray(teams) ? teams[0] : teams;
  return (teamObj?.name ?? row.name ?? '').trim() || null;
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
  ownTeamNameHint?: string | null;
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

  const ownTeamName = findOwnTeamInImport(params.analysis.teams, params.ownTeamNameHint);
  const importMatches = buildImportMatchesForOwnTeam(params.analysis.rawMatches, ownTeamName);
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
