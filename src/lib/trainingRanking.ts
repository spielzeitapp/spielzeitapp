import type { PlayerItem } from '../hooks/usePlayers';
import type { TrainingAttendanceStats } from './trainingAttendance';
import type { TrainingSessionParticipation } from './teamTrainingParticipationStats';
import { EMPTY_TRAINING_STATS } from './trainingStatsLoader';

export type TrainingRankingRow = {
  player: PlayerItem;
  stats: TrainingAttendanceStats;
  rank: number;
};

export type TrainingRankingResult = {
  qualified: TrainingRankingRow[];
  unqualified: TrainingRankingRow[];
  sessionsCount: number;
  minimumBasis: number;
  teamAverageActivityPct: number | null;
  /** Aggregierter Mannschaftswert (RPC oder Client-Fallback). */
  teamParticipationPct: number | null;
  /** Beteiligung je vergangenem Training (Mannschaftsebene). */
  sessionParticipations: TrainingSessionParticipation[];
};

/** Wertbare Trainings = Dabei + LAZ + Abwesend (für Ranking-Mindestbasis). */
export function getValuableTrainingCount(stats: TrainingAttendanceStats): number {
  return stats.present + stats.external + stats.absent;
}

export function getTrainingTeamBasis(stats: TrainingAttendanceStats): number {
  return stats.present + stats.absent;
}

export function getTrainingActivityBasis(stats: TrainingAttendanceStats): number {
  return getValuableTrainingCount(stats);
}

export function hasTrainingTeamBasis(stats: TrainingAttendanceStats): boolean {
  return getTrainingTeamBasis(stats) > 0;
}

export function hasTrainingActivityBasis(stats: TrainingAttendanceStats): boolean {
  return getTrainingActivityBasis(stats) > 0;
}

/** Mindestanzahl wertbarer Trainings für offizielles Ranking (30 %, aufgerundet). */
export function getMinimumRankingBasis(availableTrainings: number): number {
  if (availableTrainings <= 0) return 0;
  return Math.ceil(availableTrainings * 0.3);
}

export function qualifiesForTrainingRanking(
  stats: TrainingAttendanceStats,
  sessionsCount: number,
): boolean {
  if (sessionsCount <= 0) return false;
  return getValuableTrainingCount(stats) >= getMinimumRankingBasis(sessionsCount);
}

export function activityRateColorClass(pct: number): string {
  if (pct >= 75) return 'text-emerald-400';
  if (pct >= 50) return 'text-amber-400';
  return 'text-red-400';
}

/** Ampel nach Spielerquote (teamRatePct) — nur Visualisierung. */
export function teamRateTrafficLightEmoji(pct: number): string {
  if (pct >= 75) return '🟢';
  if (pct >= 50) return '🟡';
  return '🔴';
}

export function teamRateTrafficLightClass(pct: number): string {
  if (pct >= 75) return 'text-emerald-400';
  if (pct >= 50) return 'text-amber-400';
  return 'text-red-400';
}

const PODIUM_MEDALS = ['🥇', '🥈', '🥉'] as const;

export function podiumMedal(rank: number): string | null {
  if (rank >= 1 && rank <= 3) return PODIUM_MEDALS[rank - 1];
  return null;
}

/** Durchschnittliche Team-Trainingsbeteiligung (teamRatePct) der gewerteten Spieler. */
export function averageQualifiedTeamRatePct(rows: TrainingRankingRow[]): number | null {
  if (rows.length === 0) return null;
  return Math.round(rows.reduce((sum, row) => sum + row.stats.teamRatePct, 0) / rows.length);
}

/** Neutrale Mannschaftsbeteiligung über alle Spieler mit Trainingsbasis (ohne Ranking). */
export function averageSquadTeamRatePct(
  qualified: TrainingRankingRow[],
  unqualified: TrainingRankingRow[],
): number | null {
  const withBasis = [...qualified, ...unqualified].filter((row) => hasTrainingTeamBasis(row.stats));
  if (withBasis.length === 0) return null;
  return Math.round(withBasis.reduce((sum, row) => sum + row.stats.teamRatePct, 0) / withBasis.length);
}

