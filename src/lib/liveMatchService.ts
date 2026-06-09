import { supabase } from './supabaseClient';
import { debugAssertMatchEventDbType } from './matchEventScores';
import type { FieldSlotId } from '../types/match';
import {
  clampEffectiveMatchSeconds,
  computeLiveMatchSecondsFromClockState,
  getBenchPlayers,
  getOnFieldIdsInSlotOrder,
  fieldSlotMapToStartingIds,
  pickKickoffLineupBaseForReplay,
  replaySubstitutionEventsOnSlots,
  resolveReplayAtMatchSecond,
  applyExtraPlayerOnToSlots,
  applyExtraPlayerOffToSlots,
  dedupeFieldSlotMap,
  fairPlayExtraPlayerIdFromOffEvent,
  fairPlayExtraPlayerIdFromSortedEvents,
  fairPlayRemovedPlayerIdFromEvent,
  sortMatchEventsChronologically,
  startingLineupToSlotMap,
  swapTwoOccupiedFieldSlots,
  type MatchEngineEvent,
  type MatchEventType,
} from './matchEngine';

/** Reihenfolge der Slots = Startelf-Reihenfolge (7er). */
export const LIVE_FIELD_SLOT_ORDER: FieldSlotId[] = ['GK', 'LB', 'RB', 'CM', 'LW', 'RW', 'ST', 'FP'];

/** Während Live-Lineup-Persist: Repair/Realtime pausieren. */
export const lineupPersistInProgress = { current: false };

export type LineupPersistReason =
  | 'position_swap'
  | 'formation_change'
  | 'substitution'
  | 'extra_player_on'
  | 'extra_player_off'
  | 'replay_sync'
  | 'repair';

export type SafeLineupPersistPayload = {
  startingPlayerIds: string[];
  fieldPlayerIds: string[];
  squadPlayerIds: string[];
  benchPlayerIds: string[];
  removedIds: string[];
  ok: boolean;
};

export type LiveMatchRow = {
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

/** UI-/Button-Logik: aus DB-Status + Uhr, ohne neue Spalten. */
export type MatchLiveClockStatus = 'not_started' | 'live' | 'paused' | 'finished';

export function getMatchLiveClockStatus(
  row: LiveMatchRow | null,
  opts: { hasClockStarted: boolean },
): MatchLiveClockStatus {
  if (!row || row.status === 'finished') return 'finished';
  if (row.status !== 'live') return 'not_started';
  if (!opts.hasClockStarted && !row.live_started_at) return 'not_started';
  if (row.live_is_running) return 'live';
  return 'paused';
}

/** @deprecated Nutze `useMatchTimer` — Wall-Clock + Akkumulator (geclamped). */
export function computeLiveMatchElapsedSeconds(row: LiveMatchRow | null, nowMs = Date.now()): number {
  if (!row) return 0;
  return computeLiveMatchSecondsFromClockState(
    {
      elapsedSeconds: row.live_elapsed_seconds,
      isRunning: row.live_is_running,
      hasEnded: row.status === 'finished',
      startedAtISO: row.live_is_running ? row.live_started_at : null,
    },
    nowMs,
  );
}

export type MatchEventDbRow = {
  id: string;
  match_id: string;
  type: string;
  minute: number | null;
  period: number | null;
  player_id: string | null;
  created_at: string;
  payload?: unknown;
};

const ENGINE_TYPES = new Set<MatchEventType>([
  'start',
  'pause',
  'resume',
  'end',
  'sub_out',
  'sub_in',
  'goal',
  'goal_away',
]);

/**
 * DB-Spalte `minute` speichert hier Spielsekunden seit Anpfiff (nicht Anzeige-Minute).
 */
export function matchEventDbRowToEngine(row: MatchEventDbRow): MatchEngineEvent | null {
  const createdAt = row.created_at;
  if (row.type === 'kickoff') {
    return {
      id: row.id,
      type: 'start',
      timestamp: row.minute ?? 0,
      playerId: undefined,
      createdAt,
    };
  }
  if (row.type === 'final_whistle') {
    return {
      id: row.id,
      type: 'end',
      timestamp: row.minute ?? 0,
      playerId: undefined,
      createdAt,
    };
  }
  if (row.type === 'period_start') {
    return {
      id: row.id,
      type: 'resume',
      timestamp: row.minute ?? 0,
      playerId: undefined,
      createdAt,
    };
  }
  if (row.type === 'period_end') {
    return {
      id: row.id,
      type: 'pause',
      timestamp: row.minute ?? 0,
      playerId: undefined,
      createdAt,
    };
  }
  if (row.type === 'goal_away') {
    return {
      id: row.id,
      type: 'goal_away',
      timestamp: row.minute ?? 0,
      playerId: row.player_id ?? undefined,
      createdAt,
    };
  }
  if (row.type === 'position_swap') {
    const p = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
    const swapWith =
      typeof p.swap_player_id === 'string' && p.swap_player_id.trim().length > 0 ? p.swap_player_id.trim() : '';
    const fairPlayPositionSwap = p.fair_play === true || p.fair_play === 'true';
    const anchorRaw = typeof p.anchor_slot === 'string' ? p.anchor_slot.trim() : '';
    const anchorSlot = LIVE_FIELD_SLOT_ORDER.includes(anchorRaw as FieldSlotId)
      ? (anchorRaw as FieldSlotId)
      : undefined;
    return {
      id: row.id,
      type: 'position_swap',
      timestamp: row.minute ?? 0,
      playerId: row.player_id ?? undefined,
      swapWithPlayerId: swapWith || undefined,
      fairPlayPositionSwap: fairPlayPositionSwap || undefined,
      fairPlayAnchorSlot: anchorSlot,
      createdAt,
    };
  }
  if (row.type === 'substitution') {
    const p = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
    const playerIn =
      typeof p.player_in_id === 'string' && p.player_in_id.trim().length > 0 ? p.player_in_id.trim() : '';
    return {
      id: row.id,
      type: 'substitution',
      timestamp: row.minute ?? 0,
      playerId: row.player_id ?? undefined,
      swapWithPlayerId: playerIn || undefined,
      createdAt,
    };
  }
  if (row.type === 'substitution_out') {
    return {
      id: row.id,
      type: 'sub_out',
      timestamp: row.minute ?? 0,
      playerId: row.player_id ?? undefined,
      createdAt,
    };
  }
  if (row.type === 'substitution_in') {
    return {
      id: row.id,
      type: 'sub_in',
      timestamp: row.minute ?? 0,
      playerId: row.player_id ?? undefined,
      createdAt,
    };
  }
  if (row.type === 'extra_player_on') {
    return {
      id: row.id,
      type: 'extra_player_on',
      timestamp: row.minute ?? 0,
      playerId: row.player_id ?? undefined,
      createdAt,
    };
  }
  if (row.type === 'extra_player_off') {
    const p = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
    const removedRaw =
      typeof p.removed_player_id === 'string' && p.removed_player_id.trim().length > 0
        ? p.removed_player_id.trim()
        : '';
    const extraId = String(row.player_id ?? '').trim();
    return {
      id: row.id,
      type: 'extra_player_off',
      timestamp: row.minute ?? 0,
      playerId: extraId || undefined,
      fairPlayRemovedPlayerId: removedRaw || extraId || undefined,
      createdAt,
    };
  }
  if (!ENGINE_TYPES.has(row.type as MatchEventType)) return null;
  return {
    id: row.id,
    type: row.type as MatchEventType,
    timestamp: row.minute ?? 0,
    playerId: row.player_id ?? undefined,
    createdAt,
  };
}

export type InsertMatchEventPayload = {
  match_id: string;
  type: string;
  minute: number;
  period?: number | null;
  player_id?: string | null;
  payload?: Record<string, unknown> | null;
};

export function engineEventToInsertPayload(
  matchId: string,
  ev: Omit<MatchEngineEvent, 'id'>,
  period?: number | null,
): InsertMatchEventPayload {
  const safeMinute = clampEffectiveMatchSeconds(ev.timestamp);

  if (ev.type === 'extra_player_on') {
    debugAssertMatchEventDbType('engineEventToInsertPayload', 'extra_player_on');
    return {
      match_id: matchId,
      type: 'extra_player_on',
      minute: safeMinute,
      period: period ?? null,
      player_id: ev.playerId ?? null,
      payload: null,
    };
  }
  if (ev.type === 'extra_player_off') {
    const extraId = String(ev.playerId ?? '').trim();
    const removedId = String(ev.fairPlayRemovedPlayerId ?? extraId).trim();
    debugAssertMatchEventDbType('engineEventToInsertPayload', 'extra_player_off');
    return {
      match_id: matchId,
      type: 'extra_player_off',
      minute: safeMinute,
      period: period ?? null,
      player_id: extraId || null,
      payload: { removed_player_id: removedId || null },
    };
  }

  if (ev.type === 'substitution') {
    const outId = String(ev.playerId ?? '').trim();
    const inId = String(ev.swapWithPlayerId ?? '').trim();
    debugAssertMatchEventDbType('engineEventToInsertPayload', 'substitution');
    return {
      match_id: matchId,
      type: 'substitution',
      minute: safeMinute,
      period: period ?? null,
      player_id: outId || null,
      payload: { player_in_id: inId || null },
    };
  }

  if (ev.type === 'position_swap') {
    debugAssertMatchEventDbType('engineEventToInsertPayload', 'position_swap');
    const payload: Record<string, unknown> = { swap_player_id: ev.swapWithPlayerId ?? null };
    if (ev.fairPlayPositionSwap) {
      payload.fair_play = true;
      if (ev.fairPlayAnchorSlot) payload.anchor_slot = ev.fairPlayAnchorSlot;
    }
    return {
      match_id: matchId,
      type: 'position_swap',
      minute: safeMinute,
      period: period ?? null,
      player_id: ev.playerId ?? null,
      payload,
    };
  }
  const dbType = ev.type === 'goal' ? 'goal' : ev.type === 'goal_away' ? 'goal_away' : (ev.type as string);
  debugAssertMatchEventDbType('engineEventToInsertPayload', dbType);
  const base: InsertMatchEventPayload = {
    match_id: matchId,
    type: dbType,
    minute: safeMinute,
    period: period ?? null,
    player_id: ev.playerId ?? null,
  };
  return base;
}

/** `events.is_home` zum Match (Kalender); für Stadion Heim/Auswärts im Liveticker. */
export async function fetchEventIsHomeByMatchId(
  matchId: string,
): Promise<{ isHome: boolean | null; error: string | null }> {
  const { data, error } = await supabase
    .from('events')
    .select('is_home')
    .eq('match_id', matchId)
    .maybeSingle();

  if (error) return { isHome: null, error: error.message };
  const row = data as { is_home?: boolean | null } | null;
  if (!row || row.is_home == null) return { isHome: null, error: null };
  return { isHome: Boolean(row.is_home), error: null };
}

export async function fetchMatchById(matchId: string): Promise<{ data: LiveMatchRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, team_season_id, opponent, match_date, location, status, score_home, score_away, live_started_at, live_elapsed_seconds, live_is_running, live_period, period_scores, u11_formation_id, minimum_playtime_enabled, minimum_playtime_minutes, planned_match_minutes, auto_matchday_feed_enabled',
    )
    .eq('id', matchId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: (data as LiveMatchRow) ?? null, error: null };
}

