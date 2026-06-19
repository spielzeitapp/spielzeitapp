import type { TournamentTeamBalance } from './tournamentPlan';
import type { TournamentFinalMatchDisplay, TournamentFinalSummary } from './tournamentFinalSummary';
import type { TournamentGoalScorer } from './tournamentGoalScorers';
import { safeOptionalText, safeText } from './safeText';

export function buildTournamentReportText(params: {
  tournamentTitle: string;
  summary: TournamentFinalSummary;
  balance: TournamentTeamBalance;
  finalMatch: TournamentFinalMatchDisplay | null;
  goalScorers: TournamentGoalScorer[];
}): string {
  const { tournamentTitle, summary, balance, finalMatch, goalScorers } = params;
  const title = safeText(tournamentTitle) || 'Turnier';
  const rank = summary.finalPlacementRank;
  const total = summary.finalPlacementTotal;
  const isWinner = summary.finalPlacementLabel === 'Turniersieger' || rank === 1;

  const lines: string[] = [];

  if (isWinner) {
    lines.push(`🏆 Turniersieg beim ${title}!`, '');
    if (rank != null && total != null) {
      lines.push(`Unsere Mannschaft holt den 1. Platz von ${total} Teams.`);
    } else {
      lines.push('Unsere Mannschaft holt den Turniersieg.');
    }
  } else {
    lines.push(`Starker Auftritt beim ${title}!`, '');
    if (rank != null && total != null) {
      lines.push(`Platz ${rank} von ${total} Teams.`);
    } else if (summary.finalPlacementLabel) {
      lines.push(summary.finalPlacementLabel + '.');
    }
  }

  lines.push('');
  lines.push(
    `${balance.played} ${balance.played === 1 ? 'Spiel' : 'Spiele'} · ${balance.wins} ${balance.wins === 1 ? 'Sieg' : 'Siege'}`,
  );
  lines.push(`${balance.goalsFor}:${balance.goalsAgainst} Tore`);

  if (finalMatch) {
    const opponentMatch = /^\S+\s+\d+:\d+\s+(.+)$/.exec(finalMatch.scoreline);
    const opponent = safeOptionalText(opponentMatch?.[1]);
    const scoreOnly = finalMatch.scoreline.match(/(\d+:\d+)/)?.[1];
    if (opponent && scoreOnly) {
      lines.push(`Finale: ${scoreOnly} gegen ${opponent}`);
    } else {
      lines.push(`${finalMatch.title}: ${finalMatch.scoreline}`);
    }
  }

  if (goalScorers.length > 0) {
    lines.push('');
    lines.push('Torschützen:');
    for (const scorer of goalScorers.slice(0, 5)) {
      lines.push(`• ${scorer.playerName} (${scorer.goals})`);
    }
  }

  lines.push('', '#GEMEINSAMEINTEAM');

  return lines.join('\n');
}
