import type { ChallengeScoringRow, JugglingAwards } from './challengeTypes';

export type ChallengeScoreInput = {
  playerId: string;
  playerName: string;
  startValue: number;
  endValue: number | null;
};

export function absoluteImprovement(start: number, end: number | null): number | null {
  if (end == null) return null;
  return end - start;
}

export function percentImprovement(start: number, end: number | null): number | null {
  if (end == null || start <= 0) return null;
  return Math.round(((end - start) / start) * 100);
}

export function qualifiesForPercentAward(start: number, minStartForPercent: number): boolean {
  return start >= minStartForPercent;
}

function compareByEndDesc(a: ChallengeScoringRow, b: ChallengeScoringRow): number {
  if (b.endValue !== a.endValue) return b.endValue - a.endValue;
  if (b.startValue !== a.startValue) return b.startValue - a.startValue;
  return a.playerName.localeCompare(b.playerName, 'de');
}

function compareByAbsoluteDesc(a: ChallengeScoringRow, b: ChallengeScoringRow): number {
  if (b.absoluteImprovement !== a.absoluteImprovement) {
    return b.absoluteImprovement - a.absoluteImprovement;
  }
  return compareByEndDesc(a, b);
}

function compareByPercentDesc(a: ChallengeScoringRow, b: ChallengeScoringRow): number {
  const ap = a.percentImprovement ?? -Infinity;
  const bp = b.percentImprovement ?? -Infinity;
  if (bp !== ap) return bp - ap;
  return compareByEndDesc(a, b);
}

function toScoringRows(inputs: ChallengeScoreInput[]): ChallengeScoringRow[] {
  return inputs
    .filter((row) => row.endValue != null)
    .map((row) => {
      const endValue = row.endValue as number;
      return {
        playerId: row.playerId,
        playerName: row.playerName,
        startValue: row.startValue,
        endValue,
        absoluteImprovement: endValue - row.startValue,
        percentImprovement: percentImprovement(row.startValue, endValue),
        rank: 0,
      };
    });
}

function assignRanks(rows: ChallengeScoringRow[], compare: (a: ChallengeScoringRow, b: ChallengeScoringRow) => number): ChallengeScoringRow[] {
  const sorted = [...rows].sort(compare);
  sorted.forEach((row, index) => {
    row.rank = index + 1;
  });
  return sorted;
}

export function buildEndValueRanking(inputs: ChallengeScoreInput[]): ChallengeScoringRow[] {
  return assignRanks(toScoringRows(inputs), compareByEndDesc);
}

export function buildAbsoluteImprovementRanking(inputs: ChallengeScoreInput[]): ChallengeScoringRow[] {
  return assignRanks(toScoringRows(inputs), compareByAbsoluteDesc);
}

export function buildPercentImprovementRanking(
  inputs: ChallengeScoreInput[],
  minStartForPercent: number,
): ChallengeScoringRow[] {
  const eligible = toScoringRows(inputs).filter((row) =>
    qualifiesForPercentAward(row.startValue, minStartForPercent),
  );
  return assignRanks(eligible, compareByPercentDesc);
}

export function deriveJugglingAwards(
  inputs: ChallengeScoreInput[],
  minStartForPercent: number,
): JugglingAwards {
  const endRanking = buildEndValueRanking(inputs);
  const absoluteRanking = buildAbsoluteImprovementRanking(inputs);
  const percentRanking = buildPercentImprovementRanking(inputs, minStartForPercent);

  return {
    king: endRanking[0] ?? null,
    riser: absoluteRanking[0] ?? null,
    development: percentRanking[0] ?? null,
  };
}

export function formatImprovementDelta(delta: number | null): string {
  if (delta == null) return '—';
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function formatImprovementPercent(pct: number | null): string {
  if (pct == null) return '—';
  if (pct > 0) return `+${pct} %`;
  return `${pct} %`;
}