/** Erstes laufendes Spiel (Status wie im Rest der App: `live`). */
export async function fetchFirstLiveMatch(): Promise<{ data: LiveMatchRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, team_season_id, opponent, match_date, location, status, score_home, score_away, live_started_at, live_elapsed_seconds, live_is_running, live_period, period_scores, u11_formation_id, minimum_playtime_enabled, minimum_playtime_minutes, planned_match_minutes',
    )
    .eq('status', 'live')
    .order('match_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: (data as LiveMatchRow) ?? null, error: null };
}

export async function fetchMatchEvents(matchId: string): Promise<{ data: MatchEngineEvent[]; error: string | null }> {
  const { data, error } = await supabase
    .from('match_events')
    .select('id, match_id, type, minute, period, player_id, created_at, payload')
    .eq('match_id', matchId)
    .order('minute', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });

  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as MatchEventDbRow[];
  const events: MatchEngineEvent[] = [];
  for (const r of rows) {
    const ev = matchEventDbRowToEngine(r);
    if (ev) events.push(ev);
  }
  return { data: events, error: null };
}

export type LineupLoadResult = {
  startingPlayerIds: string[];
  squadPlayerIds: string[];
  /** Reihenfolge aus `match_bench` (nur für UI-Sortierung). */
  savedBenchPlayerIds: string[];
};

/** Entfernt Spieler aus Startelf, die nicht im Matchkader sind (Vorbereitung vor Anpfiff). */
export function sanitizeLineupToMatchSquad(
  startingPlayerIds: readonly (string | null | undefined)[],
  squadPlayerIds: readonly string[],
): LineupLoadResult {
  const normalizeId = (raw: string | null | undefined): string | null => {
    const v = String(raw ?? '').trim();
    return v.length > 0 ? v : null;
  };

  const cleanSquad = [
    ...new Set(squadPlayerIds.map(normalizeId).filter((id): id is string => Boolean(id))),
  ];
  const squadSet = new Set(cleanSquad);
  const seenOnField = new Set<string>();

  const starters = LIVE_FIELD_SLOT_ORDER.map((_, i) => {
    const pid = normalizeId(startingPlayerIds[i]);
    if (!pid || !squadSet.has(pid) || seenOnField.has(pid)) return '';
    seenOnField.add(pid);
    return pid;
  });

  const fieldSet = new Set(starters.filter((id) => id.length > 0));
  const savedBenchPlayerIds = cleanSquad.filter((id) => !fieldSet.has(id));
  return { startingPlayerIds: starters, squadPlayerIds: cleanSquad, savedBenchPlayerIds };
}

export async function fetchLineupForLiveMatch(matchId: string): Promise<{ data: LineupLoadResult; error: string | null }> {
  const [lineupRes, benchRes] = await Promise.all([
    supabase.from('match_lineup').select('player_id, slot').eq('match_id', matchId),
    supabase.from('match_bench').select('player_id').eq('match_id', matchId),
  ]);

  if (lineupRes.error) {
    return { data: { startingPlayerIds: [], squadPlayerIds: [], savedBenchPlayerIds: [] }, error: lineupRes.error.message };
  }
  if (benchRes.error) {
    return { data: { startingPlayerIds: [], squadPlayerIds: [], savedBenchPlayerIds: [] }, error: benchRes.error.message };
  }

  const lineupRows = (lineupRes.data ?? []) as { player_id: string | null; slot?: string | null }[];
  const benchRows = (benchRes.data ?? []) as { player_id: string | null }[];

  /** Pro Slot höchstens ein Spieler; doppelte `player_id` über mehrere Slots → erster Slot in Reihenfolge gewinnt. */
  const bySlot: Partial<Record<FieldSlotId, string>> = {};
  for (const row of lineupRows) {
    const slotRaw = String(row.slot ?? '').trim().toUpperCase();
    const slot = slotRaw as FieldSlotId;
    const pid = typeof row.player_id === 'string' && row.player_id.length > 0 ? row.player_id.trim() : '';
    if (!pid || LIVE_FIELD_SLOT_ORDER.indexOf(slot) === -1) continue;
    bySlot[slot] = pid;
  }
  const seenOnField = new Set<string>();
  const slotOccupants: Record<FieldSlotId, string | null> = {} as Record<FieldSlotId, string | null>;
  for (const s of LIVE_FIELD_SLOT_ORDER) {
    const pid = bySlot[s]?.trim() ?? '';
    if (!pid) {
      slotOccupants[s] = null;
      continue;
    }
    if (seenOnField.has(pid)) {
      slotOccupants[s] = null;
    } else {
      seenOnField.add(pid);
      slotOccupants[s] = pid;
    }
  }
  const startingPlayerIds = LIVE_FIELD_SLOT_ORDER.map((s) => slotOccupants[s] ?? '');

  const fieldIds = startingPlayerIds
    .map((id) => String(id ?? '').trim())
    .filter((id) => id.length > 0);
  const startingSet = new Set(fieldIds);
  const savedBenchPlayerIds = benchRows
    .map((r) => (typeof r.player_id === 'string' ? r.player_id.trim() : ''))
    .filter((id) => id.length > 0)
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .filter((id) => !startingSet.has(id));
  const squadPlayerIds = [...new Set([...fieldIds, ...savedBenchPlayerIds])];

  return { data: { startingPlayerIds, squadPlayerIds, savedBenchPlayerIds }, error: null };
}

