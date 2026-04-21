import { useCallback, useEffect, useMemo, useState } from 'react';
import { MATCH_HALF_DURATION_SEC } from '../lib/matchEngine';

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

type PersistedTimerState = {
  elapsedSeconds?: number | null;
  isRunning?: boolean | null;
  hasEnded?: boolean | null;
  startedAtISO?: string | null;
};

/**
 * Effektive Spielzeit aus DB: live_elapsed_seconds (Basis) + (now − live_started_at) bei laufender Uhr.
 * Kein +1/s-Intervall — nur ein 1s-Tick für Re-Renders; keine doppelte Zeitführung.
 */
function wallMatchSeconds(persisted: PersistedTimerState | undefined): number {
  const base = Math.max(0, Number(persisted?.elapsedSeconds ?? 0) || 0);
  if (!persisted || Boolean(persisted.hasEnded)) return base;
  if (!persisted.isRunning || !persisted.startedAtISO) return base;
  const startedAtMs = new Date(persisted.startedAtISO).getTime();
  if (Number.isNaN(startedAtMs)) return base;
  return base + Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
}

export function useMatchTimer(persisted?: PersistedTimerState): UseMatchTimerResult {
  const [tick, setTick] = useState(0);

  const ended = Boolean(persisted?.hasEnded);
  const running = Boolean(persisted?.isRunning) && !ended;

  useEffect(() => {
    setTick(0);
  }, [persisted?.elapsedSeconds, persisted?.hasEnded, persisted?.isRunning, persisted?.startedAtISO]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const currentMatchSeconds = useMemo(
    () => wallMatchSeconds(persisted),
    [persisted?.elapsedSeconds, persisted?.hasEnded, persisted?.isRunning, persisted?.startedAtISO, tick],
  );

  const half = useMemo<1 | 2>(
    () => (currentMatchSeconds < MATCH_HALF_DURATION_SEC ? 1 : 2),
    [currentMatchSeconds],
  );

  const noop = useCallback(() => {}, []);

  /** Ohne lokale Akkumulation: Halbzeit über Match-Events / DB steuern. */
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
