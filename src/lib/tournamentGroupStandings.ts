import { safeOptionalText, safeText } from './safeText';
import { isTeamAliasMatch } from './teamSeasonAliasMatch';
import type { TournamentMatchSlotView, TournamentParticipant } from './tournamentPlan';
import type { TournamentPlanImportRawMatch } from './tournamentPlanImport';
import { normalizeTeamMatchKey } from './tournamentPlanImport';

export type TournamentGroupStandingRow = {
  rank: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  isOurTeam: boolean;
};

export type TournamentGroupStandings = {
  groupLabel: string;
  rows: TournamentGroupStandingRow[];
  ourRank: number | null;
  teamCount: number;
};

export type TournamentStandingsSource = 'imported' | 'live';

export type TournamentStandingsBundle = {
  source: TournamentStandingsSource | null;
  groups: TournamentGroupStandings[];
  primaryGroup: TournamentGroupStandings | null;
};

type MutableStanding = {
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

function groupLabelKey(label: unknown): string {
  return safeText(label).toLowerCase() || '_default';
}

function displayGroupLabel(label: unknown): string {
  const trimmed = safeText(label);
  return trimmed || '1';
}

function standingSortKey(row: Omit<TournamentGroupStandingRow, 'rank' | 'isOurTeam'>): [number, number, number, string] {
  return [row.points, row.goalDifference, row.goalsFor, row.teamName];
}

function sameStanding(
  a: Omit<TournamentGroupStandingRow, 'rank' | 'isOurTeam'>,
  b: Omit<TournamentGroupStandingRow, 'rank' | 'isOurTeam'>,
): boolean {
  const ka = standingSortKey(a);
  const kb = standingSortKey(b);
  return ka[0] === kb[0] && ka[1] === kb[1] && ka[2] === kb[2];
}

function applyMatchResult(
  stats: Map<string, MutableStanding>,
  homeKey: string,
  awayKey: string,
  homeGoals: number,
  awayGoals: number,
): void {
  const home = stats.get(homeKey);
  const away = stats.get(awayKey);
  if (!home || !away) return;

  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    home.wins += 1;
    away.losses += 1;
  } else if (homeGoals < awayGoals) {
    home.losses += 1;
    away.wins += 1;
  } else {
    home.draws += 1;
    away.draws += 1;
  }
}

function resolveParticipantKey(
  teamName: string,
  keyToTeamName: Map<string, string>,
): string | null {
  const key = normalizeTeamMatchKey(teamName);
  if (keyToTeamName.has(key)) return key;
  for (const [participantKey, participantName] of keyToTeamName) {
    if (isTeamAliasMatch(teamName, [participantName])) return participantKey;
  }
  return null;
}

export function formatTournamentGroupRankDisplay(rank: number, total: number): string {
  if (rank === 1) return `🥇 Platz 1 von ${total}`;
  if (rank === 2) return `🥈 Platz 2 von ${total}`;
  if (rank === 3) return `🥉 Platz 3 von ${total}`;
  return `Platz ${rank} von ${total}`;
}

export function computeTournamentGroupStandings(params: {
  participants: TournamentParticipant[];
  rawMatches: TournamentPlanImportRawMatch[];
  ourTeamNames: string[];
}): TournamentGroupStandings | null {
  if (participants.length === 0 || params.ourTeamNames.length === 0) return null;

  let ourParticipant: TournamentParticipant | null = null;
  for (const participant of params.participants) {
    if (isTeamAliasMatch(participant.team_name, params.ourTeamNames)) {
      ourParticipant = participant;
      break;
    }
  }
  if (!ourParticipant) return null;

  const ourGroupLabel = ourParticipant.group_label;
  const targetGroupKey = groupLabelKey(ourGroupLabel);
  const groupParticipants = params.participants.filter(
    (p) => groupLabelKey(p.group_label) === targetGroupKey,
  );
  if (groupParticipants.length === 0) return null;

  const keyToTeamName = new Map<string, string>();
  const stats = new Map<string, MutableStanding>();
  for (const participant of groupParticipants) {
    const key = normalizeTeamMatchKey(participant.team_name);
    keyToTeamName.set(key, participant.team_name);
    stats.set(key, {
      teamName: participant.team_name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    });
  }

  for (const match of params.rawMatches) {
    if (match.phase !== 'group') continue;
    if (groupLabelKey(match.groupLabel) !== targetGroupKey) continue;
    if (!match.hasResult || match.homeGoals == null || match.awayGoals == null) continue;

    const homeKey = resolveParticipantKey(match.homeTeam, keyToTeamName);
    const awayKey = resolveParticipantKey(match.awayTeam, keyToTeamName);
    if (!homeKey || !awayKey || homeKey === awayKey) continue;

    applyMatchResult(stats, homeKey, awayKey, match.homeGoals, match.awayGoals);
  }

  return buildStandingsFromStats(stats, params.ourTeamNames, ourGroupLabel);
}

function isGroupStageSlot(slot: TournamentMatchSlotView): boolean {
  const phase = safeText(slot.phase).toLowerCase();
  if (
    phase === 'final' ||
    phase === 'finale' ||
    phase === 'semifinal' ||
    phase === 'halbfinale' ||
    phase === 'placement' ||
    phase.includes('platz')
  ) {
    return false;
  }
  return true;
}

