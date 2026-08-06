/**
 * DEMO.2F — in-memory runtime for ONE demo live-match session.
 *
 * The productive LivePage / LiveMatchScreen run unchanged under /demo; every
 * Supabase read/write for a demo match id is short-circuited into this module
 * (see `src/lib/liveMatchService.ts`). Deliberately no localStorage: a reload
 * resets the session back to "not started".
 */

import {
  FIELD_SLOT_ORDER,
  fieldSlotMapToStartingIds,
  getBenchPlayers,
  startingLineupToSlotMap,
} from '../lib/matchEngine';
import type { FieldSlotId } from '../types/match';

/** Structurally identical to `LiveMatchRow` in liveMatchService. */
export type DemoLiveMatchRow = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  match_date: string | null;
  location: string | null;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
  live_started_at: string | null;
  live_elapsed_seconds: number | null;
  live_is_running: boolean | null;
  live_period: number | null;
  period_scores: unknown | null;
  u11_formation_id: string | null;
  minimum_playtime_enabled: boolean | null;
  minimum_playtime_minutes: number | null;
  planned_match_minutes: number | null;
  auto_matchday_feed_enabled: boolean | null;
};

/** Structurally identical to `MatchEventDbRow` in liveMatchService. */
export type DemoLiveEventRow = {
  id: string;
  match_id: string;
  type: string;
  minute: number | null;
  period: number | null;
  player_id: string | null;
  created_at: string;
  payload?: unknown;
};

export type DemoLiveLineupSnapshot = {
  startingPlayerIds: string[];
  squadPlayerIds: string[];
  savedBenchPlayerIds: string[];
};

export type DemoLiveRuntimeSnapshot = {
  matchId: string;
  status: string;
  scoreHome: number;
  scoreAway: number;
  liveIsRunning: boolean;
};

export type BootDemoLiveRuntimeParams = {
  matchId: string;
  teamSeasonId: string;
  opponent: string | null;
  isHome: boolean | null;
  matchDate?: string | null;
  location?: string | null;
  formationId?: string | null;
  minimumPlaytimeEnabled?: boolean | null;
  minimumPlaytimeMinutes?: number | null;
  plannedMatchMinutes?: number | null;
  slots: Record<FieldSlotId, string | null>;
  squadPlayerIds: readonly string[];
};

/** Alle Demo-Match-IDs (siehe demoDataSource / demoMatchState). */
const DEMO_MATCH_ID_PREFIX = '00000000-demo-';
const DEMO_EVENT_ID_PREFIX = 'demo-live-ev-';

const MATCH_PATCH_KEYS = new Set<string>([
  'opponent',
  'match_date',
  'location',
  'status',
  'score_home',
  'score_away',
  'live_started_at',
  'live_elapsed_seconds',
  'live_is_running',
  'live_period',
  'period_scores',
  'u11_formation_id',
  'minimum_playtime_enabled',
  'minimum_playtime_minutes',
  'planned_match_minutes',
  'auto_matchday_feed_enabled',
]);

type DemoLiveSession = {
  match: DemoLiveMatchRow;
  eventIsHome: boolean | null;
  events: DemoLiveEventRow[];
  slots: Record<FieldSlotId, string | null>;
  squadPlayerIds: string[];
  benchPlayerIds: string[];
  kickoffStartingPlayerIds: string[] | null;
  calendarFinalized: boolean;
};

let session: DemoLiveSession | null = null;
let eventCounter = 0;
const listeners = new Set<() => void>();

function normId(raw: string | null | undefined): string {
  return String(raw ?? '').trim();
}