/** Aktuelle `match_bench`-IDs (für Formationwechsel-Kader-Union). */
export async function fetchMatchBenchPlayerIds(matchId: string): Promise<string[]> {
  const mid = matchId?.trim();
  if (!mid) return [];
  const { data, error } = await supabase.from('match_bench').select('player_id').eq('match_id', mid);
  if (error) return [];
  return (data ?? [])
    .map((r) => (typeof r.player_id === 'string' ? r.player_id.trim() : ''))
    .filter((id) => id.length > 0);
}

export type ReplaceLineupBenchOptions = {
  /** Explizite Bank; Kader = Union(squad, bench, Feld) — nie verkleinern. */
  benchPlayerIds?: readonly string[];
  /** Live/nach Anpfiff: explizite benchPlayerIds Pflicht. */
  livePersist?: boolean;
};

/** Vollständiger Match-Kader für Persistenz — ohne slice/Shrink. */
export function resolveMatchSquadForLineupPersist(params: {
  squadPlayerIds: readonly string[];
  savedBenchPlayerIds?: readonly string[];
  dbBenchPlayerIds?: readonly string[];
  fieldPlayerIds: readonly string[];
  kickoffStartingPlayerIds?: readonly string[];
  events?: readonly MatchEngineEvent[];
}): { squadPlayerIds: string[]; benchPlayerIds: string[] } {
  const squadPlayerIds = collectMatchSquadPlayerIdsUnion({
    seedIds: [
      ...params.squadPlayerIds,
      ...(params.savedBenchPlayerIds ?? []),
      ...(params.dbBenchPlayerIds ?? []),
      ...params.fieldPlayerIds,
    ],
    kickoffStartingPlayerIds: params.kickoffStartingPlayerIds
      ? [...params.kickoffStartingPlayerIds]
      : undefined,
    events: params.events ? [...params.events] : undefined,
  });
  const benchPlayerIds = getBenchPlayers(
    squadPlayerIds,
    params.fieldPlayerIds,
    params.savedBenchPlayerIds?.length
      ? params.savedBenchPlayerIds
      : params.dbBenchPlayerIds,
  );
  return { squadPlayerIds, benchPlayerIds };
}

export type CreateSafeLineupPersistPayloadParams = {
  reason: LineupPersistReason;
  slots: Record<FieldSlotId, string | null> | readonly (string | null | undefined)[];
  beforeFieldIds?: readonly string[];
  beforeBenchIds?: readonly string[];
  squadPlayerIds?: readonly string[];
  savedBenchPlayerIds?: readonly string[];
  dbBenchPlayerIds?: readonly string[];
  kickoffStartingPlayerIds?: readonly string[];
  events?: readonly MatchEngineEvent[];
};

/** Zentrale Kader-/Bank-Berechnung vor jedem Live-Persist. */
export function createSafeLineupPersistPayload(
  params: CreateSafeLineupPersistPayloadParams,
): SafeLineupPersistPayload {
  const startingPlayerIds = Array.isArray(params.slots)
    ? LIVE_FIELD_SLOT_ORDER.map((_, i) => String(params.slots[i] ?? '').trim())
    : fieldSlotMapToStartingIds(params.slots);
  const afterFieldIds = startingPlayerIds.filter((id) => id.length > 0);

  const preferredBench = [
    ...new Set(
      [...(params.savedBenchPlayerIds ?? []), ...(params.beforeBenchIds ?? []), ...(params.dbBenchPlayerIds ?? [])]
        .map((id) => String(id ?? '').trim())
        .filter(Boolean),
    ),
  ];

  const { squadPlayerIds, benchPlayerIds: afterBenchIds } = resolveMatchSquadForLineupPersist({
    squadPlayerIds: params.squadPlayerIds ?? [],
    savedBenchPlayerIds: preferredBench,
    dbBenchPlayerIds: params.dbBenchPlayerIds,
    fieldPlayerIds: afterFieldIds,
    kickoffStartingPlayerIds: params.kickoffStartingPlayerIds,
    events: params.events,
  });

  const beforeFieldIds = (params.beforeFieldIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean);
  const beforeBenchIds = (params.beforeBenchIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean);
  const beforeUnion = new Set([...beforeFieldIds, ...beforeBenchIds]);
  const afterUnion = new Set([...afterFieldIds, ...afterBenchIds]);
  const removedIds = [...beforeUnion].filter((pid) => !afterUnion.has(pid));

  console.log('[lineup-persist]', {
    reason: params.reason,
    beforeFieldIds,
    beforeBenchIds,
    afterFieldIds,
    afterBenchIds,
    removedIds,
    fullSquadIds: squadPlayerIds,
  });

  return {
    startingPlayerIds,
    fieldPlayerIds: afterFieldIds,
    squadPlayerIds,
    benchPlayerIds: afterBenchIds,
    removedIds,
    ok: beforeUnion.size === 0 || removedIds.length === 0,
  };
}

/** Live-Persist mit vollständigem Kader, expliziter Bank und removedIds-Guard. */
export async function persistLiveLineupAndBenchSafe(params: {
  matchId: string;
  reason: LineupPersistReason;
  slots: Record<FieldSlotId, string | null> | readonly (string | null | undefined)[];
  beforeFieldIds: readonly string[];
  beforeBenchIds: readonly string[];
  squadPlayerIds?: readonly string[];
  savedBenchPlayerIds?: readonly string[];
  kickoffStartingPlayerIds?: readonly string[];
  events?: readonly MatchEngineEvent[];
}): Promise<{ error: string | null; payload: SafeLineupPersistPayload | null }> {
  const mid = params.matchId?.trim();
  if (!mid) return { error: 'Kein Match.', payload: null };

  lineupPersistInProgress.current = true;
  try {
    const dbBenchIds = await fetchMatchBenchPlayerIds(mid);
    const payload = createSafeLineupPersistPayload({
      reason: params.reason,
      slots: params.slots,
      beforeFieldIds: params.beforeFieldIds,
      beforeBenchIds: params.beforeBenchIds,
      squadPlayerIds: params.squadPlayerIds,
      savedBenchPlayerIds: params.savedBenchPlayerIds,
      dbBenchPlayerIds: dbBenchIds,
      kickoffStartingPlayerIds: params.kickoffStartingPlayerIds,
      events: params.events,
    });

    if (!payload.ok) {
      console.warn('[lineup-persist] Speichern abgebrochen — Kader würde schrumpfen', {
        reason: params.reason,
        removedIds: payload.removedIds,
      });
      return {
        error: 'Aufstellung konnte nicht gespeichert werden: Bank/Kader wäre unvollständig.',
        payload,
      };
    }

    const { error } = await replaceMatchLineupAndBench(
      mid,
      payload.startingPlayerIds,
      payload.squadPlayerIds,
      { benchPlayerIds: payload.benchPlayerIds, livePersist: true },
    );
    return { error, payload };
  } finally {
    lineupPersistInProgress.current = false;
  }
}

