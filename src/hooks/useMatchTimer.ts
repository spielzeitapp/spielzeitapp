import { useEffect, useMemo, useState, useRef } from 'react';
import type { Match } from '../types/match';

export function useMatchTimer(
  match: Match | null,
  setMatch: React.Dispatch<React.SetStateAction<Match | null>>,
) {
  const [currentSeconds, setCurrentSeconds] = useState<number>(0);
  const prevIsRunningRef = useRef<boolean>(false);

  useEffect(() => {
    if (!match?.timer) {
      setCurrentSeconds(0);
      return;
    }

    const { isRunning, startedAtISO, accumulatedSeconds } = match.timer;

    if (!isRunning || !startedAtISO) {
      setCurrentSeconds(accumulatedSeconds);
      return;
    }

    const startMs = new Date(startedAtISO).getTime();
    const base = accumulatedSeconds;

    const update = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - startMs) / 1000));
      setCurrentSeconds(base + diffSec);
    };

    update();

    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [match?.timer?.isRunning, match?.timer?.startedAtISO, match?.timer?.accumulatedSeconds]);

  useEffect(() => {
    const isRunning = match?.timer?.isRunning ?? false;
    const prev = prevIsRunningRef.current;
    prevIsRunningRef.current = isRunning;

    if (!match?.timer) return;

    if (prev && !isRunning && match.timer.startedAtISO) {
      const startMs = new Date(match.timer.startedAtISO).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - startMs) / 1000));

      setMatch((prevMatch) => {
        if (!prevMatch || !prevMatch.timer || prevMatch.id !== match.id) return prevMatch;
        return {
          ...prevMatch,
          timer: {
            ...prevMatch.timer,
            accumulatedSeconds: prevMatch.timer.accumulatedSeconds + diffSec,
            startedAtISO: null,
          },
        };
      });
    }
  }, [match?.timer?.isRunning, match?.timer?.startedAtISO, match?.timer?.accumulatedSeconds, match?.id, setMatch]);

  const currentMinute = useMemo(() => Math.floor(currentSeconds / 60), [currentSeconds]);

  const formattedTime = useMemo(() => {
    const mm = String(Math.floor(currentSeconds / 60)).padStart(2, '0');
    const ss = String(currentSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }, [currentSeconds]);

  return { currentSeconds, currentMinute, formattedTime };
}

