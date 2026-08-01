import { supabase } from '../supabaseClient';
import { fetchValidSeasonMatchIds } from '../seasonMatchStats';
import { formatTeamSeasonDisplayLabel, resolveCurrentAgeGroup } from '../seasonLifecycle';
import {
  computePlayerPlaytimeFromEvents,
  FIELD_SLOT_ORDER,
  resolveReplayAtMatchSecond,
  statsMatchEventRowToEngine,
  type MatchEngineEvent,
} from '../matchEngine';

export type PlayerSeasonStats = {
  games: number;
  goals: number;
  assists: number;
  minutes: number;
  /** Tore pro Spiel (goals / games). */
  goalsPerGame: number;
  /** Durchschnittliche Spielminuten pro Einsatz (minutes / games). */
  averageMinutesPerGame: number;
  goalsPer90: number;
  /** Legacy – nicht mehr in der Jugend-UI; bleibt für Aggregation/API-Kompatibilität. */
  yellowCards: number;
  redCards: number;
  /** TODO: U12+ Zeitstrafe / Blaue Karte später anbinden (player_stats.blue_cards). */
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
  planned_match_minutes: number | null;
};

type EventRow = {
  match_id: string;
  type: string;
  minute: number | null;
  player_id: string | null;
  payload?: unknown;
  id?: string;
  created_at?: string;
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

/** Kickoff-Startelf in Slot-Reihenfolge (7er) pro Match. */
function buildKickoffLineupByMatch(
  snapshots: SnapshotRow[],
  fallbackLineup: Map<string, Set<string>>,
): Map<string, string[]> {
  const slotMaps = new Map<string, Map<string, string>>();
  for (const s of snapshots) {
    const mid = String(s.match_id ?? '').trim();
    const pid = String(s.player_id ?? '').trim();
    const slot = String(s.slot ?? '').trim();
    if (!mid || !pid || !slot) continue;
    if (!slotMaps.has(mid)) slotMaps.set(mid, new Map());
    slotMaps.get(mid)!.set(slot, pid);
  }
  const out = new Map<string, string[]>();
  for (const [mid, slots] of slotMaps) {
    out.set(
      mid,
      FIELD_SLOT_ORDER.map((slot) => String(slots.get(slot) ?? '').trim()),
    );
  }
  for (const [mid, set] of fallbackLineup) {
    if (!out.has(mid) || out.get(mid)!.every((id) => !id)) {
      out.set(mid, [...set].slice(0, 7));
    }
  }
  return out;
}

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

function assistPlayerIdFromGoalEvent(e: EventRow): string | null {
  const p = e.payload && typeof e.payload === 'object' ? (e.payload as Record<string, unknown>) : {};
  const raw =
    (typeof p.assist_player_id === 'string' && p.assist_player_id) ||
    (typeof p.assist_id === 'string' && p.assist_id) ||
    (typeof p.player_assist_id === 'string' && p.player_assist_id) ||
    '';
  const id = String(raw).trim();
  return id || null;
}

function assistsInMatchForPlayer(events: EventRow[], playerId: string): number {
  let n = 0;
  const pid = playerId.trim();
  if (!pid) return 0;
  for (const e of events) {
    const t = String(e.type ?? '').toLowerCase();
    if (t !== 'goal' && t !== 'goal_away') continue;
    if (assistPlayerIdFromGoalEvent(e) === pid) n += 1;
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

function eventRowsToEngineEvents(rows: EventRow[]): MatchEngineEvent[] {
  const out: MatchEngineEvent[] = [];
  for (const row of rows) {
    const ev = statsMatchEventRowToEngine(row);
    if (ev) out.push(ev);
  }
  return out;
}

/** Nur für Badge-Labels (EIN/Teilzeit), Minuten kommen aus `computePlayerPlaytimeFromEvents`. */
function substitutionBadgeSeconds(
  playerId: string,
  events: EventRow[],
): { subInSec: number | null; subOutSec: number | null } {
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
  return { subInSec, subOutSec };
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
    return { badgeKind: 'full', badgeLabel: `${totalMin}'`, subInDisplayMinute: null };
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

function resolveMatchDurationMinutes(match: MatchRow, finalSec: number): number {
  const planned = Number(match.planned_match_minutes);
  if (Number.isFinite(planned) && planned > 0) {
    return Math.floor(planned);
  }
  return Math.floor(Math.max(0, finalSec) / 60);
}

async function fetchFinishedMatches(teamSeasonId: string): Promise<{ data: MatchRow[]; error: string | null }> {
  const tid = teamSeasonId?.trim();
  if (!tid) return { data: [], error: null };

  // Nur Matches, die noch an ein aktives Kalender-/Turnier-Event gebunden sind
  // (verhindert Orphans nach Event-Löschung ohne Match-Cascade).
  const validIds = await fetchValidSeasonMatchIds(tid);
  if (validIds.size === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('matches')
    .select('id, opponent, match_date, status, score_home, score_away, live_elapsed_seconds, planned_match_minutes')
    .eq('team_season_id', tid)
    .eq('status', 'finished')
    .in('id', [...validIds])
    .order('match_date', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as MatchRow[], error: null };
}

async function fetchEventsForMatches(matchIds: string[]): Promise<EventRow[]> {
  const all: EventRow[] = [];
  for (const batch of chunk(matchIds, 80)) {
    const { data, error } = await supabase
      .from('match_events')
      .select('id, match_id, type, minute, player_id, payload, created_at')
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
      stats: { games: 0, goals: 0, assists: 0, minutes: 0, goalsPerGame: 0, averageMinutesPerGame: 0, goalsPer90: 0, yellowCards: 0, redCards: 0 },
      lastMatches: [],
    };
  }

  const matchIds = matches.map((m) => m.id);
  const kickoffByMatch = buildKickoffSetByMatch(snapshots, lineupFallback);
  const kickoffLineupByMatch = buildKickoffLineupByMatch(snapshots, lineupFallback);
  const eventsByMatch = collectEventsByMatch(events);

  let games = 0;
  let goals = 0;
  let assists = 0;
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
    assists += assistsInMatchForPlayer(evs, pid);
    const cards = cardCountsInMatchForPlayer(evs, pid);
    yellowCards += cards.yellow;
    redCards += cards.red;

    const kickSet = kickoffByMatch.get(mid) ?? new Set<string>();
    const wasStarter = kickSet.has(pid);

    const kickoffIds = kickoffLineupByMatch.get(mid) ?? [];
    const squadSet = new Set<string>([...(lineupFallback.get(mid) ?? []), ...kickSet]);
    const engineEvs = eventRowsToEngineEvents(evs);
    const finalSec = resolveReplayAtMatchSecond(engineEvs, m.live_elapsed_seconds);
    const matchDurationMin = resolveMatchDurationMinutes(m, finalSec);
    const playtimes = computePlayerPlaytimeFromEvents({
      kickoffStartingPlayerIds: kickoffIds,
      squadPlayerIds: [...squadSet],
      events: engineEvs,
      finalMatchSecond: finalSec,
    });
    const mMin = Math.floor(Math.max(0, playtimes[pid] ?? 0) / 60);
    const { subInSec, subOutSec } = substitutionBadgeSeconds(pid, evs);
    minutes += mMin;

    const sh = Number(m.score_home ?? 0);
    const sa = Number(m.score_away ?? 0);
    const badge = badgeForRow({
      wasStarter,
      minutes: mMin,
      totalMin: matchDurationMin,
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

  const goalsPerGame = games > 0 ? goals / games : 0;
  const averageMinutesPerGame = games > 0 ? minutes / games : 0;
  const goalsPer90 = minutes > 0 ? (goals / minutes) * 90 : 0;

  lastRows.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return tb - ta;
  });

  return {
    stats: { games, goals, assists, minutes, goalsPerGame, averageMinutesPerGame, goalsPer90, yellowCards, redCards },
    lastMatches: lastRows.slice(0, 5),
  };
}

export async function getPlayerSeasonStats(
  playerId: string,
  teamSeasonId: string,
): Promise<{ data: PlayerSeasonStats; error: string | null }> {
  const { data: matches, error: mErr } = await fetchFinishedMatches(teamSeasonId);
  if (mErr)
    return { data: { games: 0, goals: 0, assists: 0, minutes: 0, goalsPerGame: 0, averageMinutesPerGame: 0, goalsPer90: 0, yellowCards: 0, redCards: 0 }, error: mErr };
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) {
    return {
      data: { games: 0, goals: 0, assists: 0, minutes: 0, goalsPerGame: 0, averageMinutesPerGame: 0, goalsPer90: 0, yellowCards: 0, redCards: 0 },
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
      stats: { games: 0, goals: 0, assists: 0, minutes: 0, goalsPerGame: 0, averageMinutesPerGame: 0, goalsPer90: 0, yellowCards: 0, redCards: 0 },
      lastMatches: [],
      error: mErr,
    };
  }
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length === 0) {
    return {
      stats: { games: 0, goals: 0, assists: 0, minutes: 0, goalsPerGame: 0, averageMinutesPerGame: 0, goalsPer90: 0, yellowCards: 0, redCards: 0 },
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

const EMPTY_PLAYER_STATS: PlayerSeasonStats = {
  games: 0,
  goals: 0,
  assists: 0,
  minutes: 0,
  goalsPerGame: 0,
  averageMinutesPerGame: 0,
  goalsPer90: 0,
  yellowCards: 0,
  redCards: 0,
};

/** Alle team_season_ids, in denen der Spieler im Kader steht (stabile player_id). */
export async function listPlayerTeamSeasonIds(
  playerId: string,
): Promise<{ data: string[]; error: string | null }> {
  const pid = playerId?.trim();
  if (!pid) return { data: [], error: null };
  const { data, error } = await supabase
    .from('team_season_players')
    .select('team_season_id')
    .eq('player_id', pid);
  if (error) return { data: [], error: error.message };
  const ids = [
    ...new Set(
      (data ?? [])
        .map((r) => String((r as { team_season_id?: string }).team_season_id ?? '').trim())
        .filter(Boolean),
    ),
  ];
  return { data: ids, error: null };
}

export type PlayerSeasonOption = {
  teamSeasonId: string;
  label: string;
  status: string | null;
  seasonName: string | null;
  ageGroup: string | null;
};

/** Saison-Chips fürs Profil (Display-Label + Status). */
export async function listPlayerSeasonOptions(
  playerId: string,
): Promise<{ data: PlayerSeasonOption[]; error: string | null }> {
  const { data: ids, error } = await listPlayerTeamSeasonIds(playerId);
  if (error) return { data: [], error };
  if (ids.length === 0) return { data: [], error: null };

  const { data: rows, error: tsErr } = await supabase
    .from('team_seasons')
    .select('id, status, display_name, age_group, seasons:seasons ( name ), teams:teams ( name, age_group )')
    .in('id', ids);
  if (tsErr) return { data: [], error: tsErr.message };

  const options: PlayerSeasonOption[] = [];
  for (const raw of rows ?? []) {
    const row = raw as {
      id: string;
      status?: string | null;
      display_name?: string | null;
      age_group?: string | null;
      seasons?: { name?: string } | { name?: string }[] | null;
      teams?: { name?: string; age_group?: string | null } | { name?: string; age_group?: string | null }[] | null;
    };
    const seasonJoin = Array.isArray(row.seasons) ? row.seasons[0] : row.seasons;
    const teamJoin = Array.isArray(row.teams) ? row.teams[0] : row.teams;
    const seasonName = seasonJoin?.name?.trim() || null;
    // Altersklasse nur aus DIESER team_season (+ deren Team-Join), nie aus der aktiven Session.
    // Archivierte U11: age_group/display_name oft NULL → Parse aus teams.name der Zeile.
    const ageGroup =
      resolveCurrentAgeGroup({
        ageGroup: row.age_group,
        displayName: row.display_name,
        teamName: teamJoin?.name,
      }) ||
      resolveCurrentAgeGroup({ ageGroup: teamJoin?.age_group }) ||
      null;
    options.push({
      teamSeasonId: String(row.id),
      status: row.status ?? null,
      seasonName,
      ageGroup,
      label: formatTeamSeasonDisplayLabel(
        {
          displayName: row.display_name,
          ageGroup,
          teamName: teamJoin?.name,
          seasonName,
          status: row.status,
        },
        { markArchived: true },
      ),
    });
  }

  options.sort((a, b) => {
    const an = a.seasonName ?? '';
    const bn = b.seasonName ?? '';
    return bn.localeCompare(an, 'de');
  });
  return { data: options, error: null };
}

async function aggregateMatchesForPlayer(
  playerId: string,
  matches: MatchRow[],
): Promise<{ stats: PlayerSeasonStats; lastMatches: PlayerLastMatchRow[]; error: string | null }> {
  if (matches.length === 0) {
    return { stats: { ...EMPTY_PLAYER_STATS }, lastMatches: [], error: null };
  }
  const matchIds = matches.map((m) => m.id);
  const [events, snapshots, lineupFallback] = await Promise.all([
    fetchEventsForMatches(matchIds),
    fetchKickoffSnapshots(matchIds),
    fetchLineupFallbackPlayerSets(matchIds),
  ]);
  const { stats, lastMatches } = aggregateForPlayer(playerId, matches, events, snapshots, lineupFallback);
  return { stats, lastMatches, error: null };
}

/** Karriere: gültige finished Matches über alle Kader-Saisons derselben player_id. */
export async function getPlayerCareerStatsBundle(
  playerId: string,
): Promise<{
  stats: PlayerSeasonStats;
  lastMatches: PlayerLastMatchRow[];
  error: string | null;
}> {
  const { data: seasonIds, error: listErr } = await listPlayerTeamSeasonIds(playerId);
  if (listErr) return { stats: { ...EMPTY_PLAYER_STATS }, lastMatches: [], error: listErr };
  if (seasonIds.length === 0) {
    return { stats: { ...EMPTY_PLAYER_STATS }, lastMatches: [], error: null };
  }

  const byId = new Map<string, MatchRow>();
  for (const sid of seasonIds) {
    const { data, error } = await fetchFinishedMatches(sid);
    if (error) return { stats: { ...EMPTY_PLAYER_STATS }, lastMatches: [], error };
    for (const m of data) byId.set(m.id, m);
  }

  const matches = [...byId.values()].sort((a, b) => {
    const da = a.match_date ?? '';
    const db = b.match_date ?? '';
    return db.localeCompare(da);
  });

  return aggregateMatchesForPlayer(playerId, matches);
}

/**
 * Einheitlicher Stats-Einstieg für Profil.
 * mode=season → teamSeasonId Pflicht; mode=career → Aggregation über player_id.
 */
export async function getPlayerStats(input: {
  playerId: string;
  mode: 'season' | 'career';
  teamSeasonId?: string | null;
}): Promise<{
  stats: PlayerSeasonStats;
  lastMatches: PlayerLastMatchRow[];
  error: string | null;
}> {
  const pid = input.playerId?.trim();
  if (!pid) return { stats: { ...EMPTY_PLAYER_STATS }, lastMatches: [], error: null };
  if (input.mode === 'career') {
    return getPlayerCareerStatsBundle(pid);
  }
  const tid = input.teamSeasonId?.trim();
  if (!tid) return { stats: { ...EMPTY_PLAYER_STATS }, lastMatches: [], error: null };
  return getPlayerProfileStatsBundle(pid, tid);
}