/** Kickoff-Snapshot (`match_lineup_snapshots.snapshot_type = kickoff`) → 7er-Array in Slot-Reihenfolge; fehlt → `null`. */
export async function fetchKickoffLineupPlayerIds(matchId: string): Promise<string[] | null> {
  const mid = matchId?.trim();
  if (!mid) return null;

  const { data, error } = await supabase
    .from('match_lineup_snapshots')
    .select('player_id, slot')
    .eq('match_id', mid)
    .eq('snapshot_type', 'kickoff');

  if (error) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[liveMatchService] fetchKickoffLineupPlayerIds', error.message);
    }
    return null;
  }

  const rows = (data ?? []) as { player_id: string | null; slot?: string | null }[];
  if (rows.length === 0) return null;

  const bySlot: Partial<Record<FieldSlotId, string>> = {};
  for (const row of rows) {
    const slotRaw = String(row.slot ?? '').trim().toUpperCase();
    const slot = slotRaw as FieldSlotId;
    const pid = typeof row.player_id === 'string' && row.player_id.length > 0 ? row.player_id.trim() : '';
    if (!pid || LIVE_FIELD_SLOT_ORDER.indexOf(slot) === -1) continue;
    if (bySlot[slot] == null) bySlot[slot] = pid;
  }
  const seenOnField = new Set<string>();
  const slotOccupants: Record<FieldSlotId, string | null> = {} as Record<FieldSlotId, string | null>;
  for (const s of LIVE_FIELD_SLOT_ORDER) {
    const pid = bySlot[s]?.trim() ?? '';
    if (!pid) {
      slotOccupants[s] = null;
      continue;
    }
    if (seenOnField.has(pid)) {
      slotOccupants[s] = null;
    } else {
      seenOnField.add(pid);
      slotOccupants[s] = pid;
    }
  }
  return LIVE_FIELD_SLOT_ORDER.map((s) => slotOccupants[s] ?? '');
}

export async function saveMatchEvent(payload: InsertMatchEventPayload): Promise<{ id: string | null; error: string | null }> {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    const t = String(payload.type ?? '').trim().toLowerCase();
    if (t === 'goal_home') {
      console.error('[match_events] saveMatchEvent: goal_home darf nicht in die DB', payload);
    }
  }
  const { data, error } = await supabase.from('match_events').insert(payload).select('id').single();
  if (error) {
    console.error('[liveMatchService] saveMatchEvent', error);
    return { id: null, error: error.message };
  }
  const id = (data as { id?: string } | null)?.id ?? null;
  return { id, error: null };
}

export async function deleteMatchEventById(eventId: string): Promise<{ error: string | null }> {
  if (!eventId?.trim()) return { error: 'Keine Ereignis-ID.' };
  const { error } = await supabase.from('match_events').delete().eq('id', eventId.trim());
  if (error) {
    console.error('[liveMatchService] deleteMatchEventById', error);
    return { error: error.message };
  }
  return { error: null };
}

export async function saveMatchEvents(
  payloads: InsertMatchEventPayload[],
): Promise<{ ids: string[]; error: string | null }> {
  if (payloads.length === 0) return { ids: [], error: null };
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    for (const p of payloads) {
      if (String(p.type ?? '').trim().toLowerCase() === 'goal_home') {
        console.error('[match_events] saveMatchEvents: goal_home darf nicht in die DB', p);
      }
    }
  }
  const { data, error } = await supabase.from('match_events').insert(payloads).select('id');
  if (error) {
    console.error('[liveMatchService] saveMatchEvents', error);
    return { ids: [], error: error.message };
  }
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  return { ids, error: null };
}

export async function updateMatchRow(
  matchId: string,
  patch: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('matches').update(patch).eq('id', matchId);
  if (error) {
    console.error('[liveMatchService] updateMatchRow', error);
    return { error: error.message };
  }
  return { error: null };
}

/** Match anlegen oder aktualisieren (nur Kernfelder fürs Setup). */
export async function upsertMatchForSetup(params: {
  matchId: string | null;
  teamSeasonId: string;
  opponent: string;
  matchDate: string;
  matchTime: string;
  locationNote: string;
}): Promise<{ matchId: string | null; error: string | null }> {
  const { matchId, teamSeasonId, opponent, matchDate, matchTime, locationNote } = params;

  let matchDateIso: string | null = null;
  if (matchDate && matchTime) {
    const d = new Date(`${matchDate}T${matchTime}:00`);
    if (!Number.isNaN(d.getTime())) matchDateIso = d.toISOString();
  } else if (matchDate) {
    const d = new Date(`${matchDate}T12:00:00`);
    if (!Number.isNaN(d.getTime())) matchDateIso = d.toISOString();
  }

  const base = {
    team_season_id: teamSeasonId,
    opponent: opponent.trim() || null,
    match_date: matchDateIso,
    location: locationNote.trim() || null,
  };

  if (matchId) {
    const { error } = await supabase.from('matches').update(base).eq('id', matchId);
    if (error) return { matchId: null, error: error.message };
    return { matchId, error: null };
  }

  const { data, error } = await supabase
    .from('matches')
    .insert({ ...base, status: 'upcoming' })
    .select('id')
    .single();

  if (error) return { matchId: null, error: error.message };
  const id = (data as { id?: string } | null)?.id ?? null;
  return { matchId: id, error: null };
}

/**
 * Match-Kader speichern. Startelf-Slots bleiben nur für Spieler im Kader belegt;
 * entfernte Spieler werden aus Aufstellung und Bank entfernt.
 */
export async function saveMatchSquadOnly(
  matchId: string,
  squadPlayerIds: string[],
): Promise<{ error: string | null }> {
  const uniqueSquad = [...new Set(squadPlayerIds.map((id) => String(id ?? '').trim()).filter(Boolean))];

  const { data: lineupRows, error: lineupErr } = await supabase
    .from('match_lineup')
    .select('slot, player_id')
    .eq('match_id', matchId);

  if (lineupErr) return { error: lineupErr.message };

  const squadSet = new Set(uniqueSquad);
  const bySlot: Partial<Record<FieldSlotId, string>> = {};
  for (const row of (lineupRows ?? []) as { slot?: string | null; player_id?: string | null }[]) {
    const slotRaw = String(row.slot ?? '').trim().toUpperCase();
    const slot = slotRaw as FieldSlotId;
    const pid = String(row.player_id ?? '').trim();
    if (!pid || LIVE_FIELD_SLOT_ORDER.indexOf(slot) === -1) continue;
    if (squadSet.has(pid)) bySlot[slot] = pid;
  }

  const startingPlayerIds = LIVE_FIELD_SLOT_ORDER.map((s) => bySlot[s] ?? '');
  return replaceMatchLineupAndBench(matchId, startingPlayerIds, uniqueSquad);
}

/** Lineup + Bank komplett ersetzen (Feld-Slots + Bank). */
export async function replaceMatchLineupAndBench(
  matchId: string,
  startingPlayerIds: Array<string | null | undefined>,
  squadPlayerIds: string[],
  options?: ReplaceLineupBenchOptions,
): Promise<{ error: string | null }> {
  const normalizeId = (raw: string | null | undefined): string | null => {
    const v = String(raw ?? '').trim();
    return v.length > 0 ? v : null;
  };

  const starters = LIVE_FIELD_SLOT_ORDER.map((_, i) => normalizeId(startingPlayerIds[i]));
  const lineup = starters.filter((id): id is string => Boolean(id));
  const lineupSet = new Set(lineup);
  const kader = [...new Set(squadPlayerIds.map((id) => normalizeId(id)).filter((id): id is string => Boolean(id)))];
  const explicitBench = (options?.benchPlayerIds ?? [])
    .map((id) => normalizeId(id))
    .filter((id): id is string => Boolean(id))
    .filter((id) => !lineupSet.has(id));
  const fullSquad = [...new Set([...kader, ...lineup, ...explicitBench])];
  const benchIds =
    explicitBench.length > 0
      ? [...new Set(explicitBench)]
      : fullSquad.filter((id) => !lineupSet.has(id));

  if (options?.livePersist && options.benchPlayerIds === undefined) {
    console.error('[replaceMatchLineupAndBench] livePersist ohne benchPlayerIds');
    return { error: 'Live-Persistenz erfordert explizite benchPlayerIds.' };
  }

  const lineupRows = LIVE_FIELD_SLOT_ORDER
    .map((slot, i) => {
      const playerId = starters[i];
      if (!playerId) return null;
      return {
        match_id: matchId,
        slot,
        player_id: playerId,
      };
    })
    .filter((row): row is { match_id: string; slot: FieldSlotId; player_id: string } => row !== null);
  console.log('[replaceMatchLineupAndBench][LINEUP_ROWS]', lineupRows);

  console.log('[replaceMatchLineupAndBench][input]', {
    matchId,
    startingPlayerIds,
    squadPlayerIds,
  });

  console.log('[replaceMatchLineupAndBench][derived]', {
    starters,
    lineupRows,
    benchIds,
  });

  const delLineup = await supabase.from('match_lineup').delete().eq('match_id', matchId);
  if (delLineup.error) return { error: delLineup.error.message };

  const delBench = await supabase.from('match_bench').delete().eq('match_id', matchId);
  if (delBench.error) return { error: delBench.error.message };

  console.log('[replaceMatchLineupAndBench][INPUT]', {
    matchId,
    starters,
    benchIds,
    fullSquadSize: fullSquad.length,
  });

  // Bank zuerst: Realtime auf match_lineup darf nie eine leere Bank lesen (Repair-Race).
  if (benchIds.length > 0) {
    const benchRows = benchIds.map((player_id) => ({ match_id: matchId, player_id }));
    const insBench = await supabase.from('match_bench').insert(benchRows);
    if (insBench.error) {
      console.error('[liveMatchService] replaceMatchLineupAndBench match_bench', insBench.error);
      return { error: insBench.error.message };
    }
  }
  console.log('[replaceMatchLineupAndBench][insert-bench-result]', {
    benchIdsCount: benchIds.length,
  });

  const insLineup = await supabase.from('match_lineup').insert(lineupRows);
  console.log('[replaceMatchLineupAndBench][insert-lineup-result]', {
    error: insLineup.error ?? null,
    lineupRowsCount: lineupRows.length,
  });
  console.log('[replaceMatchLineupAndBench][insert-lineup-error-detail]', {
    message: insLineup.error?.message ?? null,
    details: insLineup.error?.details ?? null,
    hint: insLineup.error?.hint ?? null,
    code: insLineup.error?.code ?? null,
  });
  if (insLineup.error) {
    console.error('[liveMatchService] replaceMatchLineupAndBench match_lineup', insLineup.error);
    return { error: insLineup.error.message };
  }

  return { error: null };
}

