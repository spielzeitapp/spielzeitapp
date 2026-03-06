import type { EventId, MatchId, PlayerId, Role } from './types';

export type MatchEventType =
  | 'MATCH_STARTED'
  | 'MATCH_PAUSED'
  | 'PERIOD_STARTED'
  | 'PERIOD_ENDED'
  | 'GOAL'
  | 'SUBSTITUTION'
  | 'CARD'
  | 'NOTE'
  | 'MATCH_ENDED';

export type BaseEvent = {
  id: EventId;
  matchId: MatchId;
  type: MatchEventType;
  atMs: number;
  createdAtEpoch: number;
  createdByRole?: Role;
};

export type MatchStartedEvent = BaseEvent & { type: 'MATCH_STARTED' };

export type MatchPausedEvent = BaseEvent & { type: 'MATCH_PAUSED' };

export type PeriodStartedEvent = BaseEvent & { type: 'PERIOD_STARTED'; period: number };

export type PeriodEndedEvent = BaseEvent & { type: 'PERIOD_ENDED'; period: number };

export type GoalEvent = BaseEvent & {
  type: 'GOAL';
  team: 'home' | 'away';
  scorerId?: PlayerId;
  assistId?: PlayerId;
  comment?: string;
};

export type SubstitutionEvent = BaseEvent & {
  type: 'SUBSTITUTION';
  playerOutId: PlayerId;
  playerInId: PlayerId;
  reason?: string;
};

export type CardEvent = BaseEvent & {
  type: 'CARD';
  playerId: PlayerId;
  card: 'yellow' | 'red';
  reason?: string;
};

export type NoteEvent = BaseEvent & { type: 'NOTE'; text: string };

export type MatchEndedEvent = BaseEvent & { type: 'MATCH_ENDED' };

export type MatchEvent =
  | MatchStartedEvent
  | MatchPausedEvent
  | PeriodStartedEvent
  | PeriodEndedEvent
  | GoalEvent
  | SubstitutionEvent
  | CardEvent
  | NoteEvent
  | MatchEndedEvent;

export type MatchEventLog = MatchEvent[];

// --- Helper functions ---

export function createEventId(): EventId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function nowEpochMs(): number {
  return Date.now();
}

export function formatAtMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
