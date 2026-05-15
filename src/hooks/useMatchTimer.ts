import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MATCH_HALF_DURATION_SEC,
  reconcileLiveMatchSecondsWithClockEvents,
  type LiveMatchClockPersisted,
  type MatchEngineEvent,
} from '../lib/matchEngine';

export type UseMatchTimerResult = {
  currentMatchSeconds: number;
  isRunning: boolean;
  matchHasEnded: boolean;
  half: 1 | 2;
  /** @deprecated UI steuert live_is_running über DB; No-Op für API-Kompatibilität. */
  startMatch: () => void;
  pauseMatch: () => void;
  resumeMatch: () => void;
  endMatch: () => void;
  /** Setzt die Uhr mindestens auf Beginn 2. HZ (25:00), z. B. nach Halbzeitpfiff. */
  startSecondHalf: () => void;
};

export type PersistedTimerState = LiveMatchClockPersisted & {
  /** start/pause/resume/end — Anker bei Reload, wenn DB und Events auseinanderlaufen. */
  clockEvents?: MatchEngineEvent[];
};

function toClockState(p: PersistedTimerState | undefined): LiveMatchClockPersisted {
  if (!p) return {};
  return {
    elapsedSeconds: p.elapsedSeconds,
    isRunning: p.isRunning,
    hasEnded: p.hasEnded,
    startedAtISO: p.isRunning ? p.startedAtISO ?? null : null,
  };
}

/**
 * Live-Uhr: Wahrheit = DB-Akkumulator + Wall-Clock des Laufsegments (+ optional Events).
 * `setInterval` triggert nur Display-Updates (~1 Hz), keine Sekundenzählung.
 */
export function useMatchTimer(persisted?: PersistedTimerState): UseMatchTimerResult {
  const [displayTick, setDisplayTick] = useState(0);

  const ended = Boolean(persisted?.hasEnded);
  const running = Boolean(persisted?.isRunning) && !ended;

  useEffect(() => {
    const bump = () => setDisplayTick((n) => n + 1);
    const id = window.setInterval(bump, 1000);
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') bump();
    };
    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', bump);
    window.addEventListener('pageshow', bump);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', bump);
      window.removeEventListener('pageshow', bump);
    };
  }, []);

  const currentMatchSeconds = useMemo(() => {
    void displayTick;
    return reconcileLiveMatchSecondsWithClockEvents(toClockState(persisted), persisted?.clockEvents);
  }, [
    displayTick,
    persisted?.elapsedSeconds,
    persisted?.isRunning,
    persisted?.hasEnded,
    persisted?.startedAtISO,
    persisted?.clockEvents,
  ]);

  const half = useMemo<1 | 2>(
    () => (currentMatchSeconds < MATCH_HALF_DURATION_SEC ? 1 : 2),
    [currentMatchSeconds],
  );

  const noop = useCallback(() => {}, []);
  const startSecondHalf = useCallback(() => {}, []);

  return {
    currentMatchSeconds,
    isRunning: running,
    matchHasEnded: ended,
    half,
    startMatch: noop,
    pauseMatch: noop,
    resumeMatch: noop,
    endMatch: noop,
    startSecondHalf,
  };
}
