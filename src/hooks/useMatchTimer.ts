import { useCallback, useEffect, useMemo, useState } from 'react';
import { MATCH_HALF_DURATION_SEC } from '../lib/matchEngine';

export type UseMatchTimerResult = {
  currentMatchSeconds: number;
  isRunning: boolean;
  matchHasEnded: boolean;
  half: 1 | 2;
  hydrateTimer: (snapshot: { seconds?: number | null; isRunning?: boolean | null; hasEnded?: boolean | null }) => void;
  startMatch: () => void;
  pauseMatch: () => void;
  resumeMatch: () => void;
  endMatch: () => void;
  /** Setzt die Uhr mindestens auf Beginn 2. HZ (25:00), z. B. nach Halbzeitpfiff. */
  startSecondHalf: () => void;
};

/**
 * Einfache Spieluhr: tickt nur bei isRunning; nach endMatch kein resume.
 */
export function useMatchTimer(): UseMatchTimerResult {
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

  const hydrateTimer = useCallback(
    (snapshot: { seconds?: number | null; isRunning?: boolean | null; hasEnded?: boolean | null }) => {
      const safeSeconds = Math.max(0, Number(snapshot.seconds ?? 0) || 0);
      const ended = Boolean(snapshot.hasEnded);
      setCurrentMatchSeconds(safeSeconds);
      setMatchHasEnded(ended);
      setIsRunning(!ended && Boolean(snapshot.isRunning));
    },
    [],
  );

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
    hydrateTimer,
    startMatch,
    pauseMatch,
    resumeMatch,
    endMatch,
    startSecondHalf,
  };
}
