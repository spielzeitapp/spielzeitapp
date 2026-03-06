import type { Role } from '../auth/rbac';

export type { Role };

export type TeamId = string;
export type MatchId = string;
export type PlayerId = string;
export type EventId = string;

export type Player = {
  id: PlayerId;
  firstName: string;
  lastName: string;
  number?: number;
  isGoalie?: boolean;
  notes?: string;
};

export type Match = {
  id: MatchId;
  teamId: TeamId;
  opponent: string;
  venue?: string;
  kickoffAt: string; // ISO string
  homeAway: 'home' | 'away';
  status: 'upcoming' | 'live' | 'finished';
  opponentStrength?: 'strong' | 'medium' | 'weak'; // TODO für 3-Minuten-Regel
};

export type MatchConfig = {
  periods: number; // z.B. 2 oder 3
  periodMinutes: number; // z.B. 25
  breakMinutes?: number;
  maxOnField: number; // z.B. 7 (U11)
};

export type MatchRoster = {
  matchId: MatchId;
  players: Player[];
};

export type Lineup = {
  matchId: MatchId;
  starting: PlayerId[]; // Länge <= maxOnField
  bench: PlayerId[];
  captainId?: PlayerId;
};

export type LiveClock = {
  isRunning: boolean;
  startedAt?: number; // epoch ms, wenn running
  elapsedMs: number; // aufsummiert
};

export type LiveState = {
  matchId: MatchId;
  config: MatchConfig;
  period: number; // 1..periods
  clock: LiveClock;
  scoreHome: number;
  scoreAway: number;
  onField: PlayerId[];
  bench: PlayerId[];
  notes?: string;
};

export type EngineSeed = {
  matchId: MatchId;
  config: MatchConfig;
  roster: MatchRoster;
  lineup: Lineup;
};


