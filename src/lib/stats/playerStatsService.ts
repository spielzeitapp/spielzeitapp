import { supabase } from '../supabaseClient';

export type PlayerSeasonStats = {
  games: number;
  goals: number;
  minutes: number;
  goalsPer90: number;
  /** Aus match_events (type card / yellow / red); ohne Detailtyp zählt generisches `card` als gelb. */
  yellowCards: number;
  redCards: number;
};

export type PlayerLastMatchRow = {
  match_id: string;
  opponent: string;
  date: string | null;
  dateLabel: string;
  result: string;
  minutes: number;
  goals: number;
  wasStarter: boolean;
  /** UI: 'full' | 'sub_in' | 'bank' | 'partial' (z. B. ausgewechselt) */
  badgeKind: 'full' | 'sub_in' | 'bank' | 'partial';
  badgeLabel: string;
  subInDisplayMinute: number | null;
};

const KICKOFF_SNAPSHOT = 'kickoff';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatDateLabel(iso: string | null): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function matchTotalSeconds(liveElapsed: number | null | undefined): number {
  return Math.max(0, Math.floor(Number(liveElapsed ?? 0) || 0));
}

type MatchRow = {
  id: string;
  opponent: string | null;
  match_date: string | null;
  score_home: number | null;
  score_away: number | null;
  live_elapsed_seconds: number | null;
};

type EventRow = {
  match_id: string;
  type: string;
  minute: number | null;
  player_id: string | null;
  payload?: unknown;
};

function substitutionInPlayerIdFromEvent(e: EventRow): string | null {
  if (String(e.type ?? '').trim() !== 'substitution') return null;
  const p = e.payload && typeof e.payload === 'object' ? (e.payload as Record<string, unknown>) : {};
  const id = typeof p.player_in_id === 'string' ? p.player_in_id.trim() : '';
  return id || null;
}

type SnapshotRow = {
  match_id: string;
  player_id: string;
  slot: string;
};

function buildKickoffSetByMatch(
  snapshots: SnapshotRow[],
  fallbackLineup: Map<string, Set<string>>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const s of snapshots) {
    const mid = String(s.match_id ?? '').trim();
    const pid = String(s.player_id ?? '').trim();
    if (!mid || !pid) continue;
    if (!map.has(mid)) map.set(mid, new Set());
    map.get(mid)!.add(pid);
  }
  for (const [mid, set] of fallbackLineup) {
    if (!map.has(mid) || map.get(mid)!.size === 0) {
      map.set(mid, new Set(set));
    }
  }
  return map;
}

function collectEventsByMatch(events: EventRow[]): Map<string, EventRow[]> {
  const m = new Map<string, EventRow[]>();
  for (const e of events) {
    const mid = String(e.match_id ?? '').trim();
    if (!mid) continue;
    if (!m.has(mid)) m.set(mid, []);
    m.get(mid)!.push(e);
  }
  return m;
}

function playerAppearedInMatch(
  matchId: string,
  playerId: string,
  kickoffByMatch: Map<string, Set<string>>,
  eventsByMatch: Map<string, EventRow[]>,
): boolean {
  const kick = kickoffByMatch.get(matchId);
  if (kick?.has(playerId)) return true;
  const evs = eventsByMatch.get(matchId) ?? [];
  return evs.some((e) => {
    if (String(e.player_id ?? '').trim() === playerId) return true;
    return substitutionInPlayerIdFromEvent(e) === playerId;
  });
}

function goalsInMatchForPlayer(events: EventRow[], playerId: string): number {
  let n = 0;
  for (const e of events) {
    if (String(e.player_id ?? '').trim() !== playerId) continue;
    const t = String(e.type ?? '').toLowerCase();
    if (t === 'goal' || t === 'goal_away') n += 1;
  }
  return n;
}

