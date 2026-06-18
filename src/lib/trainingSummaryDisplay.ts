import type { PlayerItem } from '../hooks/usePlayers';
import type { TrainingRankingRow, TrainingRankingResult } from './trainingRanking';
import { hasTrainingActivityBasis } from './trainingRanking';
import { computeSquadParticipationPct } from './teamTrainingParticipationStats';

/** Ø Beteiligung Trainingszentrale: nur Durchschnitt der Einheiten-Quoten (Client). */
export function resolveTeamParticipationPct(ranking: TrainingRankingResult): number | null {
  return computeSquadParticipationPct(ranking.sessionParticipations);
}

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

export function formatParticipationLabel(pct: number | null): string {
  if (pct == null) return 'Noch keine Daten';
  return `${pct} %`;
}

/** Unterzeile Ø Beteiligung (Trainingszentrale). */
export const PARTICIPATION_EXPLICIT_BASIS_SUB = 'Dabei / (Dabei + Abwesend)';

export function resolveKaiserLeader(ranking: TrainingRankingResult): TrainingRankingRow | null {
  return ranking.qualified[0] ?? null;
}

export function kaiserActivitySub(row: TrainingRankingRow | null): string | undefined {
  if (!row || !hasTrainingActivityBasis(row.stats)) return undefined;
  return `${row.stats.activityRatePct} % Aktivität`;
}
