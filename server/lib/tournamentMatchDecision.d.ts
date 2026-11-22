export type TournamentMatchDecision = {
  extraTime: { startSecond: number; minutes: number } | null;
  shootout: { home: number; away: number } | null;
};

export function readTournamentMatchDecision(periodScores: unknown): TournamentMatchDecision;