function buildStandingsFromStats(
  stats: Map<string, MutableStanding>,
  ourTeamNames: string[],
  groupLabel: unknown,
): TournamentGroupStandings {
  const unsorted: Omit<TournamentGroupStandingRow, 'rank'>[] = [...stats.values()].map((row) => {
    const goalDifference = row.goalsFor - row.goalsAgainst;
    const points = row.wins * 3 + row.draws;
    return {
      teamName: row.teamName,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference,
      points,
      isOurTeam: isTeamAliasMatch(row.teamName, ourTeamNames),
    };
  });

  unsorted.sort((a, b) => {
    const ka = standingSortKey(a);
    const kb = standingSortKey(b);
    if (kb[0] !== ka[0]) return kb[0] - ka[0];
    if (kb[1] !== ka[1]) return kb[1] - ka[1];
    if (kb[2] !== ka[2]) return kb[2] - ka[2];
    return ka[3].localeCompare(kb[3], 'de');
  });

  const rows: TournamentGroupStandingRow[] = [];
  let rank = 1;
  for (let i = 0; i < unsorted.length; i += 1) {
    if (i > 0 && !sameStanding(unsorted[i], unsorted[i - 1])) {
      rank = i + 1;
    }
    rows.push({ ...unsorted[i], rank });
  }

  const ourRow = rows.find((row) => row.isOurTeam) ?? null;

  return {
    groupLabel: displayGroupLabel(groupLabel),
    rows,
    ourRank: ourRow?.rank ?? null,
    teamCount: rows.length,
  };
}

/** Gruppentabelle aus eigenen beendeten Turnierspielen (SpielzeitApp). */
export function computeLiveTournamentGroupStandingsForGroup(params: {
  participants: TournamentParticipant[];
  slots: TournamentMatchSlotView[];
  ourTeamNames: string[];
  targetGroupLabel: string | null;
}): TournamentGroupStandings | null {
  if (participants.length === 0 || params.ourTeamNames.length === 0) return null;

  const targetGroupKey = groupLabelKey(params.targetGroupLabel);
  const groupParticipants = params.participants.filter(
    (p) => groupLabelKey(p.group_label) === targetGroupKey,
  );
  if (groupParticipants.length === 0) return null;

  const ourParticipant = groupParticipants.find((p) =>
    isTeamAliasMatch(p.team_name, params.ourTeamNames),
  );
  if (!ourParticipant) return null;

  const keyToTeamName = new Map<string, string>();
  const stats = new Map<string, MutableStanding>();
  for (const participant of groupParticipants) {
    const key = normalizeTeamMatchKey(participant.team_name);
    keyToTeamName.set(key, participant.team_name);
    stats.set(key, {
      teamName: participant.team_name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    });
  }

  const ourKey = resolveParticipantKey(ourParticipant.team_name, keyToTeamName);
  if (!ourKey) return null;

  for (const slot of params.slots) {
    if ((slot.match_status ?? '').toLowerCase() !== 'finished') continue;
    if (!isGroupStageSlot(slot)) continue;
    if (groupLabelKey(slot.group_label ?? params.targetGroupLabel) !== targetGroupKey) continue;

    const ourGoals = Number(slot.score_home ?? 0);
    const oppGoals = Number(slot.score_away ?? 0);
    const opponentKey = resolveParticipantKey(slot.opponent_name, keyToTeamName);
    if (!opponentKey || opponentKey === ourKey) continue;

    applyMatchResult(stats, ourKey, opponentKey, ourGoals, oppGoals);
  }

  return buildStandingsFromStats(stats, params.ourTeamNames, params.targetGroupLabel);
}

export function computeAllLiveTournamentGroupStandings(params: {
  participants: TournamentParticipant[];
  slots: TournamentMatchSlotView[];
  ourTeamNames: string[];
}): TournamentGroupStandings[] {
  if (params.participants.length === 0 || params.ourTeamNames.length === 0) return [];

  const groupLabels = new Map<string, string | null>();
  for (const participant of params.participants) {
    const key = groupLabelKey(participant.group_label);
    if (!groupLabels.has(key)) {
      groupLabels.set(key, safeOptionalText(participant.group_label));
    }
  }

  const groups: TournamentGroupStandings[] = [];
  for (const [, label] of groupLabels) {
    const standings = computeLiveTournamentGroupStandingsForGroup({
      participants: params.participants,
      slots: params.slots,
      ourTeamNames: params.ourTeamNames,
      targetGroupLabel: label,
    });
    if (standings) groups.push(standings);
  }

  groups.sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, 'de', { numeric: true }));
  return groups;
}

export function pickPrimaryTournamentGroupStandings(
  groups: TournamentGroupStandings[],
): TournamentGroupStandings | null {
  const ours = groups.find((g) => g.rows.some((row) => row.isOurTeam));
  return ours ?? groups[0] ?? null;
}

export function tournamentStandingsHasPlayedMatches(
  bundle: TournamentStandingsBundle | null,
): boolean {
  if (!bundle) return false;
  return bundle.groups.some((group) => group.rows.some((row) => row.played > 0));
}

export function resolveTournamentStandingsBundle(params: {
  imported: TournamentGroupStandings | null;
  liveGroups: TournamentGroupStandings[];
}): TournamentStandingsBundle {
  if (params.imported && params.imported.rows.length > 0) {
    return {
      source: 'imported',
      groups: [params.imported],
      primaryGroup: params.imported,
    };
  }

  if (params.liveGroups.length > 0) {
    const primaryGroup = pickPrimaryTournamentGroupStandings(params.liveGroups);
    return {
      source: 'live',
      groups: params.liveGroups,
      primaryGroup,
    };
  }

  return {
    source: null,
    groups: [],
    primaryGroup: null,
  };
}

export function tournamentStandingsSourceHint(source: TournamentStandingsSource | null): string | null {
  if (source === 'live') return 'Aus SpielzeitApp-Ergebnissen berechnet';
  if (source === 'imported') return 'Aus offiziellem Turnierplan';
  return null;
}