export const SQUAD_PARTICIPATION_LABEL = 'Ø Beteiligung';

export function formatSquadParticipationLabel(pct: number): string {
  return `${SQUAD_PARTICIPATION_LABEL}: ${pct} %`;
}

/** Durchschnittliche Trainingsaktivität (activityRatePct) der gewerteten Spieler. */
export function averageQualifiedActivityRatePct(rows: TrainingRankingRow[]): number | null {
  if (rows.length === 0) return null;
  return Math.round(rows.reduce((sum, row) => sum + row.stats.activityRatePct, 0) / rows.length);
}

/** Klartext für Durchschnitt nur gewerteter Spieler (≥ 30 % Trainingsbasis). */
export const QUALIFIED_AVERAGE_LABEL = 'Ø Spielerquote';

/** Neutraler Trainer-Benchmark im Spielerprofil (Trainingskaiser-Basis). */
export const KAISER_AVERAGE_LABEL = 'Ø Trainingskaiser-Wertung';

export function formatQualifiedAverageLabel(pct: number): string {
  return `${QUALIFIED_AVERAGE_LABEL}: ${pct} %`;
}

export function formatKaiserAverageLabel(pct: number): string {
  return `${KAISER_AVERAGE_LABEL}: ${pct} %`;
}

/** Neutrale Vergleichszeile Spielerwert vs. Durchschnitt gewerteter Spieler. */
export function formatTrainingComparisonToAverage(
  playerPct: number,
  averagePct: number | null,
): string | null {
  if (averagePct == null) return null;
  const diff = Math.round(playerPct - averagePct);
  if (diff === 0) return 'im Mannschaftsschnitt';
  if (diff > 0) return `+${diff} Punkte über ${QUALIFIED_AVERAGE_LABEL}`;
  return `${diff} Punkte unter ${QUALIFIED_AVERAGE_LABEL}`;
}

function compareTrainingRankingRows(a: TrainingRankingRow, b: TrainingRankingRow): number {
  const activityDiff = b.stats.activityRatePct - a.stats.activityRatePct;
  if (activityDiff !== 0) return activityDiff;

  const teamDiff = b.stats.teamRatePct - a.stats.teamRatePct;
  if (teamDiff !== 0) return teamDiff;

  const presentDiff = b.stats.present - a.stats.present;
  if (presentDiff !== 0) return presentDiff;

  const absentDiff = a.stats.absent - b.stats.absent;
  if (absentDiff !== 0) return absentDiff;

  return a.player.display_name.localeCompare(b.player.display_name, 'de');
}

function compareByName(a: TrainingRankingRow, b: TrainingRankingRow): number {
  return a.player.display_name.localeCompare(b.player.display_name, 'de');
}

function mapPlayersToRows(
  players: PlayerItem[],
  statsByPlayerId: Map<string, TrainingAttendanceStats>,
): TrainingRankingRow[] {
  return players.map((player) => ({
    player,
    stats: statsByPlayerId.get(player.id) ?? { ...EMPTY_TRAINING_STATS },
    rank: 0,
  }));
}

export function buildTrainingRanking(
  players: PlayerItem[],
  statsByPlayerId: Map<string, TrainingAttendanceStats>,
  sessionsCount = 0,
): TrainingRankingResult {
  const rows = mapPlayersToRows(players, statsByPlayerId);
  const minimumBasis = getMinimumRankingBasis(sessionsCount);

  const qualified = rows.filter((row) => qualifiesForTrainingRanking(row.stats, sessionsCount));
  const unqualified = rows.filter((row) => !qualifiesForTrainingRanking(row.stats, sessionsCount));

  qualified.sort(compareTrainingRankingRows);
  qualified.forEach((row, index) => {
    row.rank = index + 1;
  });

  unqualified.sort(compareByName);

  const teamAverageActivityPct = averageQualifiedActivityRatePct(qualified);

  return {
    qualified,
    unqualified,
    sessionsCount,
    minimumBasis,
    teamAverageActivityPct,
    teamParticipationPct: null,
    sessionParticipations: [],
  };
}