function cardCountsInMatchForPlayer(events: EventRow[], playerId: string): { yellow: number; red: number } {
  let yellow = 0;
  let red = 0;
  const pid = playerId?.trim();
  if (!pid) return { yellow: 0, red: 0 };
  for (const e of events) {
    if (String(e.player_id ?? '').trim() !== pid) continue;
    const t = String(e.type ?? '')
      .trim()
      .toLowerCase();
    if (t === 'red_card' || t === 'red') red += 1;
    else if (t === 'yellow_card' || t === 'yellow') yellow += 1;
    else if (t === 'card') yellow += 1;
  }
  return { yellow, red };
}

/** MVP-Minuten: Kickoff-Set, Wechsel (substitution + Legacy sub_out/sub_in), live_elapsed_seconds = Ende. */
function minutesPlayedInMatchMvp(
  playerId: string,
  totalSec: number,
  wasStarter: boolean,
  events: EventRow[],
): { minutes: number; subInSec: number | null; subOutSec: number | null } {
  let subOutSec: number | null = null;
  let subInSec: number | null = null;
  const pid = playerId.trim();
  for (const e of events) {
    const t = e.minute != null ? Math.max(0, Math.floor(Number(e.minute))) : null;
    if (t == null) continue;
    const type = String(e.type ?? '').trim();
    const outId = String(e.player_id ?? '').trim();
    if (type === 'sub_out' && outId === pid) {
      if (subOutSec == null || t < subOutSec) subOutSec = t;
    }
    if (type === 'sub_in' && outId === pid) {
      if (subInSec == null || t < subInSec) subInSec = t;
    }
    if (type === 'substitution') {
      if (outId === pid && (subOutSec == null || t < subOutSec)) subOutSec = t;
      const inId = substitutionInPlayerIdFromEvent(e);
      if (inId === pid && (subInSec == null || t < subInSec)) subInSec = t;
    }
  }

  const totalMin = Math.floor(totalSec / 60);

  if (wasStarter) {
    if (subOutSec != null) {
      return { minutes: Math.floor(subOutSec / 60), subInSec, subOutSec };
    }
    return { minutes: totalMin, subInSec, subOutSec: null };
  }

  if (subInSec != null) {
    const playedSec = Math.max(0, totalSec - subInSec);
    return { minutes: Math.floor(playedSec / 60), subInSec, subOutSec };
  }

  return { minutes: 0, subInSec: null, subOutSec: null };
}

function badgeForRow(args: {
  wasStarter: boolean;
  minutes: number;
  totalMin: number;
  subInSec: number | null;
  subOutSec: number | null;
}): { badgeKind: PlayerLastMatchRow['badgeKind']; badgeLabel: string; subInDisplayMinute: number | null } {
  const { wasStarter, minutes, totalMin, subInSec, subOutSec } = args;
  if (minutes <= 0 && subInSec == null && !wasStarter) {
    return { badgeKind: 'bank', badgeLabel: 'BANK', subInDisplayMinute: null };
  }
  if (wasStarter && subOutSec == null && minutes >= Math.max(0, totalMin - 1)) {
    return { badgeKind: 'full', badgeLabel: "90'", subInDisplayMinute: null };
  }
  if (!wasStarter && subInSec != null) {
    const m = Math.max(1, Math.floor(subInSec / 60));
    return { badgeKind: 'sub_in', badgeLabel: `EIN ${m}'`, subInDisplayMinute: m };
  }
  if (wasStarter && subOutSec != null) {
    return { badgeKind: 'partial', badgeLabel: `${minutes}'`, subInDisplayMinute: null };
  }
  if (minutes > 0) {
    return { badgeKind: 'partial', badgeLabel: `${minutes}'`, subInDisplayMinute: null };
  }
  return { badgeKind: 'bank', badgeLabel: 'BANK', subInDisplayMinute: null };
}

