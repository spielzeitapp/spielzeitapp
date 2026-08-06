import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEMO_STORAGE_KEYS,
  createInitialLiveState,
  demoFixtures,
} from './demoFixtures';
import type { DemoFixtures, DemoLiveEvent, DemoLiveState } from './demoTypes';

type DemoContextValue = {
  fixtures: DemoFixtures;
  live: DemoLiveState;
  welcomeOpen: boolean;
  tourStep: number | null;
  dismissWelcome: (startTour?: boolean) => void;
  skipTour: () => void;
  nextTourStep: () => void;
  bumpMinute: () => void;
  addGoalHome: () => void;
  addGoalAway: () => void;
  addSubOrInfo: () => void;
  finishMatch: () => void;
  resetLive: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    if (value) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function nextEventId(events: DemoLiveEvent[]): string {
  return `le-local-${events.length + 1}-${Date.now()}`;
}

export function DemoProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [live, setLive] = useState<DemoLiveState>(() => createInitialLiveState());
  const [welcomeOpen, setWelcomeOpen] = useState(() => !readFlag(DEMO_STORAGE_KEYS.welcomeDismissed));
  const [tourStep, setTourStep] = useState<number | null>(null);

  const dismissWelcome = useCallback((startTour = false) => {
    writeFlag(DEMO_STORAGE_KEYS.welcomeDismissed, true);
    setWelcomeOpen(false);
    if (startTour && !readFlag(DEMO_STORAGE_KEYS.tourDone)) {
      setTourStep(0);
    }
  }, []);

  const skipTour = useCallback(() => {
    writeFlag(DEMO_STORAGE_KEYS.tourDone, true);
    setTourStep(null);
  }, []);

  const nextTourStep = useCallback(() => {
    setTourStep((prev) => {
      if (prev == null) return null;
      if (prev >= 4) {
        writeFlag(DEMO_STORAGE_KEYS.tourDone, true);
        return null;
      }
      return prev + 1;
    });
  }, []);

  const bumpMinute = useCallback(() => {
    setLive((prev) => {
      if (prev.status === 'finished') return prev;
      const minute = Math.min(90, prev.minute + 1);
      return {
        ...prev,
        minute,
        events: [
          ...prev.events,
          {
            id: nextEventId(prev.events),
            minute,
            text: `Spielminute ${minute}'`,
            type: 'info',
          },
        ],
      };
    });
  }, []);

  const addGoalHome = useCallback(() => {
    setLive((prev) => {
      if (prev.status === 'finished') return prev;
      const minute = prev.minute;
      const scoreHome = prev.scoreHome + 1;
      return {
        ...prev,
        scoreHome,
        events: [
          ...prev.events,
          {
            id: nextEventId(prev.events),
            minute,
            text: `TOR Rohrbach – Stand ${scoreHome}:${prev.scoreAway} (${minute}')`,
            type: 'goal_home',
          },
        ],
      };
    });
  }, []);

  const addGoalAway = useCallback(() => {
    setLive((prev) => {
      if (prev.status === 'finished') return prev;
      const minute = prev.minute;
      const scoreAway = prev.scoreAway + 1;
      return {
        ...prev,
        scoreAway,
        events: [
          ...prev.events,
          {
            id: nextEventId(prev.events),
            minute,
            text: `TOR Loosdorf – Stand ${prev.scoreHome}:${scoreAway} (${minute}')`,
            type: 'goal_away',
          },
        ],
      };
    });
  }, []);

  const addSubOrInfo = useCallback(() => {
    setLive((prev) => {
      if (prev.status === 'finished') return prev;
      const minute = prev.minute;
      return {
        ...prev,
        events: [
          ...prev.events,
          {
            id: nextEventId(prev.events),
            minute,
            text: `Wechsel / Ereignis – Demo (${minute}')`,
            type: 'sub',
          },
        ],
      };
    });
  }, []);

  const finishMatch = useCallback(() => {
    setLive((prev) => {
      if (prev.status === 'finished') return prev;
      return {
        ...prev,
        status: 'finished',
        minute: Math.max(prev.minute, 70),
        events: [
          ...prev.events,
          {
            id: nextEventId(prev.events),
            minute: Math.max(prev.minute, 70),
            text: `Abpfiff – Endstand ${prev.scoreHome}:${prev.scoreAway}`,
            type: 'fulltime',
          },
        ],
      };
    });
  }, []);

  const resetLive = useCallback(() => {
    setLive(createInitialLiveState());
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({
      fixtures: demoFixtures,
      live,
      welcomeOpen,
      tourStep,
      dismissWelcome,
      skipTour,
      nextTourStep,
      bumpMinute,
      addGoalHome,
      addGoalAway,
      addSubOrInfo,
      finishMatch,
      resetLive,
    }),
    [
      live,
      welcomeOpen,
      tourStep,
      dismissWelcome,
      skipTour,
      nextTourStep,
      bumpMinute,
      addGoalHome,
      addGoalAway,
      addSubOrInfo,
      finishMatch,
      resetLive,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  return ctx;
}
