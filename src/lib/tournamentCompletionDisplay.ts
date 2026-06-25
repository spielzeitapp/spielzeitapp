import type { TournamentCompletionState } from './tournamentCompletion';
import { formatTournamentFinalPlacementHeadline, type TournamentFinalSummary } from './tournamentFinalSummary';

export function placementLabelFromRank(rank: number): string {
  if (rank === 1) return 'Turniersieger';
  if (rank === 2) return '2. Platz';
  if (rank === 3) return '3. Platz';
  if (rank === 4) return '4. Platz';
  return `${rank}. Platz`;
}

export function formatCompletionPlacementLine(completion: TournamentCompletionState): string {
  if (completion.finalLabel?.trim()) {
    const fromLabel = formatTournamentFinalPlacementHeadline({
      tournamentCompleted: true,
      finalPlacementLabel: completion.finalLabel.trim(),
      finalPlacementRank: completion.finalPlacement,
      finalPlacementTotal: completion.finalTeamsCount,
      placementSource: 'unknown',
      finalMatch: null,
    });
    if (fromLabel) return fromLabel;
    return completion.finalLabel.trim();
  }

  const rank = completion.finalPlacement;
  const total = completion.finalTeamsCount;
  if (rank != null && total != null && rank > 0 && total > 0) {
    if (rank === 1) return `🥇 1. Platz von ${total} Teams`;
    if (rank === 2) return `🥈 2. Platz von ${total} Teams`;
    if (rank === 3) return `🥉 3. Platz von ${total} Teams`;
    return `${rank}. Platz von ${total} Teams`;
  }

  return 'Turnier beendet';
}

export function buildTournamentCompletionDefaults(params: {
  summary: TournamentFinalSummary | null;
  participantCount: number;
  planTeamCount: number | null;
}): {
  placementRank: number | null;
  teamsCount: number | null;
  label: string | null;
} {
  const rank = params.summary?.finalPlacementRank ?? null;
  const teamsCount =
    params.summary?.finalPlacementTotal ??
    params.planTeamCount ??
    (params.participantCount > 0 ? params.participantCount : null);
  const label = params.summary?.finalPlacementLabel ?? (rank != null ? placementLabelFromRank(rank) : null);

  return {
    placementRank: rank,
    teamsCount,
    label,
  };
}