function uniqueIds(ids: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = normId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeSlots(slots: Record<FieldSlotId, string | null>): Record<FieldSlotId, string | null> {
  const next = {} as Record<FieldSlotId, string | null>;
  const seen = new Set<string>();
  for (const slot of FIELD_SLOT_ORDER) {
    const pid = normId(slots?.[slot]);
    if (!pid || seen.has(pid)) {
      next[slot] = null;
      continue;
    }
    seen.add(pid);
    next[slot] = pid;
  }
  return next;
}

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

/** Re-render-Trigger für Demo-UI (Bottom-Nav-Puls, Spielplan-Score). */
export function subscribeDemoLiveRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isDemoMatchId(matchId: string | null | undefined): boolean {
  return normId(matchId).startsWith(DEMO_MATCH_ID_PREFIX);
}

export function isDemoMatchEventId(eventId: string | null | undefined): boolean {
  return normId(eventId).startsWith(DEMO_EVENT_ID_PREFIX);
}

/** True nur für die Match-ID der aktiven Runtime-Session. */
export function isDemoLiveMatch(matchId: string | null | undefined): boolean {
  const id = normId(matchId);
  return Boolean(id) && session != null && session.match.id === id;
}

function activeSessionFor(matchId: string | null | undefined): DemoLiveSession | null {
  return isDemoLiveMatch(matchId) ? session : null;
}

/**
 * Session aus der lokalen Vorbereitung aufbauen (Status `scheduled`, 0:0, keine Events).
 * Ein laufendes/beendetes Spiel bleibt erhalten, solange `force` nicht gesetzt ist.
 */
export function bootDemoLiveRuntime(
  params: BootDemoLiveRuntimeParams,
  options?: { force?: boolean },
): void {
  const id = normId(params.matchId);
  if (!id) return;

  const alreadyStarted =
    session != null &&
    session.match.id === id &&
    (session.match.status === 'live' || session.match.status === 'finished');
  if (alreadyStarted && !options?.force) return;

  const slots = normalizeSlots(params.slots);
  const onFieldIds = fieldSlotMapToStartingIds(slots).filter((pid) => pid.length > 0);
  const squadPlayerIds = uniqueIds([...params.squadPlayerIds, ...onFieldIds]);

  session = {
    match: {
      id,
      team_season_id: normId(params.teamSeasonId),
      opponent: params.opponent ?? null,
      match_date: params.matchDate ?? null,
      location: params.location ?? null,
      status: 'scheduled',
      score_home: 0,
      score_away: 0,
      live_started_at: null,
      live_elapsed_seconds: 0,
      live_is_running: false,
      live_period: null,
      period_scores: null,
      u11_formation_id: params.formationId ?? null,
      minimum_playtime_enabled: params.minimumPlaytimeEnabled ?? null,
      minimum_playtime_minutes: params.minimumPlaytimeMinutes ?? null,
      planned_match_minutes: params.plannedMatchMinutes ?? null,
      auto_matchday_feed_enabled: false,
    },
    eventIsHome: params.isHome ?? null,
    events: [],
    slots,
    squadPlayerIds,
    benchPlayerIds: getBenchPlayers(squadPlayerIds, onFieldIds),
    kickoffStartingPlayerIds: null,
    calendarFinalized: false,
  };
  eventCounter = 0;
  notify();
}

export function resetDemoLiveRuntime(): void {
  session = null;
  eventCounter = 0;
  notify();
}

export function getDemoLiveMatchRow(matchId: string | null | undefined): DemoLiveMatchRow | null {
  const s = activeSessionFor(matchId);
  return s ? { ...s.match } : null;
}

export function patchDemoLiveMatchRow(
  matchId: string | null | undefined,
  patch: Record<string, unknown>,
): boolean {
  const s = activeSessionFor(matchId);
  if (!s) return false;
  const next: Record<string, unknown> = { ...s.match };
  for (const [key, value] of Object.entries(patch)) {
    if (MATCH_PATCH_KEYS.has(key)) next[key] = value;
  }
  s.match = next as unknown as DemoLiveMatchRow;
  notify();
  return true;
}

/** Erste laufende Demo-Partie (Pendant zu `fetchFirstLiveMatch`). */
export function getDemoFirstLiveMatchRow(): DemoLiveMatchRow | null {
  if (!session || session.match.status !== 'live') return null;
  return { ...session.match };
}

export function appendDemoLiveEvent(payload: {
  match_id: string;
  type: string;
  minute: number;
  period?: number | null;
  player_id?: string | null;
  payload?: Record<string, unknown> | null;
}): { id: string | null } {
  const s = activeSessionFor(payload.match_id);
  if (!s) return { id: null };
  eventCounter += 1;
  const id = `${DEMO_EVENT_ID_PREFIX}${eventCounter}`;
  s.events = [
    ...s.events,
    {
      id,
      match_id: s.match.id,
      type: payload.type,
      minute: payload.minute ?? 0,
      period: payload.period ?? null,
      player_id: normId(payload.player_id) || null,
      // +counter: eindeutige, monoton steigende Sortierung auch bei mehreren Events pro ms
      created_at: new Date(Date.now() + eventCounter).toISOString(),
      payload: payload.payload ?? null,
    },
  ];
  notify();
  return { id };
}

export function deleteDemoLiveEvent(eventId: string | null | undefined): boolean {
  const id = normId(eventId);
  if (!session || !id) return false;
  const before = session.events.length;
  session.events = session.events.filter((e) => e.id !== id);
  if (session.events.length === before) return false;
  notify();
  return true;
}

export function getDemoLiveEventRows(matchId: string | null | undefined): DemoLiveEventRow[] {
  const s = activeSessionFor(matchId);
  if (!s) return [];
  return [...s.events].sort(
    (a, b) => (a.minute ?? 0) - (b.minute ?? 0) || a.created_at.localeCompare(b.created_at),
  );
}

export function getDemoLiveLineup(matchId: string | null | undefined): DemoLiveLineupSnapshot {
  const s = activeSessionFor(matchId);
  if (!s) return { startingPlayerIds: [], squadPlayerIds: [], savedBenchPlayerIds: [] };
  const startingPlayerIds = fieldSlotMapToStartingIds(s.slots);
  const onFieldIds = startingPlayerIds.filter((pid) => pid.length > 0);
  const savedBenchPlayerIds = getBenchPlayers(s.squadPlayerIds, onFieldIds, s.benchPlayerIds);
  return {
    startingPlayerIds,
    squadPlayerIds: uniqueIds([...onFieldIds, ...savedBenchPlayerIds]),
    savedBenchPlayerIds,
  };
}

export function setDemoLiveLineup(
  matchId: string | null | undefined,
  startingPlayerIds: Array<string | null | undefined>,
  squadPlayerIds: readonly string[],
  benchPlayerIds?: readonly string[],
): boolean {
  const s = activeSessionFor(matchId);
  if (!s) return false;
  const slots = normalizeSlots(
    startingLineupToSlotMap(startingPlayerIds.map((pid) => normId(pid))),
  );
  const onFieldIds = fieldSlotMapToStartingIds(slots).filter((pid) => pid.length > 0);
  const squad = uniqueIds([...squadPlayerIds, ...onFieldIds, ...(benchPlayerIds ?? [])]);
  const bench = benchPlayerIds
    ? uniqueIds(benchPlayerIds).filter((pid) => !onFieldIds.includes(pid))
    : getBenchPlayers(squad, onFieldIds, s.benchPlayerIds);
  s.slots = slots;
  s.squadPlayerIds = squad;
  s.benchPlayerIds = bench;
  notify();
  return true;
}

export function getDemoLiveBenchPlayerIds(matchId: string | null | undefined): string[] {
  const s = activeSessionFor(matchId);
  return s ? [...s.benchPlayerIds] : [];
}

/** Kickoff-Snapshot einmalig aus der aktuellen Aufstellung festschreiben. */
export function ensureDemoKickoffLineupSnapshot(matchId: string | null | undefined): boolean {
  const s = activeSessionFor(matchId);
  if (!s) return false;
  if (s.kickoffStartingPlayerIds != null) return true;
  s.kickoffStartingPlayerIds = fieldSlotMapToStartingIds(s.slots);
  notify();
  return true;
}

export function getDemoKickoffLineupPlayerIds(matchId: string | null | undefined): string[] | null {
  const s = activeSessionFor(matchId);
  if (!s || s.kickoffStartingPlayerIds == null) return null;
  return [...s.kickoffStartingPlayerIds];
}

export function getDemoLiveEventIsHome(matchId: string | null | undefined): boolean | null {
  const s = activeSessionFor(matchId);
  return s ? s.eventIsHome : null;
}

export function markDemoLiveCalendarFinalized(matchId: string | null | undefined): boolean {
  const s = activeSessionFor(matchId);
  if (!s) return false;
  s.calendarFinalized = true;
  notify();
  return true;
}

export function isDemoLiveCalendarFinalized(matchId: string | null | undefined): boolean {
  return activeSessionFor(matchId)?.calendarFinalized ?? false;
}

export function getDemoLiveRuntimeSnapshot(): DemoLiveRuntimeSnapshot | null {
  if (!session) return null;
  return {
    matchId: session.match.id,
    status: String(session.match.status ?? 'scheduled'),
    scoreHome: Number(session.match.score_home ?? 0),
    scoreAway: Number(session.match.score_away ?? 0),
    liveIsRunning: Boolean(session.match.live_is_running),
  };
}

/** Live-/Endstand der Runtime; `null` solange nicht angepfiffen (Katalog-Seed gilt weiter). */
export function getDemoLiveRuntimeScore(
  matchId: string | null | undefined,
): { scoreHome: number; scoreAway: number } | null {
  const s = activeSessionFor(matchId);
  if (!s) return null;
  if (s.match.status !== 'live' && s.match.status !== 'finished') return null;
  return {
    scoreHome: Number(s.match.score_home ?? 0),
    scoreAway: Number(s.match.score_away ?? 0),
  };
}
