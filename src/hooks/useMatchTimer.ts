import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MATCH_HALF_DURATION_SEC, U11_MATCH_CLOCK_MAX_SECONDS } from '../lib/matchEngine';

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

function timerSegmentKey(p: PersistedTimerState | undefined): string {
  if (!p) return '';
  return `${Number(p.elapsedSeconds ?? 0) || 0}|${p.isRunning ? 1 : 0}|${p.hasEnded ? 1 : 0}|${String(p.startedAtISO ?? '')}`;
}

export function useMatchTimer(persisted?: PersistedTimerState): UseMatchTimerResult {
  const [runningSegmentTick, setRunningSegmentTick] = useState(0);
  const segmentKeyRef = useRef<string | null>(null);
  const baseRef = useRef(0);

  const ended = Boolean(persisted?.hasEnded);
  const running = Boolean(persisted?.isRunning) && !ended;

  baseRef.current = Math.max(0, Number(persisted?.elapsedSeconds ?? 0) || 0);

  /** Neues Segment (Pause/Weiter/Start): Zähler zurück; bei laufender Uhr einmaliger Abgleich mit Server-Uhr (nur Tab-Reload), kein Dauer-Wall-Clock-Tick. */
  useEffect(() => {
    const sid = timerSegmentKey(persisted);
    if (segmentKeyRef.current === sid) return;
    segmentKeyRef.current = sid;
    let initial = 0;
    if (running && persisted?.startedAtISO && !ended) {
      const startedAtMs = new Date(persisted.startedAtISO).getTime();
      if (!Number.isNaN(startedAtMs)) {
        const wallSeg = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
        const capLeft = Math.max(0, U11_MATCH_CLOCK_MAX_SECONDS - baseRef.current);
        initial = Math.min(wallSeg, capLeft);
      }
    }
    setRunningSegmentTick(initial);
  }, [persisted?.elapsedSeconds, persisted?.hasEnded, persisted?.isRunning, persisted?.startedAtISO, running, ended]);

  useEffect(() => {
    if (!running) return;
    const tickOnce = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      setRunningSegmentTick((n) => {
        const capLeft = Math.max(0, U11_MATCH_CLOCK_MAX_SECONDS - baseRef.current);
        return Math.min(n + 1, capLeft);
      });
    };
    const id = window.setInterval(tickOnce, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const currentMatchSeconds = useMemo(() => {
    const base = Math.max(0, Number(persisted?.elapsedSeconds ?? 0) || 0);
    if (!persisted || ended) return Math.min(base, U11_MATCH_CLOCK_MAX_SECONDS);
    if (!running || !persisted.startedAtISO) return Math.min(base, U11_MATCH_CLOCK_MAX_SECONDS);
    return Math.min(base + runningSegmentTick, U11_MATCH_CLOCK_MAX_SECONDS);
  }, [
    persisted?.elapsedSeconds,
    persisted?.hasEnded,
    persisted?.isRunning,
    persisted?.startedAtISO,
    ended,
    running,
    runningSegmentTick,
  ]);

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
