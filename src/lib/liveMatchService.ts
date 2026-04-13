import { supabase } from './supabaseClient';
import type { FieldSlotId } from '../types/match';
import type { MatchEngineEvent, MatchEventType } from './matchEngine';

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
};

export type MatchEventDbRow = {
  id: string;
  match_id: string;
  type: string;
  minute: number | null;
  period: number | null;
  player_id: string | null;
  created_at: string;
};

function normalizeUniquePlayerIds(ids: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

const ENGINE_TYPES = new Set<MatchEventType>([
  'start',
  'pause',
  'resume',
  'end',
  'sub_out',
  'sub_in',
  'goal',
]);

/**
 * DB-Spalte `minute` speichert hier Spielsekunden seit Anpfiff (nicht Anzeige-Minute).
 */
export function matchEventDbRowToEngine(row: MatchEventDbRow): MatchEngineEvent | null {
  if (row.type === 'goal_away') {
    return {
      id: row.id,
      type: 'goal',
      timestamp: row.minute ?? 0,
      playerId: undefined,
    };
  }
  if (!ENGINE_TYPES.has(row.type as MatchEventType)) return null;
  return {
    id: row.id,
    type: row.type as MatchEventType,
    timestamp: row.minute ?? 0,
    playerId: row.player_id ?? undefined,
  };
}

export type InsertMatchEventPayload = {
  match_id: string;
  type: string;
  minute: number;
  period?: number | null;
  player_id?: string | null;
};

export function engineEventToInsertPayload(
  matchId: string,
  ev: Omit<MatchEngineEvent, 'id'>,
  period?: number | null,
): InsertMatchEventPayload {
  const base: InsertMatchEventPayload = {
    match_id: matchId,
    type: ev.type === 'goal' && !ev.playerId ? 'goal_away' : ev.type,
    minute: ev.timestamp,
    period: period ?? null,
    player_id: ev.playerId ?? null,
  };
  return base;
}

export async function fetchMatchById(matchId: string): Promise<{ data: LiveMatchRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, team_season_id, opponent, match_date, location, status, score_home, score_away, live_started_at, live_elapsed_seconds, live_is_running, live_period',
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
      'id, team_season_id, opponent, match_date, location, status, score_home, score_away, live_started_at, live_elapsed_seconds, live_is_running, live_period',
    )
    .or('status.eq.live,live_is_running.eq.true')
    .order('live_started_at', { ascending: false, nullsFirst: false })
    .order('match_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: (data as LiveMatchRow) ?? null, error: null };
}

export async function fetchMatchEvents(matchId: string): Promise<{ data: MatchEngineEvent[]; error: string | null }> {
  const { data, error } = await supabase
    .from('match_events')
    .select('id, match_id, type, minute, period, player_id, created_at')
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
    supabase.from('match_lineup').select('slot, player_id').eq('match_id', matchId),
    supabase.from('match_bench').select('player_id').eq('match_id', matchId),
  ]);

  if (lineupRes.error) return { data: { startingPlayerIds: [], squadPlayerIds: [] }, error: lineupRes.error.message };
  if (benchRes.error) return { data: { startingPlayerIds: [], squadPlayerIds: [] }, error: benchRes.error.message };

  const slotToPlayer: Partial<Record<FieldSlotId, string | null>> = {};
  for (const r of (lineupRes.data ?? []) as { slot: FieldSlotId; player_id: string | null }[]) {
    slotToPlayer[r.slot] = r.player_id;
  }

  const startingPlayerIds = LIVE_FIELD_SLOT_ORDER.map((s) => slotToPlayer[s]).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );

  const benchIds = ((benchRes.data ?? []) as { player_id: string }[]).map((r) => r.player_id);
  const squadSet = new Set<string>([...startingPlayerIds, ...benchIds]);
  const squadPlayerIds = [...squadSet];

  return { data: { startingPlayerIds, squadPlayerIds }, error: null };
}

export async function saveMatchEvent(payload: InsertMatchEventPayload): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.from('match_events').insert(payload).select('id').single();
  if (error) {
    console.error('[liveMatchService] saveMatchEvent', error);
    return { id: null, error: error.message };
  }
  const id = (data as { id?: string } | null)?.id ?? null;
  return { id, error: null };
}

export async function saveMatchEvents(
  payloads: InsertMatchEventPayload[],
): Promise<{ ids: string[]; error: string | null }> {
  if (payloads.length === 0) return { ids: [], error: null };
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
  const uniqueSquad = normalizeUniquePlayerIds(squadPlayerIds);

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

  const mergedSquad = normalizeUniquePlayerIds([...uniqueSquad, ...[...starterIds]]);
  const benchIds = mergedSquad.filter((id) => !starterIds.has(id));

  const delBench = await supabase.from('match_bench').delete().eq('match_id', matchId);
  if (delBench.error) return { error: delBench.error.message };

  if (benchIds.length > 0) {
    const benchRows = benchIds.map((player_id) => ({ match_id: matchId, player_id }));
    const insBench = await supabase.from('match_bench').upsert(benchRows, {
      onConflict: 'match_id,player_id',
    });
    if (insBench.error) return { error: insBench.error.message };
  }

  return { error: null };
}

/** Lineup + Bank komplett ersetzen (7 Slots + bench) — atomar via `replace_match_lineup_and_bench`. */
export async function replaceMatchLineupAndBench(
  matchId: string,
  startingPlayerIds: Array<string | null | undefined>,
  squadPlayerIds: string[],
): Promise<{ error: string | null }> {
  const starters = LIVE_FIELD_SLOT_ORDER.map((_, i) => {
    const raw = startingPlayerIds[i];
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  });
  const starterSet = new Set(starters.filter((id): id is string => Boolean(id)));
  /** Kader immer als Vereinigung aus expliziter Liste + Startelf (verhindert leere Bank bei vergessenen Nicht-Startern in `squadPlayerIds`). */
  const normalizedSquad = normalizeUniquePlayerIds([
    ...squadPlayerIds,
    ...[...starterSet],
  ]);
  const benchIds = normalizedSquad.filter((id) => !starterSet.has(id));

  const p_lineup = LIVE_FIELD_SLOT_ORDER.map((slot, i) => ({
    slot,
    player_id: starters[i] ?? null,
  }));

  const { error } = await supabase.rpc('replace_match_lineup_and_bench', {
    p_match_id: matchId,
    p_lineup,
    p_bench_player_ids: benchIds,
  });

  if (error) {
    console.error('[liveMatchService] replaceMatchLineupAndBench rpc', error);
    return { error: error.message };
  }

  return { error: null };
}

/** Nach Aufstellung: Match auf „live“ setzen + Anpfiff-Event (Sekunde 0). */
export async function persistLiveMatchBegin(matchId: string): Promise<{ error: string | null }> {
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

  const existingStart = await supabase
    .from('match_events')
    .select('id')
    .eq('match_id', matchId)
    .eq('type', 'start')
    .limit(1)
    .maybeSingle();
  if (existingStart.error) {
    console.error('[liveMatchService] persistLiveMatchBegin match_events check', existingStart.error);
    return { error: existingStart.error.message };
  }

  if (!existingStart.data) {
    const { error: eErr } = await saveMatchEvent({
      match_id: matchId,
      type: 'start',
      minute: 0,
      period: 1,
      player_id: null,
    });
    if (eErr) {
      console.error('[liveMatchService] persistLiveMatchBegin match_events', eErr);
      return { error: eErr };
    }
  }

  return { error: null };
}
