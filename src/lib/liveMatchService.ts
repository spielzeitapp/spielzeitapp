import { supabase } from './supabaseClient';
import { debugAssertMatchEventDbType } from './matchEventScores';
import type { FieldSlotId } from '../types/match';
import { getBenchPlayers, fieldSlotMapToStartingIds, swapTwoOccupiedFieldSlots, type MatchEngineEvent, type MatchEventType } from './matchEngine';

/** Reihenfolge der Slots = Startelf-Reihenfolge (7er). */
export const LIVE_FIELD_SLOT_ORDER: FieldSlotId[] = ['GK', 'LB', 'RB', 'CM', 'LW', 'RW', 'ST'];

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

/** Anzeige-Sekunden (Reload-sicher): live_elapsed_seconds + (now − live_started_at) bei laufender Uhr. */
export function computeLiveMatchElapsedSeconds(row: LiveMatchRow | null, nowMs = Date.now()): number {
  if (!row) return 0;
  const base = Math.max(0, Number(row.live_elapsed_seconds ?? 0) || 0);
  if (row.status === 'finished') return base;
  if (!row.live_is_running || !row.live_started_at) return base;
  const started = new Date(row.live_started_at).getTime();
  if (Number.isNaN(started)) return base;
  return base + Math.max(0, Math.floor((nowMs - started) / 1000));
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
    return {
      id: row.id,
      type: 'position_swap',
      timestamp: row.minute ?? 0,
      playerId: row.player_id ?? undefined,
      swapWithPlayerId: swapWith || undefined,
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
  if (ev.type === 'position_swap') {
    debugAssertMatchEventDbType('engineEventToInsertPayload', 'position_swap');
    return {
      match_id: matchId,
      type: 'position_swap',
      minute: ev.timestamp,
      period: period ?? null,
      player_id: ev.playerId ?? null,
      payload: { swap_player_id: ev.swapWithPlayerId ?? null },
    };
  }
  const dbType = ev.type === 'goal' ? 'goal' : ev.type === 'goal_away' ? 'goal_away' : (ev.type as string);
  debugAssertMatchEventDbType('engineEventToInsertPayload', dbType);
  const base: InsertMatchEventPayload = {
    match_id: matchId,
    type: dbType,
    minute: ev.timestamp,
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
      'id, team_season_id, opponent, match_date, location, status, score_home, score_away, live_started_at, live_elapsed_seconds, live_is_running, live_period, period_scores, u11_formation_id',
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
      'id, team_season_id, opponent, match_date, location, status, score_home, score_away, live_started_at, live_elapsed_seconds, live_is_running, live_period, period_scores, u11_formation_id',
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
};

export async function fetchLineupForLiveMatch(matchId: string): Promise<{ data: LineupLoadResult; error: string | null }> {
  const [lineupRes, benchRes] = await Promise.all([
    supabase.from('match_lineup').select('player_id, slot').eq('match_id', matchId),
    supabase.from('match_bench').select('player_id').eq('match_id', matchId),
  ]);

  if (lineupRes.error) return { data: { startingPlayerIds: [], squadPlayerIds: [] }, error: lineupRes.error.message };
  if (benchRes.error) return { data: { startingPlayerIds: [], squadPlayerIds: [] }, error: benchRes.error.message };

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

  const startingSet = new Set(startingPlayerIds.filter((id) => String(id ?? '').trim().length > 0));
  const benchPlayerIds = benchRows
    .map((r) => r.player_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .filter((id) => !startingSet.has(id));
  const squadPlayerIds = [
    ...startingPlayerIds.filter((id) => String(id ?? '').trim().length > 0),
    ...benchPlayerIds,
  ].filter((id, idx, arr) => arr.indexOf(id) === idx);
  console.log('fetchLineupForLiveMatch final', {
    matchId,
    lineupRows,
    benchRows,
    startingPlayerIds,
    squadPlayerIds,
  });

  return { data: { startingPlayerIds, squadPlayerIds }, error: null };
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
 * Nur Match-Kader (Bank) speichern — ohne `match_lineup` anzutasten.
 * Bank-Zeilen = Kader minus aktuelle Startelf aus `match_lineup`.
 */
export async function saveMatchSquadOnly(
  matchId: string,
  squadPlayerIds: string[],
): Promise<{ error: string | null }> {
  const uniqueSquad = [...new Set(squadPlayerIds.map((id) => String(id ?? '').trim()).filter(Boolean))];

  const { data: lineupRows, error: lineupErr } = await supabase
    .from('match_lineup')
    .select('player_id')
    .eq('match_id', matchId);

  if (lineupErr) return { error: lineupErr.message };

  const starterIds = new Set(
    (lineupRows ?? [])
      .map((r: { player_id: string | null }) => r.player_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  const benchIds = uniqueSquad.filter((id) => !starterIds.has(id));

  const delBench = await supabase.from('match_bench').delete().eq('match_id', matchId);
  if (delBench.error) return { error: delBench.error.message };

  if (benchIds.length > 0) {
    const benchRows = benchIds.map((player_id) => ({ match_id: matchId, player_id }));
    const insBench = await supabase.from('match_bench').insert(benchRows);
    if (insBench.error) return { error: insBench.error.message };
  }

  return { error: null };
}

/** Lineup + Bank komplett ersetzen (7 Slots + bench). */
export async function replaceMatchLineupAndBench(
  matchId: string,
  startingPlayerIds: Array<string | null | undefined>,
  squadPlayerIds: string[],
): Promise<{ error: string | null }> {
  const normalizeId = (raw: string | null | undefined): string | null => {
    const v = String(raw ?? '').trim();
    return v.length > 0 ? v : null;
  };

  const starters = LIVE_FIELD_SLOT_ORDER.map((_, i) => normalizeId(startingPlayerIds[i]));
  const lineup = starters.filter((id): id is string => Boolean(id));
  const lineupSet = new Set(lineup);
  const kader = [...new Set(squadPlayerIds.map((id) => normalizeId(id)).filter((id): id is string => Boolean(id)))];
  // Bench immer aus aktuellem UI-State berechnen: bench = kader - lineup
  const benchIds = kader.filter((id) => !lineupSet.has(id));
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
  timestamp: number;
  period: number | null;
}): Promise<{ error: string | null; eventId: string | null }> {
  const mid = params.matchId?.trim();
  if (!mid) return { error: 'Kein Match.', eventId: null };
  const swapped = swapTwoOccupiedFieldSlots(params.currentSlots, params.slotA, params.slotB);
  if (!swapped) return { error: 'Positionswechsel nicht möglich.', eventId: null };
  const nextStarting = fieldSlotMapToStartingIds(swapped);
  const lineupRes = await replaceMatchLineupAndBench(mid, nextStarting, params.squadPlayerIds);
  if (lineupRes.error) return { error: lineupRes.error, eventId: null };

  const pidA = String(params.currentSlots[params.slotA] ?? '').trim();
  const pidB = String(params.currentSlots[params.slotB] ?? '').trim();
  const { id, error } = await saveMatchEvent({
    match_id: mid,
    type: 'position_swap',
    minute: params.timestamp,
    period: params.period ?? null,
    player_id: pidA || null,
    payload: { swap_player_id: pidB || null },
  });
  return { error: error ?? null, eventId: id };
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

/**
 * Repariertes 7er-Array + Kader aus Roh-DB: doppelte Feld-Slots bereinigt (erster Slot gewinnt),
 * leere Slots deterministisch aus der Bank auffüllen (sofern Kader reicht),
 * Kader = Union aller Roh-IDs; Bank = Kader minus Feld (Feld gewinnt bei Doppelbelegung).
 */
export function computeRepairedLiveLineupFromRaw(
  lineupRows: RawLineupRow[],
  benchRows: RawBenchRow[],
): { startingPlayerIds: string[]; squadPlayerIds: string[] } {
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
  let benchQueue = stableBenchQueue(fieldSetNow, benchRows, U);

  for (const emptySlot of LIVE_FIELD_SLOT_ORDER) {
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

export function liveLineupRawDiffersFromRepaired(lineupRows: RawLineupRow[], benchRows: RawBenchRow[]): boolean {
  const { startingPlayerIds, squadPlayerIds } = computeRepairedLiveLineupFromRaw(lineupRows, benchRows);
  return snapshotRawLineupBench(lineupRows, benchRows) !== snapshotRepairedLineupBench(startingPlayerIds, squadPlayerIds);
}

/**
 * Liest `match_lineup` + `match_bench`, vergleicht mit bereinigtem Soll-Zustand; bei Abweichung einmalig `replaceMatchLineupAndBench`.
 */
export async function repairLiveMatchLineupBenchIfNeeded(matchId: string): Promise<LiveLineupRepairResult> {
  const mid = matchId?.trim();
  if (!mid) return { inconsistent: false, repaired: false, error: null };

  const [lineupRes, benchRes] = await Promise.all([
    supabase.from('match_lineup').select('player_id, slot').eq('match_id', mid),
    supabase.from('match_bench').select('player_id').eq('match_id', mid),
  ]);

  if (lineupRes.error) return { inconsistent: false, repaired: false, error: lineupRes.error.message };
  if (benchRes.error) return { inconsistent: false, repaired: false, error: benchRes.error.message };

  const lineupRows = (lineupRes.data ?? []) as RawLineupRow[];
  const benchRows = (benchRes.data ?? []) as RawBenchRow[];

  if (!liveLineupRawDiffersFromRepaired(lineupRows, benchRows)) {
    return { inconsistent: false, repaired: false, error: null };
  }

  const { startingPlayerIds, squadPlayerIds } = computeRepairedLiveLineupFromRaw(lineupRows, benchRows);
  const { error } = await replaceMatchLineupAndBench(mid, startingPlayerIds, squadPlayerIds);
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
