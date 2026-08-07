import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createInitialLiveState, demoFixtures } from './demoFixtures';
import {
  buildDemoEvents,
  buildDemoFeedPosts,
  type DemoDataSource,
  DEMO_MATCH_ID_LIVE,
  DEMO_TEAM_ID,
  DEMO_TEAM_SEASON_ID,
} from './demoDataSource';
import {
  bootDemoLiveRuntime,
  DEMO_CHAMPIONSHIP_LIVE_SEED,
  getDemoLiveRuntimeSnapshot,
  resetDemoLiveRuntime,
  subscribeDemoLiveRuntime,
} from './demoLiveRuntime';
import {
  buildDemoTournamentDefaultPrep,
  DEMO_TOURNAMENT_EVENT_ID,
  DEMO_TOURNAMENT_FINAL_MATCH_ID,
  getDemoTournamentAsDemoMatchLite,
  getDemoTournamentSquadPlayerIds,
  isDemoTournamentMatchId,
  patchDemoTournamentMatchSlot,
  resetDemoTournamentState,
} from './demoTournamentState';
import {
  attendanceRowsToByEventId,
  buildDemoPlayers,
  buildInitialDemoAttendance,
  DEMO_SELF_PLAYER_ID,
  type DemoAttendanceRow,
} from './demoAttendance';
import type { AttendanceStatus, EventAttendanceData } from '../hooks/useEventsAttendance';
import type { PlayerItem } from '../hooks/usePlayers';
import type { TeamStaffMember } from '../hooks/useTeamStaff';
import type { DemoFixtures, DemoLiveEvent, DemoLiveState } from './demoTypes';
import type { FieldSlotId } from '../types/match';
import type { U11FormationId } from '../lib/matchFormations';
import { buildDemoStaff } from './demoStaff';
import {
  buildInitialDemoMatchStates,
  cloneDemoMatchState,
  getDemoMatchLite,
  type DemoMatchLite,
  type DemoMatchPrepState,
} from './demoMatchState';

