export type ShootoutAttempt = {
  side: 'home' | 'away';
  outcome: 'goal' | 'miss';
};

export type Shootout = {
  home: number;
  away: number;
  attempts: ShootoutAttempt[];
};

export type TournamentMatchDecision = {
  extraTime: { startSecond: number; minutes: number } | null;
  shootout: Shootout | null;
};

export function readTournamentMatchDecision(periodScores: unknown): TournamentMatchDecision;
export function recordShootoutAttempt(shootout: Shootout, attempt: ShootoutAttempt): Shootout;
export function undoShootoutAttempt(shootout: Shootout): Shootout;
