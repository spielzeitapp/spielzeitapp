import type { MatchEvent } from '../types/match';

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type EventInput = Omit<MatchEvent, 'id' | 'timestampISO'> & {
  timestampISO?: string;
};

export function createEvent(input: EventInput): MatchEvent {
  const { timestampISO, ...rest } = input;

  return {
    id: createId(),
    timestampISO: timestampISO ?? new Date().toISOString(),
    ...rest,
  };
}

