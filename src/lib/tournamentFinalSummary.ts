import { isTeamAliasMatch } from './teamSeasonAliasMatch';
import type { TournamentGroupStandings } from './tournamentGroupStandings';
import type { TournamentTeamBalance, TournamentMatchSlotView } from './tournamentPlan';
import type { TournamentPlanImportRawMatch } from './tournamentPlanImport';

export type TournamentPlacementSource = 'final' | 'third_place_match' | 'group' | 'unknown';

export type TournamentFinalMatchDisplay = {
  title: string;
  scoreline: string;
};

export type TournamentFinalSummary = {
  tournamentCompleted: boolean;
  finalPlacementLabel: string | null;
  finalPlacementRank: number | null;
  finalPlacementTotal: number | null;
  placementSource: TournamentPlacementSource;
  finalMatch: TournamentFinalMatchDisplay | null;
};

type MatchOutcome = 'win' | 'loss' | 'draw';

function normalizeTournamentPhase(phase: string | null | undefined): string {
  const p = (phase ?? '').trim().toLowerCase();
  if (!p) return '';
  if (p === 'group' || p === 'gruppe' || p === 'vorrunde') return 'group';
  if (p === 'final' || p === 'finale' || p.includes('finalspiel')) return 'final';
  if (
    p === 'placement' ||
    p.includes('platz 3') ||
    p.includes('platzierung') ||
    p.includes('kleines finale') ||
    p.includes('spiel um platz 3')
  ) {
    return 'placement';
  }
  if (p === 'semifinal' || p === 'halbfinale') return 'semifinal';
  if (p === 'unknown') return 'unknown';
  return p;
}

function involvesOurTeam(teamName: string, ourTeamNames: string[]): boolean {
  return isTeamAliasMatch(teamName, ourTeamNames);
}

function matchOutcome(
  homeGoals: number,
  awayGoals: number,
  side: 'home' | 'away',
): MatchOutcome {
  if (homeGoals === awayGoals) return 'draw';
  if (side === 'home') return homeGoals > awayGoals ? 'win' : 'loss';
  return awayGoals > homeGoals ? 'win' : 'loss';
}

function rawMatchOutcomeForUs(
  match: TournamentPlanImportRawMatch,
  ourTeamNames: string[],
): MatchOutcome | null {
  if (!match.hasResult || match.homeGoals == null || match.awayGoals == null) return null;
  const homeIsUs = involvesOurTeam(match.homeTeam, ourTeamNames);
  const awayIsUs = involvesOurTeam(match.awayTeam, ourTeamNames);
  if (!homeIsUs && !awayIsUs) return null;
  if (homeIsUs && awayIsUs) return null;
  return matchOutcome(match.homeGoals, match.awayGoals, homeIsUs ? 'home' : 'away');
}

function slotOutcomeForUs(slot: TournamentMatchSlotView): MatchOutcome | null {
  if ((slot.match_status ?? '').toLowerCase() !== 'finished') return null;
  const ourGoals = Number(slot.score_home ?? 0);
  const oppGoals = Number(slot.score_away ?? 0);
  return matchOutcome(ourGoals, oppGoals, 'home');
}

function hasKnockoutStructure(matches: { phase: string }[]): boolean {
  return matches.some((match) => {
    const phase = normalizeTournamentPhase(match.phase);
    return phase === 'final' || phase === 'semifinal' || phase === 'placement';
  });
}

function computeTournamentCompleted(rawMatches: TournamentPlanImportRawMatch[]): boolean {
  if (rawMatches.length === 0) return false;

  const finals = rawMatches.filter((m) => normalizeTournamentPhase(m.phase) === 'final');
  if (finals.length > 0) {
    return finals.every((m) => m.hasResult);
  }

  const knockout = rawMatches.filter((m) => {
    const phase = normalizeTournamentPhase(m.phase);
    return phase === 'semifinal' || phase === 'placement';
  });
  if (knockout.length > 0) {
    return knockout.every((m) => m.hasResult);
  }

  const group = rawMatches.filter((m) => normalizeTournamentPhase(m.phase) === 'group');
  if (group.length > 0) {
    return group.every((m) => m.hasResult);
  }

  return false;
}

function computeTournamentCompletedFromSlots(slots: TournamentMatchSlotView[]): boolean {
  if (slots.length === 0) return false;
  return slots.every((slot) => (slot.match_status ?? '').toLowerCase() === 'finished');
}

function groupPlacementLabel(rank: number, groupLabel: string): string {
  return `${rank}. Platz Gruppe ${groupLabel}`;
}

