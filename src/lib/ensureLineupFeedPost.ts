import { supabase } from './supabaseClient';
import { fetchMatchById, LIVE_FIELD_SLOT_ORDER } from './liveMatchService';
import { isU11FormationId, type U11FormationId } from './matchFormations';
import { premiumPlayerDisplayName } from './premiumPlayerCard';
import {
  buildAutoLineupFeedCaption,
  dedupeKeyForLineupMatch,
  type LineupFeedPayload,
  type LineupFeedPlayer,
} from './lineupFeedTypes';
import type { FieldSlotId } from '../types/match';

export type EnsureLineupFeedPostResult =
  | { ok: true; created: boolean; reason?: string }
  | { ok: false; error: string };

const MIN_FIELD_PLAYERS = 5;
const MAX_MINUTES_BEFORE_KICKOFF = 90;

function luLog(phase: string, data: Record<string, unknown>): void {
  console.info(`[lineupFeed] ${phase}`, data);
}

type TeamSeasonJoinRow = {
  team_id: string | null;
  teams: { name: string | null } | { name: string | null }[] | null;
};

async function resolveTeamForSeason(teamSeasonId: string): Promise<{ teamId: string; name: string } | null> {
  const { data: tsRow, error: tsErr } = await supabase
    .from('team_seasons')
    .select('team_id, teams(name)')
    .eq('id', teamSeasonId)
    .maybeSingle();

  if (!tsErr && tsRow?.team_id) {
    const row = tsRow as TeamSeasonJoinRow;
    const raw = row.teams;
    const t = Array.isArray(raw) ? raw[0] : raw;
    const nameFromJoin = (t?.name != null ? String(t.name).trim() : '') || '';
    return { teamId: row.team_id, name: nameFromJoin || 'Unser Team' };
  }

  const { data: minimal, error: minErr } = await supabase
    .from('team_seasons')
    .select('team_id')
    .eq('id', teamSeasonId)
    .maybeSingle();

  if (minErr || !minimal?.team_id) return null;
  const teamId = minimal.team_id as string;
  const { data: teamRow } = await supabase.from('teams').select('name').eq('id', teamId).maybeSingle();
  const n = (teamRow as { name?: string | null } | null)?.name;
  const name = n != null && String(n).trim() ? String(n).trim() : 'Unser Team';
  return { teamId, name };
}

async function isDedupeSuppressed(dedupe_key: string): Promise<boolean> {
  const { data } = await supabase
    .from('team_feed_dedupe_suppressions')
    .select('dedupe_key')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();
  return Boolean(data?.dedupe_key);
}

function countFieldPlayers(
  rows: Array<{ slot: FieldSlotId; player_id: string | null }>,
): number {
  let n = 0;
  for (const row of rows) {
    if (row.slot === 'GK') continue;
    if (row.player_id?.trim()) n += 1;
  }
  return n;
}

function minutesUntilKickoff(startsAtIso: string, now: Date): number | null {
  const kick = new Date(startsAtIso);
  if (Number.isNaN(kick.getTime())) return null;
  return (kick.getTime() - now.getTime()) / 60_000;
}

async function fetchLineupPlayers(matchId: string): Promise<{
  fieldCount: number;
  players: LineupFeedPlayer[];
  formation: string | null;
} | null> {
  const { data: lineupRows, error: lineupErr } = await supabase
    .from('match_lineup')
    .select('slot, player_id')
    .eq('match_id', matchId);

  if (lineupErr) {
    luLog('lineup load error', { matchId, error: lineupErr.message });
    return null;
  }

  const rows = (lineupRows ?? []) as Array<{ slot: FieldSlotId; player_id: string | null }>;
  const fieldCount = countFieldPlayers(rows);
  if (fieldCount < MIN_FIELD_PLAYERS) {
    return { fieldCount, players: [], formation: null };
  }

  const slotToPlayer = new Map<FieldSlotId, string>();
  for (const r of rows) {
    const pid = r.player_id?.trim();
    if (pid && LIVE_FIELD_SLOT_ORDER.includes(r.slot)) {
      slotToPlayer.set(r.slot, pid);
    }
  }

  const orderedIds = LIVE_FIELD_SLOT_ORDER.map((slot) => slotToPlayer.get(slot) ?? null).filter(
    (id): id is string => Boolean(id),
  );

  if (orderedIds.length === 0) {
    return { fieldCount, players: [], formation: null };
  }

  const { data: playerRows, error: playersErr } = await supabase
    .from('players')
    .select('id, first_name, last_name, display_name, name')
    .in('id', orderedIds);

  if (playersErr) {
    luLog('players load error', { matchId, error: playersErr.message });
    return null;
  }

  const nameById = new Map<string, string>();
  for (const pr of playerRows ?? []) {
    const row = pr as {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      display_name?: string | null;
      name?: string | null;
    };
    nameById.set(row.id, premiumPlayerDisplayName(row));
  }

  const players: LineupFeedPlayer[] = [];
  for (const slot of LIVE_FIELD_SLOT_ORDER) {
    const pid = slotToPlayer.get(slot);
    if (!pid) continue;
    players.push({
      player_id: pid,
      name: nameById.get(pid) ?? 'Spieler',
      slot,
    });
  }

  const { data: matchRow } = await supabase
    .from('matches')
    .select('u11_formation_id')
    .eq('id', matchId)
    .maybeSingle();

  const rawFormation = (matchRow as { u11_formation_id?: string | null } | null)?.u11_formation_id;
  const formation = isU11FormationId(rawFormation) ? (rawFormation as U11FormationId) : null;

  return { fieldCount, players, formation };
}

