import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createInitialLiveState, demoFixtures } from './demoFixtures';
import {
  buildDemoEvents,
  buildDemoFeedPosts,
  type DemoDataSource,
  DEMO_TEAM_ID,
  DEMO_TEAM_SEASON_ID,
} from './demoDataSource';
import {
  attendanceRowsToByEventId,
  buildDemoPlayers,
  buildInitialDemoAttendance,
  DEMO_SELF_PLAYER_ID,
  type DemoAttendanceRow,
} from './demoAttendance';
import type { AttendanceStatus, EventAttendanceData } from '../hooks/useEventsAttendance';
import type { PlayerItem } from '../hooks/usePlayers';
import type { DemoFixtures, DemoLiveEvent, DemoLiveState } from './demoTypes';

export type DemoModeContextValue = {
  isDemo: true;
  basePath: '/demo';
  fixtures: DemoFixtures;
  data: DemoDataSource;
  players: PlayerItem[];
  selfPlayerId: string;
  attendanceRows: DemoAttendanceRow[];
  getAttendanceByEventIds: (eventIds: string[]) => Record<string, EventAttendanceData>;
  /** status null = Eintrag entfernen (offen). */
  setDemoAttendance: (eventId: string, playerId: string, status: AttendanceStatus | null) => void;
  resetDemoAttendance: () => void;
  live: DemoLiveState;
  bumpMinute: () => void;
  addGoalHome: () => void;
  addGoalAway: () => void;
  addSubOrInfo: () => void;
  finishMatch: () => void;
  resetLive: () => void;
};

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

function nextEventId(events: DemoLiveEvent[]): string {
  return `le-local-${events.length + 1}-${Date.now()}`;
}

function buildDataSource(): DemoDataSource {
  const feed = buildDemoFeedPosts();
  return {
    teamName: demoFixtures.teamName,
    seasonLabel: demoFixtures.seasonLabel,
    teamSeasonId: DEMO_TEAM_SEASON_ID,
    teamId: DEMO_TEAM_ID,
    events: buildDemoEvents(),
    feedPosts: feed.active,
    historicFeedPosts: feed.historic,
  };
}

/** Öffentlicher Demo-Provider — nur lokale Fixtures, keine Supabase-Writes. */
export function DemoProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [live, setLive] = useState<DemoLiveState>(() => createInitialLiveState());
  const data = useMemo(() => buildDataSource(), []);
  const players = useMemo(() => buildDemoPlayers(), []);
  const [attendanceRows, setAttendanceRows] = useState<DemoAttendanceRow[]>(() =>
    buildInitialDemoAttendance(demoFixtures.events),
  );

  const getAttendanceByEventIds = useCallback(
    (eventIds: string[]) => attendanceRowsToByEventId(attendanceRows, eventIds),
    [attendanceRows],
  );

  const setDemoAttendance = useCallback(
    (eventId: string, playerId: string, status: AttendanceStatus | null) => {
      setAttendanceRows((prev) => {
        const without = prev.filter((r) => !(r.event_id === eventId && r.player_id === playerId));
        if (status == null) return without;
        return [...without, { event_id: eventId, player_id: playerId, status }];
      });
    },
    [],
  );

  const resetDemoAttendance = useCallback(() => {
    setAttendanceRows(buildInitialDemoAttendance(demoFixtures.events));
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
          { id: nextEventId(prev.events), minute, text: `Spielminute ${minute}'`, type: 'info' },
        ],
      };
    });
  }, []);

  const addGoalHome = useCallback(() => {
    setLive((prev) => {
      if (prev.status === 'finished') return prev;
      const scoreHome = prev.scoreHome + 1;
      return {
        ...prev,
        scoreHome,
        events: [
          ...prev.events,
          {
            id: nextEventId(prev.events),
            minute: prev.minute,
            text: `TOR Rohrbach – Stand ${scoreHome}:${prev.scoreAway} (${prev.minute}')`,
            type: 'goal_home',
          },
        ],
      };
    });
  }, []);

  const addGoalAway = useCallback(() => {
    setLive((prev) => {
      if (prev.status === 'finished') return prev;
      const scoreAway = prev.scoreAway + 1;
      return {
        ...prev,
        scoreAway,
        events: [
          ...prev.events,
          {
            id: nextEventId(prev.events),
            minute: prev.minute,
            text: `TOR Loosdorf – Stand ${prev.scoreHome}:${scoreAway} (${prev.minute}')`,
            type: 'goal_away',
          },
        ],
      };
    });
  }, []);

  const addSubOrInfo = useCallback(() => {
    setLive((prev) => {
      if (prev.status === 'finished') return prev;
      return {
        ...prev,
        events: [
          ...prev.events,
          {
            id: nextEventId(prev.events),
            minute: prev.minute,
            text: `Wechsel / Ereignis – Demo (${prev.minute}')`,
            type: 'sub',
          },
        ],
      };
    });
  }, []);

  const finishMatch = useCallback(() => {
    setLive((prev) => {
      if (prev.status === 'finished') return prev;
      const minute = Math.max(prev.minute, 70);
      return {
        ...prev,
        status: 'finished',
        minute,
        events: [
          ...prev.events,
          {
            id: nextEventId(prev.events),
            minute,
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

  const value = useMemo<DemoModeContextValue>(
    () => ({
      isDemo: true,
      basePath: '/demo',
      fixtures: demoFixtures,
      data,
      players,
      selfPlayerId: DEMO_SELF_PLAYER_ID,
      attendanceRows,
      getAttendanceByEventIds,
      setDemoAttendance,
      resetDemoAttendance,
      live,
      bumpMinute,
      addGoalHome,
      addGoalAway,
      addSubOrInfo,
      finishMatch,
      resetLive,
    }),
    [
      data,
      players,
      attendanceRows,
      getAttendanceByEventIds,
      setDemoAttendance,
      resetDemoAttendance,
      live,
      bumpMinute,
      addGoalHome,
      addGoalAway,
      addSubOrInfo,
      finishMatch,
      resetLive,
    ],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

/** Optional — null außerhalb der Demo. */
export function useDemoMode(): DemoModeContextValue | null {
  return useContext(DemoModeContext);
}

/** Strict — nur innerhalb DemoProvider. */
export function useDemo(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  return ctx;
}

/** Pfad beginnt mit /demo (auch ohne Provider, z. B. Splash). */
export function useIsDemoPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/demo');
}
