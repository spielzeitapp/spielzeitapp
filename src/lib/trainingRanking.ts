import type { PlayerItem } from '../hooks/usePlayers';
import type { TrainingAttendanceStats } from './trainingAttendance';
import { EMPTY_TRAINING_STATS } from './trainingStatsLoader';

export type TrainingRankingRow = {
  player: PlayerItem;
  stats: TrainingAttendanceStats;
  rank: number;
};

export function getTrainingTeamBasis(stats: TrainingAttendanceStats): number {
  return stats.present + stats.absent;
}

export function getTrainingActivityBasis(stats: TrainingAttendanceStats): number {
  return stats.present + stats.external + stats.absent;
}

export function hasTrainingTeamBasis(stats: TrainingAttendanceStats): boolean {
  return getTrainingTeamBasis(stats) > 0;
}

export function hasTrainingActivityBasis(stats: TrainingAttendanceStats): boolean {
  return getTrainingActivityBasis(stats) > 0;
}

export function activityRateColorClass(pct: number): string {
  if (pct >= 75) return 'text-emerald-400';
  if (pct >= 50) return 'text-amber-400';
  return 'text-red-400';
}

const PODIUM_MEDALS = ['🥇', '🥈', '🥉'] as const;

export function podiumMedal(rank: number): string | null {
  if (rank >= 1 && rank <= 3) return PODIUM_MEDALS[rank - 1];
  return null;
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

export function buildTrainingRanking(
  players: PlayerItem[],
  statsByPlayerId: Map<string, TrainingAttendanceStats>,
): TrainingRankingRow[] {
  const rows: TrainingRankingRow[] = players.map((player) => ({
    player,
    stats: statsByPlayerId.get(player.id) ?? { ...EMPTY_TRAINING_STATS },
    rank: 0,
  }));

  rows.sort(compareTrainingRankingRows);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return rows;
}
