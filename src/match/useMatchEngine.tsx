import React from 'react';
import { useSession } from '../auth/useSession';
import { matches as mockMatches } from '../data/mock';
import type { MatchId, MatchRoster, Lineup, MatchConfig, LiveState } from './types';
import { initialEngineState, recomputeFromLog, getElapsedMs } from './reducer';
import type { MatchEvent, MatchEventLog } from './events';
import type { MatchEngineSeed } from './storage';
import { clearMatchEngine, loadMatchEngine, saveMatchEngine } from './storage';

type NewEventInput =
  | { type: 'MATCH_STARTED' }
  | { type: 'MATCH_PAUSED' }
  | { type: 'PERIOD_STARTED'; period: number }
  | { type: 'PERIOD_ENDED' }
  | { type: 'GOAL'; team: 'home' | 'away'; scorerId?: string; assistId?: string; comment?: string }
  | { type: 'SUBSTITUTION'; playerOutId: string; playerInId: string; reason?: string }
  | { type: 'CARD'; playerId: string; card: 'yellow' | 'red'; reason?: string }
  | { type: 'NOTE'; text: string }
  | { type: 'MATCH_ENDED' };

function createDefaultSeed(matchId: MatchId): MatchEngineSeed {
  const mockMatch = mockMatches.find((m) => m.id === matchId) ?? mockMatches[0];

  const config: MatchConfig = {
    periods: 2,
    periodMinutes: 25,
    maxOnField: 7,
    // TODO: Auto-Sub Decision basierend auf opponentStrength in zukünftiger 3-Minuten-Regel einbauen.
    opponentStrength: 'medium',
  };

  const dummyPlayers: MatchRoster['players'] = Array.from({ length: 10 }).map((_, index) => ({
    id: `p${index + 1}`,
    firstName: `Spieler`,
    lastName: `${index + 1}`,
    number: index + 1,
    isGoalie: index === 0,
  }));

  const roster: MatchRoster = {
    matchId,
    players: dummyPlayers,
  };

  const startingIds = dummyPlayers.slice(0, config.maxOnField).map((p) => p.id);
  const benchIds = dummyPlayers.slice(config.maxOnField).map((p) => p.id);

  const lineup: Lineup = {
    matchId,
    starting: startingIds,
    bench: benchIds,
    captainId: startingIds[0],
  };

  const seed: MatchEngineSeed = {
    matchId: mockMatch.id,
    config,
    roster,
    lineup,
  };

  return seed;
}

function buildEvent(meta: {
  matchId: MatchId;
  role: string | undefined;
  clock: LiveState['clock'];
  input: NewEventInput;
}): MatchEvent {
  const { matchId, role, clock, input } = meta;
  const now = Date.now();
  const atMs = getElapsedMs(clock);
  const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    matchId,
    atMs,
    createdAtEpoch: now,
    createdByRole: role,
    ...input,
  } as MatchEvent;
}

export function useMatchEngine(matchId: MatchId) {
  const { role } = useSession();
  const [seed, setSeed] = React.useState<MatchEngineSeed | null>(null);
  const [state, setState] = React.useState<LiveState | null>(null);
  const [log, setLog] = React.useState<MatchEventLog>([]);

  React.useEffect(() => {
    if (!matchId) return;
    const loaded = loadMatchEngine(matchId);
    let usedSeed: MatchEngineSeed;
    let usedLog: MatchEventLog;

    if (loaded) {
      usedSeed = loaded.seed;
      usedLog = loaded.log ?? [];
    } else {
      usedSeed = createDefaultSeed(matchId);
      usedLog = [];
      saveMatchEngine(matchId, usedSeed, usedLog);
    }

    const initialState = initialEngineState(usedSeed.matchId, usedSeed.config, usedSeed.lineup);
    const recomputed = recomputeFromLog(initialState, usedLog);

    setSeed(usedSeed);
    setLog(usedLog);
    setState(recomputed);
  }, [matchId]);

  React.useEffect(() => {
    if (!state?.clock.isRunning) return;
    const id = window.setInterval(() => {
      // Nur UI-Update, State/Uhr bleibt über startedAt + elapsedMs korrekt.
      setState((prev) => (prev ? { ...prev } : prev));
    }, 250);
    return () => window.clearInterval(id);
  }, [state?.clock.isRunning]);

  const dispatchEvent = React.useCallback(
    (input: NewEventInput) => {
      if (!state || !seed) return;
      const event = buildEvent({
        matchId: seed.matchId,
        role,
        clock: state.clock,
        input,
      });
      const nextLog = [...log, event];
      const initialState = initialEngineState(seed.matchId, seed.config, seed.lineup);
      const nextState = recomputeFromLog(initialState, nextLog);
      setLog(nextLog);
      setState(nextState);
      saveMatchEngine(seed.matchId, seed, nextLog);
    },
    [log, role, seed, state],
  );

  const reset = React.useCallback(() => {
    if (!matchId) return;
    clearMatchEngine(matchId);
    const newSeed = createDefaultSeed(matchId);
    const initialState = initialEngineState(newSeed.matchId, newSeed.config, newSeed.lineup);
    setSeed(newSeed);
    setLog([]);
    setState(initialState);
    saveMatchEngine(newSeed.matchId, newSeed, []);
  }, [matchId]);

  return {
    state,
    log,
    dispatchEvent,
    reset,
  };
}

