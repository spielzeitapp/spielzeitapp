import type { PlayerItem } from '../hooks/usePlayers';
import type { TrainingRankingRow } from './trainingRanking';
import {
  averageQualifiedTeamRatePct,
  hasTrainingActivityBasis,
  type TrainingRankingResult,
} from './trainingRanking';

/** Gleiche Namensdarstellung wie TeamTrainingDashboard (Vorname + Nachname Zeile). */
export function kaiserTileName(player: PlayerItem): { primary: string; secondary?: string } {
  const first = (player.first_name ?? '').trim();
  const last = (player.last_name ?? '').trim();
  if (first) {
    return last ? { primary: first, secondary: last } : { primary: first };
  }
  const parts = player.display_name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { primary: parts[0], secondary: parts.slice(1).join(' ') };
  }
  return { primary: parts[0] ?? '—' };
}

/** Wie TeamTrainingDashboard: Ø gewerteter Spieler (teamRatePct), Fallback teamAverageActivityPct. */
export function resolveTeamParticipationPct(ranking: TrainingRankingResult): number | null {
  const fromQualified = averageQualifiedTeamRatePct(ranking.qualified);
  if (fromQualified != null) return fromQualified;
  return ranking.teamAverageActivityPct;
}

export function formatParticipationLabel(pct: number | null): string {
  if (pct == null) return 'Noch keine Daten';
  return `${pct} %`;
}

export function resolveKaiserLeader(ranking: TrainingRankingResult): TrainingRankingRow | null {
  return ranking.qualified[0] ?? null;
}

export function kaiserActivitySub(row: TrainingRankingRow | null): string | undefined {
  if (!row || !hasTrainingActivityBasis(row.stats)) return undefined;
  return `${row.stats.activityRatePct} % Aktivität`;
}