function placementFromFinal(
  outcome: MatchOutcome,
  teamCount: number | null,
): Pick<TournamentFinalSummary, 'finalPlacementLabel' | 'finalPlacementRank' | 'finalPlacementTotal' | 'placementSource'> {
  if (outcome === 'win') {
    return {
      finalPlacementLabel: 'Turniersieger',
      finalPlacementRank: 1,
      finalPlacementTotal: teamCount,
      placementSource: 'final',
    };
  }
  if (outcome === 'loss') {
    return {
      finalPlacementLabel: '2. Platz',
      finalPlacementRank: 2,
      finalPlacementTotal: teamCount,
      placementSource: 'final',
    };
  }
  return {
    finalPlacementLabel: null,
    finalPlacementRank: null,
    finalPlacementTotal: null,
    placementSource: 'unknown',
  };
}

function placementFromThirdPlaceMatch(
  outcome: MatchOutcome,
  teamCount: number | null,
): Pick<TournamentFinalSummary, 'finalPlacementLabel' | 'finalPlacementRank' | 'finalPlacementTotal' | 'placementSource'> {
  if (outcome === 'win') {
    return {
      finalPlacementLabel: '3. Platz',
      finalPlacementRank: 3,
      finalPlacementTotal: teamCount,
      placementSource: 'third_place_match',
    };
  }
  if (outcome === 'loss') {
    return {
      finalPlacementLabel: '4. Platz',
      finalPlacementRank: 4,
      finalPlacementTotal: teamCount,
      placementSource: 'third_place_match',
    };
  }
  return {
    finalPlacementLabel: null,
    finalPlacementRank: null,
    finalPlacementTotal: null,
    placementSource: 'unknown',
  };
}

function placementFromGroup(
  groupStandings: TournamentGroupStandings,
): Pick<TournamentFinalSummary, 'finalPlacementLabel' | 'finalPlacementRank' | 'finalPlacementTotal' | 'placementSource'> {
  const ourRow = groupStandings.rows.find((row) => row.isOurTeam) ?? null;
  if (!ourRow || ourRow.rank == null) {
    return {
      finalPlacementLabel: null,
      finalPlacementRank: null,
      finalPlacementTotal: null,
      placementSource: 'unknown',
    };
  }
  return {
    finalPlacementLabel: groupPlacementLabel(ourRow.rank, groupStandings.groupLabel),
    finalPlacementRank: ourRow.rank,
    finalPlacementTotal: groupStandings.teamCount,
    placementSource: 'group',
  };
}

function findOurFinishedRawMatch(
  rawMatches: TournamentPlanImportRawMatch[],
  phase: 'final' | 'placement',
  ourTeamNames: string[],
): TournamentPlanImportRawMatch | null {
  return (
    rawMatches.find((match) => {
      if (normalizeTournamentPhase(match.phase) !== phase) return false;
      if (!match.hasResult) return false;
      return involvesOurTeam(match.homeTeam, ourTeamNames) || involvesOurTeam(match.awayTeam, ourTeamNames);
    }) ?? null
  );
}

function findOurFinishedSlot(
  slots: TournamentMatchSlotView[],
  phase: 'final' | 'placement',
): TournamentMatchSlotView | null {
  return (
    slots.find((slot) => {
      if (normalizeTournamentPhase(slot.phase) !== phase) return false;
      return (slot.match_status ?? '').toLowerCase() === 'finished';
    }) ?? null
  );
}

function buildFinalMatchDisplay(params: {
  rawMatch: TournamentPlanImportRawMatch | null;
  slot: TournamentMatchSlotView | null;
  ourTeamNames: string[];
}): TournamentFinalMatchDisplay | null {
  if (
    params.rawMatch?.hasResult &&
    params.rawMatch.homeGoals != null &&
    params.rawMatch.awayGoals != null
  ) {
    return {
      title: 'Finale',
      scoreline: `${params.rawMatch.homeTeam} ${params.rawMatch.homeGoals}:${params.rawMatch.awayGoals} ${params.rawMatch.awayTeam}`,
    };
  }

  if (params.slot && (params.slot.match_status ?? '').toLowerCase() === 'finished') {
    const ourName = params.ourTeamNames.find((name) => name.trim())?.trim() || 'Unser Team';
    return {
      title: 'Finale',
      scoreline: `${ourName} ${params.slot.score_home}:${params.slot.score_away} ${params.slot.opponent_name}`,
    };
  }

  return null;
}

export function formatTournamentPlacementRankLine(summary: TournamentFinalSummary): string | null {
  if (!summary.finalPlacementLabel) return null;

  if (summary.placementSource === 'group') {
    return formatTournamentFinalPlacementHeadline(summary);
  }

  const rank = summary.finalPlacementRank;
  const total = summary.finalPlacementTotal;
  if (rank != null && total != null) {
    if (rank === 1) return `🥇 1. Platz von ${total} Teams`;
    if (rank === 2) return `🥈 2. Platz von ${total} Teams`;
    if (rank === 3) return `🥉 3. Platz von ${total} Teams`;
    return `${rank}. Platz von ${total} Teams`;
  }

  return formatTournamentFinalPlacementHeadline(summary);
}