/**
 * Idempotent: höchstens ein Aufstellungs-Feedpost pro Match (dedupe_key lineup_feed:match_id).
 */
export async function ensureLineupFeedPostForMatch(
  matchId: string,
  now: Date = new Date(),
): Promise<EnsureLineupFeedPostResult> {
  const mid = matchId?.trim();
  if (!mid) return { ok: false, error: 'Keine Match-ID.' };

  const dedupe_key = dedupeKeyForLineupMatch(mid);

  if (await isDedupeSuppressed(dedupe_key)) {
    luLog('skip: suppressed', { matchId: mid, dedupe_key });
    return { ok: true, created: false, reason: 'suppressed' };
  }

  const { data: existing, error: exErr } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();
  if (exErr) return { ok: false, error: exErr.message };
  if (existing?.id) return { ok: true, created: false, reason: 'already_exists' };

  const { data: match, error: matchErr } = await fetchMatchById(mid);
  if (matchErr) return { ok: false, error: matchErr };
  if (!match) return { ok: false, error: 'Spiel nicht gefunden.' };

  const status = (match.status ?? '').toLowerCase();
  if (status !== 'upcoming') {
    luLog('skip: not_upcoming', { matchId: mid, status });
    return { ok: true, created: false, reason: 'not_upcoming' };
  }

  const lineupData = await fetchLineupPlayers(mid);
  if (!lineupData) return { ok: false, error: 'Aufstellung konnte nicht geladen werden.' };
  if (lineupData.fieldCount < MIN_FIELD_PLAYERS || lineupData.players.length === 0) {
    luLog('skip: insufficient_lineup', { matchId: mid, fieldCount: lineupData.fieldCount });
    return { ok: true, created: false, reason: 'insufficient_lineup' };
  }

  const teamSeasonId = match.team_season_id?.trim();
  if (!teamSeasonId) return { ok: false, error: 'Keine team_season_id am Spiel.' };

  const { data: evRaw, error: evErr } = await supabase
    .from('events')
    .select('id, starts_at')
    .eq('match_id', mid)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (evErr) luLog('events lookup warning', { matchId: mid, error: evErr.message });
  const eventId = (evRaw as { id?: string } | null)?.id?.trim() ?? '';
  if (!eventId) return { ok: false, error: 'Kein Event zum Spiel verknüpft.' };

  const starts_at =
    (evRaw as { starts_at?: string | null } | null)?.starts_at?.trim() ||
    match.match_date?.trim() ||
    '';
  if (!starts_at) {
    luLog('skip: no_kickoff', { matchId: mid });
    return { ok: true, created: false, reason: 'no_kickoff' };
  }

  const minutesLeft = minutesUntilKickoff(starts_at, now);
  if (minutesLeft == null) {
    return { ok: true, created: false, reason: 'invalid_kickoff' };
  }
  if (minutesLeft < 0 || minutesLeft > MAX_MINUTES_BEFORE_KICKOFF) {
    luLog('skip: outside_window', { matchId: mid, minutesLeft });
    return { ok: true, created: false, reason: 'outside_window' };
  }

  const teamInfo = await resolveTeamForSeason(teamSeasonId);
  if (!teamInfo) return { ok: false, error: 'Team zur Saison nicht gefunden.' };

  const deep_link = `/app/match/${encodeURIComponent(mid)}`;

  const payload: LineupFeedPayload = {
    match_id: mid,
    event_id: eventId,
    team_season_id: teamSeasonId,
    formation: lineupData.formation,
    lineup_players: lineupData.players,
    starts_at,
    deep_link,
  };

  const caption = buildAutoLineupFeedCaption({
    formation: lineupData.formation,
    startsAtIso: starts_at,
  });

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id ?? null;

  const { error: insErr } = await supabase.from('team_feed_posts').insert({
    team_season_id: teamSeasonId,
    team_id: teamInfo.teamId,
    event_id: eventId,
    post_kind: 'lineup_auto',
    caption,
    payload,
    dedupe_key,
    media_type: 'lineup',
    media_url: null,
    thumbnail_url: null,
    duration_seconds: null,
    created_by: uid,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return { ok: true, created: false, reason: 'duplicate_race' };
    }
    return { ok: false, error: insErr.message };
  }

  luLog('created', { matchId: mid, dedupe_key, eventId });
  return { ok: true, created: true };
}

export type EnsureLineupFeedPostsForSeasonResult = {
  scanned: number;
  created: number;
  skipped: number;
  errors: string[];
};

/** Beim Feed-Laden: Aufstellungs-Posts für Spiele in den nächsten 90 Minuten sicherstellen. */
export async function ensureLineupFeedPostsForSeason(
  teamSeasonId: string,
  now: Date = new Date(),
): Promise<EnsureLineupFeedPostsForSeasonResult> {
  const sid = teamSeasonId?.trim();
  const result: EnsureLineupFeedPostsForSeasonResult = {
    scanned: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };
  if (!sid) return result;

  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('team_season_id', sid)
    .eq('status', 'upcoming');

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  for (const row of data ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (!id) continue;
    result.scanned += 1;
    const res = await ensureLineupFeedPostForMatch(id, now);
    if (!res.ok) {
      result.errors.push(`${id}: ${res.error}`);
      continue;
    }
    if (res.created) result.created += 1;
    else result.skipped += 1;
  }

  luLog('batch done', result);
  return result;
}