/**
 * Nur Slot-Tausch am laufenden Spiel: `match_lineup` ersetzen + ein `position_swap`-Event.
 * Kein persistSubstitution / keine sub_out/sub_in-Events.
 */
export async function persistPositionSwap(params: {
  matchId: string;
  slotA: FieldSlotId;
  slotB: FieldSlotId;
  currentSlots: Record<FieldSlotId, string | null>;
  squadPlayerIds: string[];
  beforeFieldIds: readonly string[];
  beforeBenchIds: readonly string[];
  savedBenchPlayerIds?: readonly string[];
  kickoffStartingPlayerIds?: readonly string[];
  events?: readonly MatchEngineEvent[];
  timestamp: number;
  period: number | null;
}): Promise<{ error: string | null; eventId: string | null }> {
  const mid = params.matchId?.trim();
  if (!mid) return { error: 'Kein Match.', eventId: null };
  const swapped = swapTwoOccupiedFieldSlots(params.currentSlots, params.slotA, params.slotB);
  if (!swapped) return { error: 'Positionswechsel nicht möglich.', eventId: null };

  const lineupRes = await persistLiveLineupAndBenchSafe({
    matchId: mid,
    reason: 'position_swap',
    slots: swapped,
    beforeFieldIds: params.beforeFieldIds,
    beforeBenchIds: params.beforeBenchIds,
    squadPlayerIds: params.squadPlayerIds,
    savedBenchPlayerIds: params.savedBenchPlayerIds,
    kickoffStartingPlayerIds: params.kickoffStartingPlayerIds,
    events: params.events,
  });
  if (lineupRes.error) return { error: lineupRes.error, eventId: null };

  const pidA = String(params.currentSlots[params.slotA] ?? '').trim();
  const pidB = String(params.currentSlots[params.slotB] ?? '').trim();
  const { id, error } = await saveMatchEvent({
    match_id: mid,
    type: 'position_swap',
    minute: clampEffectiveMatchSeconds(params.timestamp),
    period: params.period ?? null,
    player_id: pidA || null,
    payload: { swap_player_id: pidB || null },
  });
  return { error: error ?? null, eventId: id };
}

/**
 * FairPlay-Positionswechsel: nur Event (Ticker), kein `match_lineup` / `match_bench`-Update.
 */
export async function persistFairPlayPositionSwap(params: {
  matchId: string;
  extraPlayerId: string;
  slot: FieldSlotId;
  slotPlayerId: string;
  timestamp: number;
  period: number | null;
}): Promise<{ error: string | null; eventId: string | null }> {
  const mid = params.matchId?.trim();
  const extraId = String(params.extraPlayerId ?? '').trim();
  const slotPlayerId = String(params.slotPlayerId ?? '').trim();
  const slot = params.slot;
  if (!mid || !extraId || !slotPlayerId || LIVE_FIELD_SLOT_ORDER.indexOf(slot) === -1) {
    return { error: 'Ungültige Eingabe.', eventId: null };
  }
  const payload = engineEventToInsertPayload(
    mid,
    {
      type: 'position_swap',
      timestamp: clampEffectiveMatchSeconds(params.timestamp),
      playerId: extraId,
      swapWithPlayerId: slotPlayerId,
      fairPlayPositionSwap: true,
      fairPlayAnchorSlot: slot,
    },
    params.period,
  );
  const { id, error } = await saveMatchEvent(payload);
  return { error: error ?? null, eventId: id };
}

/**
 * FairPlay-Zusatzspieler: Event + `match_lineup` (FP-Slot) + Bank bereinigen.
 */
export async function persistExtraPlayerOn(params: {
  matchId: string;
  playerId: string;
  currentMatchSeconds: number;
  period: number | null;
  currentSlots: Record<FieldSlotId, string | null>;
  squadPlayerIds: string[];
  beforeFieldIds: readonly string[];
  beforeBenchIds: readonly string[];
  savedBenchPlayerIds?: readonly string[];
  kickoffStartingPlayerIds?: readonly string[];
  events?: readonly MatchEngineEvent[];
}): Promise<{ error: string | null; eventId: string | null; startingPlayerIds?: string[] }> {
  const mid = params.matchId?.trim();
  const pid = String(params.playerId ?? '').trim();
  if (!mid || !pid) return { error: 'Ungültige Eingabe.', eventId: null };

  const nextSlots = applyExtraPlayerOnToSlots(params.currentSlots, pid);

  const payload = engineEventToInsertPayload(
    mid,
    {
      type: 'extra_player_on',
      timestamp: clampEffectiveMatchSeconds(params.currentMatchSeconds),
      playerId: pid,
    },
    params.period,
  );
  const { id, error } = await saveMatchEvent(payload);
  if (error || !id) return { error: error ?? 'Ereignis konnte nicht gespeichert werden.', eventId: null };

  const lineupRes = await persistLiveLineupAndBenchSafe({
    matchId: mid,
    reason: 'extra_player_on',
    slots: nextSlots,
    beforeFieldIds: params.beforeFieldIds,
    beforeBenchIds: params.beforeBenchIds,
    squadPlayerIds: [...new Set([...params.squadPlayerIds, pid])],
    savedBenchPlayerIds: params.savedBenchPlayerIds,
    kickoffStartingPlayerIds: params.kickoffStartingPlayerIds,
    events: params.events,
  });
  if (lineupRes.error) {
    await deleteMatchEventById(id);
    return { error: lineupRes.error, eventId: null };
  }

  return {
    error: null,
    eventId: id,
    startingPlayerIds: lineupRes.payload?.startingPlayerIds,
  };
}

/**
 * FairPlay beenden: `player_id` = Zusatzspieler-Session, `payload.removed_player_id` = Feld verlässt.
 * Wenn removed === extra → Zusatzspieler auf Bank; sonst gewählter Spieler auf Bank, Extra übernimmt Slot.
 */