export type DemoModeContextValue = {
  isDemo: true;
  basePath: '/demo';
  fixtures: DemoFixtures;
  data: DemoDataSource;
  players: PlayerItem[];
  /** Fiktives Trainerteam (Markus + Sara). */
  staff: TeamStaffMember[];
  selfPlayerId: string;
  attendanceRows: DemoAttendanceRow[];
  getAttendanceByEventIds: (eventIds: string[]) => Record<string, EventAttendanceData>;
  /** status null = Eintrag entfernen (offen). */
  setDemoAttendance: (eventId: string, playerId: string, status: AttendanceStatus | null) => void;
  resetDemoAttendance: () => void;
  getDemoMatch: (matchId: string) => DemoMatchLite | null;
  getDemoMatchPrep: (matchId: string) => DemoMatchPrepState | null;
  setDemoMatchSquad: (matchId: string, squadPlayerIds: string[]) => void;
  setDemoMatchLineup: (
    matchId: string,
    slots: Record<FieldSlotId, string | null>,
    squadPlayerIds: string[],
    formationId: U11FormationId,
  ) => void;
  setDemoMatchFormation: (matchId: string, formationId: U11FormationId) => void;
  setDemoMatchPublishedLocal: (matchId: string, published: boolean) => void;
  resetDemoMatchPrep: (matchId?: string) => void;
  /**
   * DEMO.2F — lokale Live-Runtime (produktiver LiveMatchScreen unter /demo).
   * Zählt bei jeder Runtime-Änderung hoch; Status/ID des Live-Spiels für Nav & Spielplan.
   */
  liveRuntimeVersion: number;
  liveRuntimeStatus: string | null;
  liveRuntimeMatchId: string | null;
  /**
   * Aufstellung als Live-Session übernehmen (Status bleibt `scheduled` bis zum Anpfiff).
   * `prep` überschreibt den Context-State, damit die gerade gespeicherte Aufstellung
   * nicht erst über den nächsten Render greift.
   */
  startDemoLiveMatch: (
    matchId: string,
    prep?: {
      slots: Record<FieldSlotId, string | null>;
      squadPlayerIds: string[];
      formationId: U11FormationId;
    },
  ) => void;
  /** @deprecated DEMO.2F: Legacy-Mock-Ticker (DemoLivePage), nicht mehr geroutet. */
  live: DemoLiveState;
  bumpMinute: () => void;
  addGoalHome: () => void;
  addGoalAway: () => void;
  addSubOrInfo: () => void;
  finishMatch: () => void;
  resetLive: () => void;
  /** DEMO.2H — kompletter lokaler Reset (Attendance, Prep, LIVE, Turnier). */
  resetAllDemo: () => void;
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
  const staff = useMemo(() => buildDemoStaff(), []);
  const [attendanceRows, setAttendanceRows] = useState<DemoAttendanceRow[]>(() =>
    buildInitialDemoAttendance(demoFixtures.events),
  );
  const [matchPrepById, setMatchPrepById] = useState<Record<string, DemoMatchPrepState>>(() => {
    const initial = buildInitialDemoMatchStates();
    const tournamentPrep = buildDemoTournamentDefaultPrep(DEMO_TOURNAMENT_FINAL_MATCH_ID);
    if (tournamentPrep) {
      initial[DEMO_TOURNAMENT_FINAL_MATCH_ID] = tournamentPrep;
    }
    // Synchron vor dem ersten Child-Render booten — sonst findet LiveMatchScreen
    // nach Reload/Direktlink die Session noch nicht (useEffect wäre zu spät).
    const prep = initial[DEMO_MATCH_ID_LIVE];
    const lite = getDemoMatchLite(DEMO_MATCH_ID_LIVE);
    if (prep && lite) {
      bootDemoLiveRuntime(
        {
          matchId: lite.id,
          teamSeasonId: lite.team_season_id,
          opponent: lite.opponent,
          isHome: lite.is_home,
          matchDate: null,
          location: null,
          formationId: prep.formationId,
          minimumPlaytimeEnabled: lite.minimum_playtime_enabled,
          minimumPlaytimeMinutes: lite.minimum_playtime_minutes,
          plannedMatchMinutes: lite.planned_match_minutes,
          slots: prep.slots,
          squadPlayerIds: prep.squadPlayerIds,
        },
        { force: true, asLive: DEMO_CHAMPIONSHIP_LIVE_SEED },
      );
    }
    return initial;
  });

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

  const getDemoMatch = useCallback(
    (matchId: string) => getDemoMatchLite(matchId) ?? getDemoTournamentAsDemoMatchLite(matchId),
    [],
  );

  const getDemoMatchPrep = useCallback(
    (matchId: string) => {
      const st =
        matchPrepById[matchId] ??
        (isDemoTournamentMatchId(matchId) ? buildDemoTournamentDefaultPrep(matchId) : null);
      if (!st) return null;
      if (!isDemoTournamentMatchId(matchId)) return cloneDemoMatchState(st);
      const allowed = new Set(getDemoTournamentSquadPlayerIds(DEMO_TOURNAMENT_EVENT_ID));
      const slots = { ...st.slots };
      for (const key of Object.keys(slots) as FieldSlotId[]) {
        const pid = slots[key];
        if (pid && !allowed.has(pid)) slots[key] = null;
      }
      const squadPlayerIds = st.squadPlayerIds.filter((id) => allowed.has(id));
      return cloneDemoMatchState({
        ...st,
        slots,
        squadPlayerIds: squadPlayerIds.length > 0 ? squadPlayerIds : [...allowed],
      });
    },
    [matchPrepById],
  );

  const setDemoMatchSquad = useCallback((matchId: string, squadPlayerIds: string[]) => {
    setMatchPrepById((prev) => {
      const cur =
        prev[matchId] ??
        buildInitialDemoMatchStates()[matchId] ??
        buildDemoTournamentDefaultPrep(matchId);
      if (!cur) return prev;
      const allowed = new Set(squadPlayerIds);
      const slots = { ...cur.slots };
      for (const key of Object.keys(slots) as FieldSlotId[]) {
        const pid = slots[key];
        if (pid && !allowed.has(pid)) slots[key] = null;
      }
      if (isDemoTournamentMatchId(matchId)) {
        patchDemoTournamentMatchSlot(matchId, { has_squad: true });
      }
      return {
        ...prev,
        [matchId]: { ...cur, squadPlayerIds: [...squadPlayerIds], slots },
      };
    });
  }, []);

  const setDemoMatchLineup = useCallback(
    (
      matchId: string,
      slots: Record<FieldSlotId, string | null>,
      squadPlayerIds: string[],
      formationId: U11FormationId,
    ) => {
      if (isDemoTournamentMatchId(matchId)) {
        patchDemoTournamentMatchSlot(matchId, { has_lineup: true, has_squad: true });
      }
      setMatchPrepById((prev) => ({
        ...prev,
        [matchId]: {
          squadPlayerIds: [...squadPlayerIds],
          slots: { ...slots },
          formationId,
          publishedLocal: prev[matchId]?.publishedLocal ?? false,
        },
      }));
    },
    [],
  );

  const setDemoMatchFormation = useCallback((matchId: string, formationId: U11FormationId) => {
    setMatchPrepById((prev) => {
      const cur = prev[matchId];
      if (!cur) return prev;
      return { ...prev, [matchId]: { ...cur, formationId } };
    });
  }, []);

  const setDemoMatchPublishedLocal = useCallback((matchId: string, published: boolean) => {
    setMatchPrepById((prev) => {
      const cur = prev[matchId];
      if (!cur) return prev;
      return { ...prev, [matchId]: { ...cur, publishedLocal: published } };
    });
  }, []);

  const resetDemoMatchPrep = useCallback((matchId?: string) => {
    const initial = buildInitialDemoMatchStates();
    const tournamentPrep = buildDemoTournamentDefaultPrep(DEMO_TOURNAMENT_FINAL_MATCH_ID);
    if (tournamentPrep) {
      initial[DEMO_TOURNAMENT_FINAL_MATCH_ID] = tournamentPrep;
    }
    if (!matchId) {
      setMatchPrepById(initial);
      return;
    }
    setMatchPrepById((prev) => ({
      ...prev,
      [matchId]: initial[matchId] ?? buildDemoTournamentDefaultPrep(matchId) ?? prev[matchId],
    }));
  }, []);

  const [liveRuntimeVersion, setLiveRuntimeVersion] = useState(0);
  useEffect(() => subscribeDemoLiveRuntime(() => setLiveRuntimeVersion((v) => v + 1)), []);

  /** Session beim Verlassen der Demo verwerfen — sonst sieht /app eine „laufende“ Partie. */
  useEffect(
    () => () => {
      resetDemoLiveRuntime();
      resetDemoTournamentState();
    },
    [],
  );

  const bootLiveRuntime = useCallback(
    (
      matchId: string,
      options?: {
        force?: boolean;
        asLive?: boolean | typeof DEMO_CHAMPIONSHIP_LIVE_SEED;
        prep?: {
          slots: Record<FieldSlotId, string | null>;
          squadPlayerIds: string[];
          formationId: U11FormationId;
        };
      },
    ) => {
      const lite = getDemoMatchLite(matchId) ?? getDemoTournamentAsDemoMatchLite(matchId);
      const prep =
        options?.prep ??
        matchPrepById[matchId] ??
        buildInitialDemoMatchStates()[matchId] ??
        (isDemoTournamentMatchId(matchId) ? buildDemoTournamentDefaultPrep(matchId) : null);
      if (!lite || !prep) return;
      const ev = data.events.find((e) => e.id === lite.event_id);
      bootDemoLiveRuntime(
        {
          matchId: lite.id,
          teamSeasonId: lite.team_season_id,
          opponent: lite.opponent,
          isHome: lite.is_home,
          matchDate: ev?.starts_at ?? null,
          location: ev?.location ?? null,
          formationId: prep.formationId,
          minimumPlaytimeEnabled: lite.minimum_playtime_enabled,
          minimumPlaytimeMinutes: lite.minimum_playtime_minutes,
          plannedMatchMinutes: lite.planned_match_minutes,
          slots: prep.slots,
          squadPlayerIds: prep.squadPlayerIds,
        },
        { force: options?.force, asLive: options?.asLive },
      );
    },
    [data.events, matchPrepById],
  );

  /** Meisterschafts-Session mit Prep syncen — aktive Turnier-Session nicht überschreiben. */
  useEffect(() => {
    const snap = getDemoLiveRuntimeSnapshot();
    if (snap?.matchId && snap.matchId !== DEMO_MATCH_ID_LIVE) return;
    bootLiveRuntime(DEMO_MATCH_ID_LIVE);
  }, [bootLiveRuntime]);

  const startDemoLiveMatch = useCallback(
    (
      matchId: string,
      prep?: {
        slots: Record<FieldSlotId, string | null>;
        squadPlayerIds: string[];
        formationId: U11FormationId;
      },
    ) => {
      bootLiveRuntime(matchId, { prep, force: true });
    },
    [bootLiveRuntime],
  );

  const liveRuntime = useMemo(() => {
    void liveRuntimeVersion;
    return getDemoLiveRuntimeSnapshot();
  }, [liveRuntimeVersion]);

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
    bootLiveRuntime(DEMO_MATCH_ID_LIVE, { force: true, asLive: DEMO_CHAMPIONSHIP_LIVE_SEED });
  }, [bootLiveRuntime]);

  const resetAllDemo = useCallback(() => {
    resetDemoAttendance();
    resetDemoTournamentState();
    resetDemoLiveRuntime();
    const initial = buildInitialDemoMatchStates();
    const tournamentPrep = buildDemoTournamentDefaultPrep(DEMO_TOURNAMENT_FINAL_MATCH_ID);
    if (tournamentPrep) {
      initial[DEMO_TOURNAMENT_FINAL_MATCH_ID] = tournamentPrep;
    }
    setMatchPrepById(initial);
    setLive(createInitialLiveState());
    const prep = initial[DEMO_MATCH_ID_LIVE];
    const lite = getDemoMatchLite(DEMO_MATCH_ID_LIVE);
    if (prep && lite) {
      bootDemoLiveRuntime(
        {
          matchId: lite.id,
          teamSeasonId: lite.team_season_id,
          opponent: lite.opponent,
          isHome: lite.is_home,
          matchDate: null,
          location: null,
          formationId: prep.formationId,
          minimumPlaytimeEnabled: lite.minimum_playtime_enabled,
          minimumPlaytimeMinutes: lite.minimum_playtime_minutes,
          plannedMatchMinutes: lite.planned_match_minutes,
          slots: prep.slots,
          squadPlayerIds: prep.squadPlayerIds,
        },
        { force: true, asLive: DEMO_CHAMPIONSHIP_LIVE_SEED },
      );
    }
  }, [resetDemoAttendance]);

  const value = useMemo<DemoModeContextValue>(
    () => ({
      isDemo: true,
      basePath: '/demo',
      fixtures: demoFixtures,
      data,
      players,
      staff,
      selfPlayerId: DEMO_SELF_PLAYER_ID,
      attendanceRows,
      getAttendanceByEventIds,
      setDemoAttendance,
      resetDemoAttendance,
      getDemoMatch,
      getDemoMatchPrep,
      setDemoMatchSquad,
      setDemoMatchLineup,
      setDemoMatchFormation,
      setDemoMatchPublishedLocal,
      resetDemoMatchPrep,
      liveRuntimeVersion,
      liveRuntimeStatus: liveRuntime?.status ?? null,
      liveRuntimeMatchId: liveRuntime?.matchId ?? null,
      startDemoLiveMatch,
      live,
      bumpMinute,
      addGoalHome,
      addGoalAway,
      addSubOrInfo,
      finishMatch,
      resetLive,
      resetAllDemo,
    }),
    [
      data,
      players,
      staff,
      attendanceRows,
      getAttendanceByEventIds,
      setDemoAttendance,
      resetDemoAttendance,
      getDemoMatch,
      getDemoMatchPrep,
      setDemoMatchSquad,
      setDemoMatchLineup,
      setDemoMatchFormation,
      setDemoMatchPublishedLocal,
      resetDemoMatchPrep,
      liveRuntimeVersion,
      liveRuntime,
      startDemoLiveMatch,
      live,
      bumpMinute,
      addGoalHome,
      addGoalAway,
      addSubOrInfo,
      finishMatch,
      resetLive,
      resetAllDemo,
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
