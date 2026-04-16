import { useCallback, useEffect, useMemo, useState } from 'react';
import { MATCH_HALF_DURATION_SEC } from '../lib/matchEngine';

export type UseMatchTimerResult = {
  currentMatchSeconds: number;
  isRunning: boolean;
  matchHasEnded: boolean;
  half: 1 | 2;
  startMatch: () => void;
  pauseMatch: () => void;
  resumeMatch: () => void;
  endMatch: () => void;
  /** Setzt die Uhr mindestens auf Beginn 2. HZ (25:00), z. B. nach Halbzeitpfiff. */
  startSecondHalf: () => void;
};

type PersistedTimerState = {
  elapsedSeconds?: number | null;
  isRunning?: boolean | null;
  hasEnded?: boolean | null;
  startedAtISO?: string | null;
};

/**
 * Einfache Spieluhr: tickt nur bei isRunning; nach endMatch kein resume.
 */
export function useMatchTimer(persisted?: PersistedTimerState): UseMatchTimerResult {
  const [currentMatchSeconds, setCurrentMatchSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [matchHasEnded, setMatchHasEnded] = useState(false);

  const half = useMemo<1 | 2>(
    () => (currentMatchSeconds < MATCH_HALF_DURATION_SEC ? 1 : 2),
    [currentMatchSeconds],
  );

  useEffect(() => {
    if (!isRunning || matchHasEnded) return;
    const id = window.setInterval(() => {
      setCurrentMatchSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRunning, matchHasEnded]);

  useEffect(() => {
    const baseElapsed = Math.max(0, Number(persisted?.elapsedSeconds ?? 0) || 0);
    const running = Boolean(persisted?.isRunning);
    const ended = Boolean(persisted?.hasEnded);
    let nextElapsed = baseElapsed;
    if (running && persisted?.startedAtISO) {
      const startedAtMs = new Date(persisted.startedAtISO).getTime();
      if (!Number.isNaN(startedAtMs)) {
        nextElapsed += Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
      }
    }
    setCurrentMatchSeconds(nextElapsed);
    setIsRunning(running && !ended);
    setMatchHasEnded(ended);
  }, [persisted?.elapsedSeconds, persisted?.isRunning, persisted?.hasEnded, persisted?.startedAtISO]);

  const startMatch = useCallback(() => {
    if (matchHasEnded) return;
    setIsRunning(true);
  }, [matchHasEnded]);

  const pauseMatch = useCallback(() => {
    setIsRunning(false);
  }, []);

  const resumeMatch = useCallback(() => {
    if (matchHasEnded) return;
    setIsRunning(true);
  }, [matchHasEnded]);

  const endMatch = useCallback(() => {
    setIsRunning(false);
    setMatchHasEnded(true);
  }, []);

  const startSecondHalf = useCallback(() => {
    setCurrentMatchSeconds((s) => Math.max(s, MATCH_HALF_DURATION_SEC));
  }, []);

  return {
    currentMatchSeconds,
    isRunning,
    matchHasEnded,
    half,
    startMatch,
    pauseMatch,
    resumeMatch,
    endMatch,
    startSecondHalf,
  };
}