export async function persistExtraPlayerOff(params: {
  matchId: string;
  /** Ursprünglicher FairPlay-Zusatzspieler (Event player_id). */
  extraPlayerId: string;
  /** Spieler, der das Feld verlässt. */
  removedPlayerId: string;
  currentMatchSeconds: number;
  period: number | null;
  /** Aktuelle Slot-Belegung (7er), wenn ein anderer Feldspieler rausgeht. */
  currentStartingPlayerIds?: string[];
  squadPlayerIds?: string[];
  beforeFieldIds?: readonly string[];
  beforeBenchIds?: readonly string[];
  savedBenchPlayerIds?: readonly string[];
  kickoffStartingPlayerIds?: readonly string[];
  events?: readonly MatchEngineEvent[];
}): Promise<{ error: string | null; eventId: string | null; startingPlayerIds?: string[] }> {
  const mid = params.matchId?.trim();
  const extraId = String(params.extraPlayerId ?? '').trim();
  const removedId = String(params.removedPlayerId ?? '').trim();
  if (!mid || !extraId || !removedId) return { error: 'Ungültige Eingabe.', eventId: null };

  const ts = clampEffectiveMatchSeconds(params.currentMatchSeconds);
  const { id, error } = await saveMatchEvent({
    match_id: mid,
    type: 'extra_player_off',
    minute: ts,
    period: params.period ?? null,
    player_id: extraId,
    payload: { removed_player_id: removedId },
  });
  if (error || !id) return { error: error ?? 'Ereignis konnte nicht gespeichert werden.', eventId: null };

  const squad = params.squadPlayerIds ?? [];
  const baseSlots = params.currentStartingPlayerIds?.length
    ? startingLineupToSlotMap(params.currentStartingPlayerIds)
    : ({} as Record<FieldSlotId, string | null>);

  const beforeFieldIds = params.beforeFieldIds ?? getOnFieldIdsInSlotOrder(baseSlots);
  const beforeBenchIds = params.beforeBenchIds ?? [];

  if (removedId === extraId) {
    const nextSlots = applyExtraPlayerOffToSlots(baseSlots, removedId, extraId);
    const lineupRes = await persistLiveLineupAndBenchSafe({
      matchId: mid,
      reason: 'extra_player_off',
      slots: nextSlots,
      beforeFieldIds,
      beforeBenchIds,
      squadPlayerIds: squad.length ? squad : [extraId],
      savedBenchPlayerIds: params.savedBenchPlayerIds,
      kickoffStartingPlayerIds: params.kickoffStartingPlayerIds,
      events: params.events,
    });
    if (lineupRes.error) return { error: lineupRes.error, eventId: id };
    return { error: null, eventId: id, startingPlayerIds: lineupRes.payload?.startingPlayerIds };
  }

  if (!params.currentStartingPlayerIds?.length) {
    return { error: 'Aufstellung fehlt für Feldwechsel.', eventId: id };
  }

  const slots = applyExtraPlayerOffToSlots(baseSlots, removedId, extraId);
  const deduped = dedupeFieldSlotMap(slots);
  if (!getOnFieldIdsInSlotOrder(deduped).includes(extraId)) {
    return { error: 'Gewählter Spieler nicht auf dem Feld gefunden.', eventId: id };
  }
  const lineupRes = await persistLiveLineupAndBenchSafe({
    matchId: mid,
    reason: 'extra_player_off',
    slots: deduped,
    beforeFieldIds,
    beforeBenchIds,
    squadPlayerIds: squad,
    savedBenchPlayerIds: params.savedBenchPlayerIds,
    kickoffStartingPlayerIds: params.kickoffStartingPlayerIds,
    events: params.events,
  });
  if (lineupRes.error) return { error: lineupRes.error, eventId: id };

  return { error: null, eventId: id, startingPlayerIds: lineupRes.payload?.startingPlayerIds };
}

/** FairPlay-Session auf neuen Zusatzspieler übertragen (nach normalem Wechsel auf FP-Slot). */
export async function persistFairPlayExtraSessionTransfer(params: {
  matchId: string;
  oldExtraPlayerId: string;
  newExtraPlayerId: string;
  currentMatchSeconds: number;
  period: number | null;
}): Promise<{ error: string | null }> {
  const mid = params.matchId?.trim();
  const oldId = String(params.oldExtraPlayerId ?? '').trim();
  const newId = String(params.newExtraPlayerId ?? '').trim();
  if (!mid || !oldId || !newId || oldId === newId) {
    return { error: 'Ungültige FairPlay-Übertragung.' };
  }

  const ts = clampEffectiveMatchSeconds(params.currentMatchSeconds);
  const offPayload = engineEventToInsertPayload(
    mid,
    {
      type: 'extra_player_off',
      timestamp: ts,
      playerId: oldId,
      fairPlayRemovedPlayerId: oldId,
    },
    params.period,
  );
  const { id: offId, error: offErr } = await saveMatchEvent(offPayload);
  if (offErr || !offId) return { error: offErr ?? 'FairPlay-Ende konnte nicht gespeichert werden.' };

  const onPayload = engineEventToInsertPayload(
    mid,
    {
      type: 'extra_player_on',
      timestamp: ts,
      playerId: newId,
    },
    params.period,
  );
  const { id: onId, error: onErr } = await saveMatchEvent(onPayload);
  if (onErr || !onId) {
    await deleteMatchEventById(offId);
    return { error: onErr ?? 'FairPlay-Start konnte nicht gespeichert werden.' };
  }

  return { error: null };
}

export type LiveLineupRepairResult = {
  inconsistent: boolean;
  repaired: boolean;
  error: string | null;
};

type RawLineupRow = { player_id: string | null; slot?: string | null };
type RawBenchRow = { player_id: string | null };

function normLineupPid(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim();
  return v.length > 0 ? v : null;
}

function normLineupSlot(raw: string | null | undefined): FieldSlotId | null {
  const s = String(raw ?? '').trim().toUpperCase() as FieldSlotId;
  return LIVE_FIELD_SLOT_ORDER.indexOf(s) >= 0 ? s : null;
}

/** Alle `player_id` aus Feld- und Bank-Rohzeilen (Match-Kader-Umfang). */
function collectSquadUnionFromRaw(lineupRows: RawLineupRow[], benchRows: RawBenchRow[]): string[] {
  const s = new Set<string>();
  for (const row of lineupRows) {
    const p = normLineupPid(row.player_id);
    if (p) s.add(p);
  }
  for (const row of benchRows) {
    const p = normLineupPid(row.player_id);
    if (p) s.add(p);
  }
  return [...s];
}

/** Vollständiger Match-Kader ohne Shrink: DB ∪ Kickoff ∪ Event-Teilnehmer. */
export function collectMatchSquadPlayerIdsUnion(params: {
  lineupRows?: RawLineupRow[];
  benchRows?: RawBenchRow[];
  kickoffStartingPlayerIds?: string[];
  events?: MatchEngineEvent[];
  seedIds?: string[];
}): string[] {
  const ids = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const id = normLineupPid(raw);
    if (id) ids.add(id);
  };

  for (const row of params.lineupRows ?? []) add(row.player_id);
  for (const row of params.benchRows ?? []) add(row.player_id);
  for (const id of params.kickoffStartingPlayerIds ?? []) add(id);
  for (const id of params.seedIds ?? []) add(id);

  for (const e of params.events ?? []) {
    add(e.playerId);
    add(e.swapWithPlayerId);
    if (e.type === 'extra_player_off') {
      add(fairPlayRemovedPlayerIdFromEvent(e));
      add(fairPlayExtraPlayerIdFromOffEvent(e));
    }
  }

  return [...ids];
}

/**
 * Bank-Warteschlange: zuerst Reihenfolge aus `match_bench`-Rohzeilen (ohne bereits auf dem Feld),
 * danach übrige Kader-IDs alphabetisch — deterministisch.
 */
function stableBenchQueue(fieldSet: Set<string>, benchRows: RawBenchRow[], sortedU: string[]): string[] {
  const q: string[] = [];
  const seen = new Set<string>();
  for (const row of benchRows) {
    const p = normLineupPid(row.player_id);
    if (!p || fieldSet.has(p) || seen.has(p)) continue;
    seen.add(p);
    q.push(p);
  }
  for (const id of sortedU) {
    if (!fieldSet.has(id) && !seen.has(id)) {
      seen.add(id);
      q.push(id);
    }
  }
  return q;
}

export type RepairLiveLineupOptions = {
  /** Leere Core-Slots aus Bank auffüllen — nur vor Spielstart. */
  allowBenchPromotion?: boolean;
};

