import type { Lineup, LiveState, MatchConfig, MatchId } from './types';
import type { MatchEvent } from './events';

type Clock = { isRunning: boolean; startedAt?: number; elapsedMs: number };

export function getElapsedMs(clock: Clock): number {
  if (clock.isRunning && clock.startedAt != null) {
    return clock.elapsedMs + (Date.now() - clock.startedAt);
  }
  return clock.elapsedMs;
}

export function startClock(clock: Clock): Clock {
  if (clock.isRunning) return clock;
  return { ...clock, isRunning: true, startedAt: Date.now() };
}

export function stopClock(clock: Clock): Clock {
  if (!clock.isRunning) return clock;
  return {
    isRunning: false,
    startedAt: undefined,
    elapsedMs: getElapsedMs(clock),
  };
}

export function initialEngineState(matchId: MatchId, config: MatchConfig, lineup: Lineup): LiveState {
  const maxOnField = config.maxOnField;
  const onField = lineup.starting.slice(0, maxOnField);
  const excessStarting = lineup.starting.slice(maxOnField);
  const bench = [...lineup.bench, ...excessStarting];

  return {
    matchId,
    config,
    period: 1,
    clock: { isRunning: false, elapsedMs: 0 },
    scoreHome: 0,
    scoreAway: 0,
    onField,
    bench,
    notes: undefined,
  };
}

export function applyEvent(state: LiveState, event: MatchEvent): LiveState {
  switch (event.type) {
    case 'MATCH_STARTED':
      return { ...state, clock: startClock(state.clock) };

    case 'MATCH_PAUSED':
      return { ...state, clock: stopClock(state.clock) };

    case 'PERIOD_STARTED': {
      const period = Math.min(Math.max(1, event.period), state.config.periods);
      return {
        ...state,
        period,
        clock: startClock(state.clock),
      };
    }

    case 'PERIOD_ENDED':
      return { ...state, clock: stopClock(state.clock) };

    case 'GOAL':
      return {
        ...state,
        scoreHome: event.team === 'home' ? state.scoreHome + 1 : state.scoreHome,
        scoreAway: event.team === 'away' ? state.scoreAway + 1 : state.scoreAway,
      };

    case 'SUBSTITUTION': {
      const { playerOutId, playerInId } = event;
      if (!state.onField.includes(playerOutId) || !state.bench.includes(playerInId)) {
        return state;
      }
      return {
        ...state,
        onField: state.onField.map((id) => (id === playerOutId ? playerInId : id)),
        bench: state.bench.map((id) => (id === playerInId ? playerOutId : id)),
      };
    }

    case 'CARD':
      return state;

    case 'NOTE':
      return { ...state, notes: event.text };

    case 'MATCH_ENDED':
      return { ...state, clock: stopClock(state.clock) };

    default:
      return state;
  }
}

export function recomputeFromLog(seedState: LiveState, log: MatchEvent[]): LiveState {
  const sorted = [...log].sort((a, b) => a.createdAtEpoch - b.createdAtEpoch);
  return sorted.reduce((current, event) => applyEvent(current, event), seedState);
}