async function fetchLineupFallbackPlayerSets(matchIds: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (matchIds.length === 0) return map;
  for (const batch of chunk(matchIds, 80)) {
    const { data, error } = await supabase.from('match_lineup').select('match_id, player_id').in('match_id', batch);
    if (error) {
      console.warn('[playerStatsService] match_lineup fallback', error.message);
      continue;
    }
    for (const r of data ?? []) {
      const mid = String((r as { match_id?: string }).match_id ?? '').trim();
      const pid = String((r as { player_id?: string | null }).player_id ?? '').trim();
      if (!mid || !pid) continue;
      if (!map.has(mid)) map.set(mid, new Set());
      map.get(mid)!.add(pid);
    }
  }
  return map;
}

async function fetchFinishedMatches(teamSeasonId: string): Promise<{ data: MatchRow[]; error: string | null }> {
  const tid = teamSeasonId?.trim();
  if (!tid) return { data: [], error: null };
  const { data, error } = await supabase
    .from('matches')
    .select('id, opponent, match_date, status, score_home, score_away, live_elapsed_seconds')
    .eq('team_season_id', tid)
    .eq('status', 'finished')
    .order('match_date', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as MatchRow[], error: null };
}

async function fetchEventsForMatches(matchIds: string[]): Promise<EventRow[]> {
  const all: EventRow[] = [];
  for (const batch of chunk(matchIds, 80)) {
    const { data, error } = await supabase
      .from('match_events')
      .select('match_id, type, minute, player_id, payload')
      .in('match_id', batch);
    if (error) {
      console.warn('[playerStatsService] match_events', error.message);
      continue;
    }
    for (const r of data ?? []) {
      all.push(r as EventRow);
    }
  }
  return all;
}

async function fetchKickoffSnapshots(matchIds: string[]): Promise<SnapshotRow[]> {
  const all: SnapshotRow[] = [];
  for (const batch of chunk(matchIds, 80)) {
    const { data, error } = await supabase
      .from('match_lineup_snapshots')
      .select('match_id, player_id, slot')
      .eq('snapshot_type', KICKOFF_SNAPSHOT)
      .in('match_id', batch);
    if (error) {
      console.warn('[playerStatsService] match_lineup_snapshots', error.message);
      continue;
    }
    for (const r of data ?? []) {
      all.push(r as SnapshotRow);
    }
  }
  return all;
}

function aggregateForPlayer(
  playerId: string,
  matches: MatchRow[],
  events: EventRow[],
  snapshots: SnapshotRow[],
  lineupFallback: Map<string, Set<string>>,
): { stats: PlayerSeasonStats; lastMatches: PlayerLastMatchRow[] } {
  const pid = playerId?.trim();
  if (!pid || matches.length === 0) {
    return {
      stats: { games: 0, goals: 0, minutes: 0, goalsPer90: 0, yellowCards: 0, redCards: 0 },
      lastMatches: [],
    };
  }

  const matchIds = matches.map((m) => m.id);
  const kickoffByMatch = buildKickoffSetByMatch(snapshots, lineupFallback);
  const eventsByMatch = collectEventsByMatch(events);

  let games = 0;
  let goals = 0;
  let minutes = 0;
  let yellowCards = 0;
  let redCards = 0;

  const lastRows: PlayerLastMatchRow[] = [];

  for (const m of matches) {
    const mid = m.id;
    if (!playerAppearedInMatch(mid, pid, kickoffByMatch, eventsByMatch)) continue;

    games += 1;
    const evs = eventsByMatch.get(mid) ?? [];
    goals += goalsInMatchForPlayer(evs, pid);
    const cards = cardCountsInMatchForPlayer(evs, pid);
    yellowCards += cards.yellow;
    redCards += cards.red;

    const kickSet = kickoffByMatch.get(mid) ?? new Set<string>();
    const wasStarter = kickSet.has(pid);

    const totalSec = matchTotalSeconds(m.live_elapsed_seconds);
    const { minutes: mMin, subInSec, subOutSec } = minutesPlayedInMatchMvp(pid, totalSec, wasStarter, evs);
    minutes += mMin;

    const sh = Number(m.score_home ?? 0);
    const sa = Number(m.score_away ?? 0);
    const totalMin = Math.floor(totalSec / 60);
    const badge = badgeForRow({
      wasStarter,
      minutes: mMin,
      totalMin,
      subInSec,
      subOutSec,
    });

    lastRows.push({
      match_id: mid,
      opponent: (m.opponent ?? 'Gegner').trim() || 'Gegner',
      date: m.match_date,
      dateLabel: formatDateLabel(m.match_date),
      result: `${sh}:${sa}`,
      minutes: mMin,
      goals: goalsInMatchForPlayer(evs, pid),
      wasStarter,
      badgeKind: badge.badgeKind,
      badgeLabel: badge.badgeLabel,
      subInDisplayMinute: badge.subInDisplayMinute,
    });
  }

  const goalsPer90 = minutes > 0 ? (goals / minutes) * 90 : 0;

  lastRows.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return tb - ta;
  });

  return {
    stats: { games, goals, minutes, goalsPer90, yellowCards, redCards },
    lastMatches: lastRows.slice(0, 5),
  };
}