/**
 * Repariertes 7er-Array + Kader aus Roh-DB: doppelte Feld-Slots bereinigt (erster Slot gewinnt),
 * optional leere Slots aus der Bank auffüllen (nur wenn `allowBenchPromotion`),
 * Kader = Union aller Roh-IDs; Bank = Kader minus Feld (Feld gewinnt bei Doppelbelegung).
 */
export function computeRepairedLiveLineupFromRaw(
  lineupRows: RawLineupRow[],
  benchRows: RawBenchRow[],
  options?: RepairLiveLineupOptions,
): { startingPlayerIds: string[]; squadPlayerIds: string[] } {
  const allowBenchPromotion = options?.allowBenchPromotion !== false;
  const U = [...collectSquadUnionFromRaw(lineupRows, benchRows)].sort((a, b) => a.localeCompare(b));

  const bySlot: Partial<Record<FieldSlotId, string>> = {};
  for (const row of lineupRows) {
    const slot = normLineupSlot(row.slot);
    const pid = normLineupPid(row.player_id);
    if (!slot || !pid) continue;
    if (bySlot[slot] == null) bySlot[slot] = pid;
  }
  const seenOnField = new Set<string>();
  const slotOccupants: Record<FieldSlotId, string | null> = {} as Record<FieldSlotId, string | null>;
  for (const s of LIVE_FIELD_SLOT_ORDER) {
    const pid = bySlot[s]?.trim() ?? '';
    if (!pid) {
      slotOccupants[s] = null;
      continue;
    }
    if (seenOnField.has(pid)) {
      slotOccupants[s] = null;
    } else {
      seenOnField.add(pid);
      slotOccupants[s] = pid;
    }
  }

  const slots = { ...slotOccupants } as Record<FieldSlotId, string | null>;
  const fieldSetNow = new Set(
    LIVE_FIELD_SLOT_ORDER.map((s) => normLineupPid(slots[s])).filter(Boolean) as string[],
  );
  const benchQueue = stableBenchQueue(fieldSetNow, benchRows, U);

  if (allowBenchPromotion) {
    for (const emptySlot of LIVE_FIELD_SLOT_ORDER) {
      if (emptySlot === 'FP') continue;
      if (normLineupPid(slots[emptySlot])) continue;
      const next = benchQueue.shift();
      if (!next) break;
      slots[emptySlot] = next;
      fieldSetNow.add(next);
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        const fieldAfter = LIVE_FIELD_SLOT_ORDER.map((s) => normLineupPid(slots[s]) ?? '').filter(Boolean);
        const benchAfter = [...benchQueue];
        console.debug('[liveMatchService] repair: leeren Feld-Slot aufgefüllt', {
          emptySlot,
          promotedPlayerId: next,
          promotedPlayerName: '',
          fieldAfter,
          benchAfter,
        });
      }
    }
  }

  const startingPlayerIds = LIVE_FIELD_SLOT_ORDER.map((s) => slots[s] ?? '');
  const fieldIds = LIVE_FIELD_SLOT_ORDER.map((s) => normLineupPid(slots[s])).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  const fieldSet = new Set(fieldIds);
  const benchOnly = U.filter((id) => !fieldSet.has(id)).sort((a, b) => a.localeCompare(b));
  const squadPlayerIds = [...new Set([...fieldIds, ...benchOnly])];

  return { startingPlayerIds, squadPlayerIds };
}

function snapshotRepairedLineupBench(startingPlayerIds: string[], squadPlayerIds: string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < LIVE_FIELD_SLOT_ORDER.length; i++) {
    const slot = LIVE_FIELD_SLOT_ORDER[i];
    const p = normLineupPid(startingPlayerIds[i]);
    if (p) parts.push(`${slot}:${p}`);
  }
  const onField = LIVE_FIELD_SLOT_ORDER.map((_, i) => normLineupPid(startingPlayerIds[i])).filter(
    Boolean,
  ) as string[];
  const bench = getBenchPlayers(squadPlayerIds, onField).sort((a, b) => a.localeCompare(b));
  for (const p of bench) parts.push(`B:${p}`);
  parts.sort();
  return parts.join('|');
}

function snapshotRawLineupBench(lineupRows: RawLineupRow[], benchRows: RawBenchRow[]): string {
  const parts: string[] = [];
  for (const row of lineupRows) {
    const slot = normLineupSlot(row.slot);
    const pid = normLineupPid(row.player_id);
    if (slot && pid) parts.push(`${slot}:${pid}`);
  }
  for (const row of benchRows) {
    const pid = normLineupPid(row.player_id);
    if (pid) parts.push(`B:${pid}`);
  }
  parts.sort();
  return parts.join('|');
}

export function liveLineupRawDiffersFromRepaired(
  lineupRows: RawLineupRow[],
  benchRows: RawBenchRow[],
  options?: RepairLiveLineupOptions,
): boolean {
  const { startingPlayerIds, squadPlayerIds } = computeRepairedLiveLineupFromRaw(lineupRows, benchRows, options);
  return snapshotRawLineupBench(lineupRows, benchRows) !== snapshotRepairedLineupBench(startingPlayerIds, squadPlayerIds);
}

function fieldIdsFromLineupRows(lineupRows: RawLineupRow[]): string[] {
  return LIVE_FIELD_SLOT_ORDER.map((s) => {
    const row = lineupRows.find((r) => normLineupSlot(r.slot) === s);
    return normLineupPid(row?.player_id ?? null);
  }).filter((id): id is string => Boolean(id));
}

function benchIdsFromBenchRows(benchRows: RawBenchRow[]): string[] {
  return benchRows.map((r) => normLineupPid(r.player_id)).filter((id): id is string => Boolean(id));
}

/**
 * Liest `match_lineup` + `match_bench`, vergleicht mit bereinigtem Soll-Zustand; bei Abweichung einmalig `replaceMatchLineupAndBench`.
 */
export type SyncLineupFromReplayResult = {
  error: string | null;
  startingPlayerIds: string[];
  squadPlayerIds: string[];
  orphanInIgnored: number;
  orphanOutIgnored: number;
};

/**
 * Endzustand Feld + Bank aus Kickoff + Events rekonstruieren und in DB schreiben.
 * Atomare `substitution` + defensiv gepaarte Legacy-Wechsel; keine halben Wechsel.
 */
export async function syncFinalLineupBenchFromEventReplay(params: {
  matchId: string;
  kickoffStartingPlayerIds: string[];
  squadPlayerIds: string[];
  events: MatchEngineEvent[];
  atMatchSecond?: number;
  beforeFieldIds?: readonly string[];
  beforeBenchIds?: readonly string[];
}): Promise<SyncLineupFromReplayResult> {
  const mid = params.matchId?.trim();
  if (!mid) {
    return { error: 'Kein Match.', startingPlayerIds: [], squadPlayerIds: [], orphanInIgnored: 0, orphanOutIgnored: 0 };
  }

  const atSec =
    params.atMatchSecond != null
      ? clampEffectiveMatchSeconds(params.atMatchSecond)
      : resolveReplayAtMatchSecond(params.events, 0);

  const kickoffBase = pickKickoffLineupBaseForReplay(params.kickoffStartingPlayerIds);
  const replay = replaySubstitutionEventsOnSlots(kickoffBase, params.events, atSec, {
    squadPlayerIds: params.squadPlayerIds,
  });

  const dbBenchIds = await fetchMatchBenchPlayerIds(mid);
  const payload = createSafeLineupPersistPayload({
    reason: 'replay_sync',
    slots: replay.slots,
    beforeFieldIds: params.beforeFieldIds ?? [],
    beforeBenchIds: params.beforeBenchIds ?? dbBenchIds,
    squadPlayerIds: params.squadPlayerIds,
    dbBenchPlayerIds: dbBenchIds,
    kickoffStartingPlayerIds: params.kickoffStartingPlayerIds,
    events: params.events,
  });

  if (!payload.ok) {
    console.warn('[lineup-persist] replay_sync abgebrochen — Kader würde schrumpfen', {
      removedIds: payload.removedIds,
    });
    return {
      error: 'Replay-Sync würde Kader verkleinern.',
      startingPlayerIds: payload.startingPlayerIds,
      squadPlayerIds: payload.squadPlayerIds,
      orphanInIgnored: replay.orphanInIgnored,
      orphanOutIgnored: replay.orphanOutIgnored,
    };
  }

  const { error } = await replaceMatchLineupAndBench(mid, payload.startingPlayerIds, payload.squadPlayerIds, {
    benchPlayerIds: payload.benchPlayerIds,
    livePersist: true,
  });
  return {
    error,
    startingPlayerIds: payload.startingPlayerIds,
    squadPlayerIds: payload.squadPlayerIds,
    orphanInIgnored: replay.orphanInIgnored,
    orphanOutIgnored: replay.orphanOutIgnored,
  };
}

