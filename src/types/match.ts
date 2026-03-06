export type MatchId = string;

export interface Player {
  id: string;
  name?: string;
  /** Anzeigename (z. B. aus first_name + last_name). Bevorzugt gegenüber name. */
  display_name?: string;
  number?: number;
  position?: string;
}

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  players: Player[];
}

export type MatchStatus = 'planned' | 'live' | 'finished';

export type FieldSlotId = 'GK' | 'LB' | 'RB' | 'CM' | 'LW' | 'RW' | 'ST';

export interface FieldSlot {
  id: FieldSlotId;
  label: string;
}

export type MatchEventType =
  | 'kickoff'
  | 'period_start'
  | 'period_end'
  | 'goal'
  | 'sub'
  | 'card'
  | 'note'
  | 'final_whistle';

export type CardType = 'yellow' | 'red' | 'blue' | 'none';

export interface MatchEvent {
  id: string;
  type: MatchEventType;
  timestampISO: string;
  minute?: number;
  teamId?: string;
  playerId?: string;
  playerInId?: string;
  playerOutId?: string;
  cardType?: CardType;
  period?: 1 | 2 | 3;
  note?: string;
}

export interface Match {
  id: MatchId;
  home: Team;
  away: Team;
  kickoffISO: string;
  status: MatchStatus;
  score: {
    home: number;
    away: number;
  };
  events: MatchEvent[];
  currentMinute?: number;
  period?: 1 | 2 | 3;
  isRunning?: boolean;
  startedAtISO?: string | null;
  lineup: {
    homeStarting: string[];
    homeBench: string[];
    awayStarting: string[];
    awayBench: string[];
  };
  field: {
    home: Partial<Record<FieldSlotId, string>>;
    away: Partial<Record<FieldSlotId, string>>;
  };
  timer: {
    isRunning: boolean;
    startedAtISO: string | null;
    accumulatedSeconds: number;
  };
}