export async function getPlayerSeasonStats(
  playerId: string,
  teamSeasonId: string,
): Promise<{ data: PlayerSeasonStats; error: string | null }> {
  const { data: matches, error: mErr } = await fetchFinishedMatches(teamSeasonId);
  if (mErr)
    return { data: { games: 0, goals: 0, minutes: 0, goalsPer90: 0, yellowCards: 0, redCards: 0 }, error: mErr };
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) {
    return {
      data: { games: 0, goals: 0, minutes: 0, goalsPer90: 0, yellowCards: 0, redCards: 0 },
      error: null,
    };
  }

  const [events, snapshots, lineupFallback] = await Promise.all([
    fetchEventsForMatches(matchIds),
    fetchKickoffSnapshots(matchIds),
    fetchLineupFallbackPlayerSets(matchIds),
  ]);

  const { stats } = aggregateForPlayer(playerId, matches, events, snapshots, lineupFallback);
  return { data: stats, error: null };
}

export async function getPlayerLastMatches(
  playerId: string,
  teamSeasonId: string,
): Promise<{ data: PlayerLastMatchRow[]; error: string | null }> {
  const { data: matches, error: mErr } = await fetchFinishedMatches(teamSeasonId);
  if (mErr) return { data: [], error: mErr };
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) return { data: [], error: null };

  const [events, snapshots, lineupFallback] = await Promise.all([
    fetchEventsForMatches(matchIds),
    fetchKickoffSnapshots(matchIds),
    fetchLineupFallbackPlayerSets(matchIds),
  ]);

  const { lastMatches } = aggregateForPlayer(playerId, matches, events, snapshots, lineupFallback);
  return { data: lastMatches, error: null };
}

/** Ein Fetch für Profil: Stats + letzte 5 Spiele (gemeinsame Aggregation). */
export async function getPlayerProfileStatsBundle(
  playerId: string,
  teamSeasonId: string,
): Promise<{
  stats: PlayerSeasonStats;
  lastMatches: PlayerLastMatchRow[];
  error: string | null;
}> {
  const { data: matches, error: mErr } = await fetchFinishedMatches(teamSeasonId);
  if (mErr) {
    return {
      stats: { games: 0, goals: 0, minutes: 0, goalsPer90: 0, yellowCards: 0, redCards: 0 },
      lastMatches: [],
      error: mErr,
    };
  }
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) {
    return {
      stats: { games: 0, goals: 0, minutes: 0, goalsPer90: 0, yellowCards: 0, redCards: 0 },
      lastMatches: [],
      error: null,
    };
  }

  const [events, snapshots, lineupFallback] = await Promise.all([
    fetchEventsForMatches(matchIds),
    fetchKickoffSnapshots(matchIds),
    fetchLineupFallbackPlayerSets(matchIds),
  ]);

  const { stats, lastMatches } = aggregateForPlayer(playerId, matches, events, snapshots, lineupFallback);
  return { stats, lastMatches, error: null };
}