export async function repairLiveMatchLineupBenchIfNeeded(matchId: string): Promise<LiveLineupRepairResult> {
  const mid = matchId?.trim();
  if (!mid) return { inconsistent: false, repaired: false, error: null };
  if (lineupPersistInProgress.current) {
    return { inconsistent: false, repaired: false, error: null };
  }

  const [lineupRes, benchRes, matchRes, evRes, kickoff] = await Promise.all([
    supabase.from('match_lineup').select('player_id, slot').eq('match_id', mid),
    supabase.from('match_bench').select('player_id').eq('match_id', mid),
    supabase.from('matches').select('status, live_elapsed_seconds').eq('id', mid).maybeSingle(),
    fetchMatchEvents(mid),
    fetchKickoffLineupPlayerIds(mid),
  ]);

  if (lineupRes.error) return { inconsistent: false, repaired: false, error: lineupRes.error.message };
  if (benchRes.error) return { inconsistent: false, repaired: false, error: benchRes.error.message };

  const lineupRows = (lineupRes.data ?? []) as RawLineupRow[];
  const benchRows = (benchRes.data ?? []) as RawBenchRow[];

  const matchStatus = (matchRes.data as { status?: string | null } | null)?.status ?? '';
  const hasKickoff = (kickoff ?? []).some((id) => String(id ?? '').trim().length > 0);
  const events = evRes.data ?? [];
  const elapsed = Number((matchRes.data as { live_elapsed_seconds?: number | null } | null)?.live_elapsed_seconds ?? 0);

  const squadUnion = collectMatchSquadPlayerIdsUnion({
    lineupRows,
    benchRows,
    kickoffStartingPlayerIds: kickoff ?? [],
    events,
  });

  const fieldRowCount = lineupRows.filter((r) => normLineupPid(r.player_id)).length;
  if (matchStatus === 'live' && benchRows.length === 0 && fieldRowCount >= 7) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.debug('[liveMatchService] repair: übersprungen (transiente leere Bank während Lineup-Schreiben)');
    }
    return { inconsistent: false, repaired: false, error: null };
  }

  const beforeFieldIds = fieldIdsFromLineupRows(lineupRows);
  const beforeBenchIds = benchIdsFromBenchRows(benchRows);
  const liveRepairOptions: RepairLiveLineupOptions = { allowBenchPromotion: false };

  if (hasKickoff && events.length > 0 && matchStatus === 'finished') {
    const atSec = resolveReplayAtMatchSecond(events, elapsed);
    const replayTarget = await syncFinalLineupBenchFromEventReplay({
      matchId: mid,
      kickoffStartingPlayerIds: kickoff!,
      squadPlayerIds: squadUnion,
      events,
      atMatchSecond: atSec,
      beforeFieldIds,
      beforeBenchIds,
    });
    if (replayTarget.error) return { inconsistent: true, repaired: false, error: replayTarget.error };
    const replaySnap = snapshotRepairedLineupBench(replayTarget.startingPlayerIds, replayTarget.squadPlayerIds);
    const rawSnap = snapshotRawLineupBench(lineupRows, benchRows);
    if (replaySnap === rawSnap) {
      return { inconsistent: false, repaired: false, error: null };
    }
    return { inconsistent: true, repaired: true, error: null };
  }

  if (!liveLineupRawDiffersFromRepaired(lineupRows, benchRows, liveRepairOptions)) {
    return { inconsistent: false, repaired: false, error: null };
  }

  const { startingPlayerIds } = computeRepairedLiveLineupFromRaw(lineupRows, benchRows, liveRepairOptions);
  const payload = createSafeLineupPersistPayload({
    reason: 'repair',
    slots: startingPlayerIds,
    beforeFieldIds,
    beforeBenchIds,
    squadPlayerIds: squadUnion,
    dbBenchPlayerIds: beforeBenchIds,
    kickoffStartingPlayerIds: kickoff ?? [],
    events,
  });
  if (!payload.ok) {
    console.warn('[liveMatchService] repair abgebrochen — Kader würde schrumpfen', {
      removedIds: payload.removedIds,
    });
    return { inconsistent: true, repaired: false, error: null };
  }

  const { error } = await replaceMatchLineupAndBench(mid, payload.startingPlayerIds, payload.squadPlayerIds, {
    benchPlayerIds: payload.benchPlayerIds,
    livePersist: matchStatus === 'live' || matchStatus === 'finished',
  });
  if (error) return { inconsistent: true, repaired: false, error };
  return { inconsistent: true, repaired: true, error: null };
}

const KICKOFF_LINEUP_SNAPSHOT_TYPE = 'kickoff';

/**
 * Speichert die aktuelle `match_lineup` einmalig als Kickoff-Snapshot (für Statistik/Minuten).
 * Wenn bereits Zeilen für dieses Match existieren: keine Änderung.
 */
export async function ensureKickoffLineupSnapshot(matchId: string): Promise<{ error: string | null }> {
  const mid = matchId?.trim();
  if (!mid) return { error: 'Keine Match-ID.' };

  const { count, error: countErr } = await supabase
    .from('match_lineup_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', mid)
    .eq('snapshot_type', KICKOFF_LINEUP_SNAPSHOT_TYPE);

  if (countErr) {
    console.error('[liveMatchService] ensureKickoffLineupSnapshot count', countErr);
    return { error: countErr.message };
  }
  if (count != null && count > 0) return { error: null };

  const { data: lineupRows, error: lineupErr } = await supabase
    .from('match_lineup')
    .select('player_id, slot')
    .eq('match_id', mid);

  if (lineupErr) {
    console.error('[liveMatchService] ensureKickoffLineupSnapshot match_lineup', lineupErr);
    return { error: lineupErr.message };
  }

  const rows = (lineupRows ?? [])
    .map((r: { player_id?: string | null; slot?: string | null }) => {
      const player_id = String(r.player_id ?? '').trim();
      const slot = String(r.slot ?? '').trim();
      if (!player_id || !slot) return null;
      return {
        match_id: mid,
        player_id,
        slot,
        snapshot_type: KICKOFF_LINEUP_SNAPSHOT_TYPE,
      };
    })
    .filter((r): r is { match_id: string; player_id: string; slot: string; snapshot_type: string } => r != null);

  if (rows.length === 0) return { error: null };

  const { error: insErr } = await supabase.from('match_lineup_snapshots').upsert(rows, {
    onConflict: 'match_id,snapshot_type,slot',
    ignoreDuplicates: true,
  });

  if (insErr) {
    console.error('[liveMatchService] ensureKickoffLineupSnapshot insert', insErr);
    return { error: insErr.message };
  }
  return { error: null };
}

/** Nach Aufstellung: Match auf „live“ setzen + Anpfiff-Event (Sekunde 0). */
export async function persistLiveMatchBegin(matchId: string): Promise<{ error: string | null }> {
  const { error: snapErr } = await ensureKickoffLineupSnapshot(matchId);
  if (snapErr) {
    console.error('[liveMatchService] persistLiveMatchBegin kickoff snapshot', snapErr);
    return { error: snapErr };
  }

  const now = new Date().toISOString();
  const { error: uErr } = await updateMatchRow(matchId, {
    status: 'live',
    live_started_at: now,
    live_is_running: true,
    live_elapsed_seconds: 0,
    score_home: 0,
    score_away: 0,
    live_period: 1,
  });
  if (uErr) {
    console.error('[liveMatchService] persistLiveMatchBegin matches', uErr);
    return { error: uErr };
  }

  return { error: null };
}