export function formatTournamentFinalPlacementHeadline(summary: TournamentFinalSummary): string | null {
  if (!summary.finalPlacementLabel) return null;
  const label = summary.finalPlacementLabel;

  if (label === 'Turniersieger') return '🏆 Turniersieger';
  if (label === '2. Platz') return '🥈 2. Platz';
  if (label === '3. Platz') return '🥉 3. Platz';
  if (label === '4. Platz') return '4. Platz';

  const groupMatch = /^(\d+)\. Platz Gruppe (.+)$/.exec(label);
  if (groupMatch) {
    const rank = Number.parseInt(groupMatch[1] ?? '', 10);
    const groupName = groupMatch[2] ?? '';
    if (rank === 1) return `🥇 1. Platz Gruppe ${groupName}`;
    if (rank === 2) return `🥈 2. Platz Gruppe ${groupName}`;
    if (rank === 3) return `🥉 3. Platz Gruppe ${groupName}`;
    return `${rank}. Platz Gruppe ${groupName}`;
  }

  return label;
}

export function tournamentPlacementSourceHint(source: TournamentPlacementSource): string | null {
  if (source === 'group') return 'Platzierung aus Gruppenphase berechnet';
  if (source === 'final') return 'Platzierung aus Finalspiel berechnet';
  if (source === 'third_place_match') return 'Platzierung aus Spiel um Platz 3 berechnet';
  return null;
}

export function canCompleteTournament(
  balance: TournamentTeamBalance,
  summary: TournamentFinalSummary | null,
): boolean {
  if (!summary?.finalPlacementLabel) return false;
  return balance.isCompleted;
}

export function shouldShowTournamentFinalSummaryCard(
  balance: TournamentTeamBalance,
  summary: TournamentFinalSummary | null,
): boolean {
  if (!summary?.finalPlacementLabel) return false;
  if (balance.played < 1) return false;
  return summary.tournamentCompleted || balance.isCompleted;
}

export function computeTournamentFinalSummary(params: {
  balance: TournamentTeamBalance;
  rawMatches?: TournamentPlanImportRawMatch[];
  slots?: TournamentMatchSlotView[];
  groupStandings: TournamentGroupStandings | null;
  ourTeamNames: string[];
  teamCount?: number | null;
}): TournamentFinalSummary | null {
  const rawMatches = params.rawMatches ?? [];
  const slots = params.slots ?? [];
  const teamCount = params.teamCount ?? null;

  const tournamentCompleted =
    rawMatches.length > 0
      ? computeTournamentCompleted(rawMatches)
      : computeTournamentCompletedFromSlots(slots);

  const knockoutFromPlan = rawMatches.length > 0 && hasKnockoutStructure(rawMatches);

  let placement: Pick<
    TournamentFinalSummary,
    'finalPlacementLabel' | 'finalPlacementRank' | 'finalPlacementTotal' | 'placementSource'
  > = {
    finalPlacementLabel: null,
    finalPlacementRank: null,
    finalPlacementTotal: null,
    placementSource: 'unknown',
  };

  const ourFinalRaw = findOurFinishedRawMatch(rawMatches, 'final', params.ourTeamNames);
  const ourFinalSlot = findOurFinishedSlot(slots, 'final');
  const finalMatch = buildFinalMatchDisplay({
    rawMatch: ourFinalRaw,
    slot: ourFinalSlot,
    ourTeamNames: params.ourTeamNames,
  });

  if (ourFinalRaw) {
    const outcome = rawMatchOutcomeForUs(ourFinalRaw, params.ourTeamNames);
    if (outcome) placement = placementFromFinal(outcome, teamCount);
  } else if (ourFinalSlot) {
    const outcome = slotOutcomeForUs(ourFinalSlot);
    if (outcome) placement = placementFromFinal(outcome, teamCount);
  }

  if (!placement.finalPlacementLabel) {
    const ourPlacementRaw = findOurFinishedRawMatch(rawMatches, 'placement', params.ourTeamNames);
    if (ourPlacementRaw) {
      const outcome = rawMatchOutcomeForUs(ourPlacementRaw, params.ourTeamNames);
      if (outcome) placement = placementFromThirdPlaceMatch(outcome, teamCount);
    } else {
      const ourPlacementSlot = findOurFinishedSlot(slots, 'placement');
      if (ourPlacementSlot) {
        const outcome = slotOutcomeForUs(ourPlacementSlot);
        if (outcome) placement = placementFromThirdPlaceMatch(outcome, teamCount);
      }
    }
  }

  if (!placement.finalPlacementLabel && !knockoutFromPlan && params.groupStandings) {
    placement = placementFromGroup(params.groupStandings);
  }

  if (!placement.finalPlacementLabel) {
    return {
      tournamentCompleted,
      finalPlacementLabel: null,
      finalPlacementRank: null,
      finalPlacementTotal: null,
      placementSource: 'unknown',
      finalMatch: null,
    };
  }

  return {
    tournamentCompleted,
    ...placement,
    finalMatch: placement.placementSource === 'final' ? finalMatch : null,
  };
}
