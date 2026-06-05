import { supabase } from './supabaseClient';
import { fetchLineupForLiveMatch, fetchMatchById, LIVE_FIELD_SLOT_ORDER } from './liveMatchService';
import { isU11FormationId, type U11FormationId } from './matchFormations';
import type { FieldSlotId } from '../types/match';
import { premiumPlayerDisplayName } from './premiumPlayerCard';
import {
  buildAutoLineupFeedCaption,
  dedupeKeyForLineupMatch,
  lineupFeedFriendlyPositionLabel,
  sanitizeLineupFeedPlayerName,
  type LineupFeedPayload,
  type LineupFeedPlayer,
} from './lineupFeedTypes';
import { lineupFeedDevLog, lineupFeedDevWarn } from './lineupFeedDebug';

export type EnsureLineupFeedPostResult =
  | { ok: true; created: boolean; reason?: string }
  | { ok: false; error: string };

const MIN_FIELD_PLAYERS = 5;
/** Auto-Post im 60-Minuten-Fenster vor Anpfiff (Anpfiff muss in der Zukunft liegen). */
const MAX_MINUTES_BEFORE_KICKOFF = 60;

const FINISHED_MATCH_STATUSES = new Set(['ended', 'finished', 'completed']);

export type LineupFeedAllowedWindow = 'pre_kickoff_60' | 'live' | 'blocked';

function minutesUntilKickoff(startsAtIso: string, now: Date): number | null {
  const kick = new Date(startsAtIso);
  if (Number.isNaN(kick.getTime())) return null;
  return (kick.getTime() - now.getTime()) / 60_000;
}

function minutesSinceKickoff(startsAtIso: string, now: Date): number | null {
  const kick = new Date(startsAtIso);
  if (Number.isNaN(kick.getTime())) return null;
  return (now.getTime() - kick.getTime()) / 60_000;
}

function evaluateLineupFeedWindow(params: {
  status: string;
  minutesUntilKickoff: number | null;
  minutesSinceKickoff: number | null;
}): { allowed: boolean; allowedWindow: LineupFeedAllowedWindow; reason: string } {
  const status = params.status.toLowerCase();

  if (FINISHED_MATCH_STATUSES.has(status)) {
    return { allowed: false, allowedWindow: 'blocked', reason: 'match_finished' };
  }

  if (status === 'upcoming') {
    const minutesLeft = params.minutesUntilKickoff;
    if (minutesLeft != null && minutesLeft > 0 && minutesLeft <= MAX_MINUTES_BEFORE_KICKOFF) {
      return { allowed: true, allowedWindow: 'pre_kickoff_60', reason: 'pre_kickoff_window' };
    }
    if (minutesLeft != null && minutesLeft <= 0) {
      return { allowed: false, allowedWindow: 'blocked', reason: 'kickoff_started_not_live' };
    }
    return { allowed: false, allowedWindow: 'blocked', reason: 'outside_pre_kickoff_window' };
  }

  if (status === 'live') {
    return { allowed: true, allowedWindow: 'live', reason: 'live_status_allowed' };
  }

  return { allowed: false, allowedWindow: 'blocked', reason: `status_${status || 'unknown'}` };
}

function lineupFeedWindowLog(
  reason: string,
  details: Record<string, unknown> & {
    matchStatus?: string;
    minutesUntilKickoff?: number | null;
    minutesSinceKickoff?: number | null;
    allowedWindow?: LineupFeedAllowedWindow;
  },
): void {
  lineupFeedDevLog('[LINEUP FEED]', {
    reason,
    'match.status': details.matchStatus ?? details.match_status,
    minutesUntilKickoff: details.minutesUntilKickoff ?? null,
    minutesSinceKickoff: details.minutesSinceKickoff ?? null,
    allowedWindow: details.allowedWindow ?? 'blocked',
    ...details,
  });
}

function luLog(phase: string, data: Record<string, unknown>): void {
  if (import.meta.env.DEV) console.info(`[lineupFeed] ${phase}`, data);
}

function lineupFeedExit(reason: string, details: Record<string, unknown> = {}): void {
  lineupFeedWindowLog(reason, {
    matchFound: details.matchFound,
    matchId: details.matchId,
    eventId: details.eventId,
    teamSeasonId: details.teamSeasonId,
    matchStatus: details.matchStatus,
    kickoff: details.kickoff,
    minutesUntilKickoff: details.minutesUntilKickoff as number | null | undefined,
    minutesSinceKickoff: details.minutesSinceKickoff as number | null | undefined,
    allowedWindow: details.allowedWindow as LineupFeedAllowedWindow | undefined,
    lineupPlayerCount: details.lineupPlayerCount,
    fieldPlayerCount: details.fieldPlayerCount,
    formationFound: details.formationFound,
    dedupeKey: details.dedupeKey,
    dedupeKeyExists: details.dedupeKeyExists,
    suppressionExists: details.suppressionExists,
    ensureCalled: details.ensureCalled ?? true,
    ...details,
  });
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

export type SavedLineupFeedSource = 'match_lineup' | 'match_lineup_slots';

/** Gleiche Slot-Zuordnung wie MatchLineupPage / fetchLineupForLiveMatch. */
function slotMapFromLineupRows(
  lineupRows: Array<{ player_id: string | null; slot?: string | null }>,
): Map<FieldSlotId, string> {
  const bySlot: Partial<Record<FieldSlotId, string>> = {};
  for (const row of lineupRows) {
    const slotRaw = String(row.slot ?? '').trim().toUpperCase();
    const slot = slotRaw as FieldSlotId;
    const pid = typeof row.player_id === 'string' && row.player_id.length > 0 ? row.player_id.trim() : '';
    if (!pid || LIVE_FIELD_SLOT_ORDER.indexOf(slot) === -1) continue;
    bySlot[slot] = pid;
  }
  const seenOnField = new Set<string>();
  const out = new Map<FieldSlotId, string>();
  for (const s of LIVE_FIELD_SLOT_ORDER) {
    const pid = bySlot[s]?.trim() ?? '';
    if (!pid || seenOnField.has(pid)) continue;
    seenOnField.add(pid);
    out.set(s, pid);
  }
  return out;
}

function countFieldPlayersFromSlotMap(slotToPlayer: Map<FieldSlotId, string>): number {
  let n = 0;
  for (const slot of LIVE_FIELD_SLOT_ORDER) {
    if (slot === 'GK') continue;
    if (slotToPlayer.get(slot)) n += 1;
  }
  return n;
}

function lineupCountDiagnostics(slotToPlayer: Map<FieldSlotId, string>): {
  totalPlayers: number;
  fieldPlayers: number;
  goalkeeperCount: number;
  detectedPositions: Array<{ slot: FieldSlotId; playerId: string }>;
} {
  const detectedPositions: Array<{ slot: FieldSlotId; playerId: string }> = [];
  for (const slot of LIVE_FIELD_SLOT_ORDER) {
    const playerId = slotToPlayer.get(slot)?.trim() ?? '';
    if (!playerId) continue;
    detectedPositions.push({ slot, playerId });
  }
  return {
    totalPlayers: detectedPositions.length,
    fieldPlayers: countFieldPlayersFromSlotMap(slotToPlayer),
    goalkeeperCount: slotToPlayer.get('GK') ? 1 : 0,
    detectedPositions,
  };
}

function logLineupCountDiagnostics(
  matchId: string,
  source: string,
  counts: ReturnType<typeof lineupCountDiagnostics>,
  feedPlayersLength: number,
): void {
  lineupFeedDevWarn('[LINEUP FEED] lineup-count', {
    matchId,
    source,
    totalPlayers: counts.totalPlayers,
    fieldPlayers: counts.fieldPlayers,
    goalkeeperCount: counts.goalkeeperCount,
    feedPlayersLength,
    detectedPositions: counts.detectedPositions,
    minFieldPlayersRequired: MIN_FIELD_PLAYERS,
  });
}

async function fetchFormationForMatch(matchId: string): Promise<U11FormationId | null> {
  const { data: matchRow } = await supabase
    .from('matches')
    .select('u11_formation_id')
    .eq('id', matchId)
    .maybeSingle();
  const rawFormation = (matchRow as { u11_formation_id?: string | null } | null)?.u11_formation_id;
  return isU11FormationId(rawFormation) ? rawFormation : null;
}

function lineupFeedPlayerNameFromDb(playerId: string, nameById: Map<string, string>): string {
  const raw = nameById.get(playerId)?.trim() ?? '';
  return sanitizeLineupFeedPlayerName(raw, null);
}

function buildLineupFeedPlayersFromSlotMapSync(
  slotToPlayer: Map<FieldSlotId, string>,
  _formation: U11FormationId | null,
  nameById: Map<string, string> = new Map(),
): LineupFeedPlayer[] {
  const players: LineupFeedPlayer[] = [];
  for (const fieldSlot of LIVE_FIELD_SLOT_ORDER) {
    const pid = slotToPlayer.get(fieldSlot)?.trim();
    if (!pid) continue;
    const positionLabel = lineupFeedFriendlyPositionLabel(fieldSlot);
    const playerName = lineupFeedPlayerNameFromDb(pid, nameById);
    players.push({
      player_id: pid,
      slot: fieldSlot,
      positionLabel,
      playerName,
      name: playerName,
    });
  }
  return players;
}

async function buildLineupFeedPlayersFromSlotMap(
  slotToPlayer: Map<FieldSlotId, string>,
  formation: U11FormationId | null,
): Promise<LineupFeedPlayer[]> {
  const orderedIds = LIVE_FIELD_SLOT_ORDER.map((slot) => slotToPlayer.get(slot) ?? null).filter(
    (id): id is string => Boolean(id),
  );
  if (orderedIds.length === 0) return [];

  const nameById = new Map<string, string>();
  const { data: playerRows, error: playersErr } = await supabase
    .from('players')
    .select('id, first_name, last_name, display_name, name')
    .in('id', orderedIds);

  if (playersErr) {
    luLog('players load error', { error: playersErr.message });
  } else {
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
  }

  return buildLineupFeedPlayersFromSlotMapSync(slotToPlayer, formation, nameById);
}

/**
 * Liest die gespeicherte Aufstellung wie MatchLineupPage (fetchLineupForLiveMatch → match_lineup),
 * optional Fallback match_lineup_slots falls die Tabelle Daten hat.
 */
async function fetchSavedLineupForFeedPost(matchId: string): Promise<{
  source: SavedLineupFeedSource;
  rawLineupCount: number;
  fieldCount: number;
  playerNames: string[];
  players: LineupFeedPlayer[];
  formation: U11FormationId | null;
  lineupCounts: ReturnType<typeof lineupCountDiagnostics>;
} | null> {
  let source: SavedLineupFeedSource = 'match_lineup';
  let slotToPlayer = new Map<FieldSlotId, string>();

  const { data: lineupLoad, error: lineupLoadErr } = await fetchLineupForLiveMatch(matchId);
  if (lineupLoadErr) {
    lineupFeedExit('lineup load error', { matchId, matchFound: true, source, error: lineupLoadErr });
    luLog('lineup load error', { matchId, error: lineupLoadErr });
  } else {
    for (let i = 0; i < LIVE_FIELD_SLOT_ORDER.length; i += 1) {
      const pid = lineupLoad.startingPlayerIds[i]?.trim() ?? '';
      if (pid) slotToPlayer.set(LIVE_FIELD_SLOT_ORDER[i], pid);
    }
  }

  let rawLineupCount = slotToPlayer.size;
  let fieldCount = countFieldPlayersFromSlotMap(slotToPlayer);

  if (fieldCount < MIN_FIELD_PLAYERS) {
    const { data: slotRows, error: slotsErr } = await supabase
      .from('match_lineup_slots')
      .select('player_id, slot')
      .eq('match_id', matchId);

    if (!slotsErr && (slotRows ?? []).length > 0) {
      const altMap = slotMapFromLineupRows(
        (slotRows ?? []) as Array<{ player_id: string | null; slot?: string | null }>,
      );
      const altField = countFieldPlayersFromSlotMap(altMap);
      if (altField > fieldCount) {
        source = 'match_lineup_slots';
        slotToPlayer = altMap;
        rawLineupCount = altMap.size;
        fieldCount = altField;
      }
    }
  }

  const lineupCounts = lineupCountDiagnostics(slotToPlayer);

  const playerNames: string[] = [];
  const formation = await fetchFormationForMatch(matchId);
  let players = await buildLineupFeedPlayersFromSlotMap(slotToPlayer, formation);
  if (players.length === 0 && fieldCount >= MIN_FIELD_PLAYERS) {
    players = buildLineupFeedPlayersFromSlotMapSync(slotToPlayer, formation);
    luLog('feed players fallback from slot map', { matchId, count: players.length });
  }
  logLineupCountDiagnostics(matchId, source, lineupCounts, players.length);
  for (const p of players) {
    if (p.name) playerNames.push(p.name);
  }

  lineupFeedDevLog('[LINEUP FEED]', 'saved lineup loaded', {
    matchId,
    source,
    rawLineupCount,
    fieldPlayerCount: fieldCount,
    playerNames,
  });

  if (lineupLoadErr && fieldCount < MIN_FIELD_PLAYERS) {
    return null;
  }

  return {
    source,
    rawLineupCount,
    fieldCount,
    playerNames,
    players,
    formation,
    lineupCounts,
  };
}

/**
 * Idempotent: höchstens ein Aufstellungs-Feedpost pro Match (dedupe_key lineup_feed:match_id).
 */
export async function ensureLineupFeedPostForMatch(
  matchId: string,
  now: Date = new Date(),
): Promise<EnsureLineupFeedPostResult> {
  const mid = matchId?.trim();
  lineupFeedExit('ensureLineupFeedPostForMatch called', {
    matchId: mid || null,
    ensureCalled: true,
  });
  if (!mid) {
    lineupFeedExit('missing match id', { matchId: null, matchFound: false, ensureCalled: true });
    return { ok: false, error: 'Keine Match-ID.' };
  }

  const dedupe_key = dedupeKeyForLineupMatch(mid);

  const suppressionExists = await isDedupeSuppressed(dedupe_key);
  lineupFeedDevLog('[LINEUP FEED]', 'suppression check', {
    matchId: mid,
    dedupeKey: dedupe_key,
    suppressionExists,
  });
  if (suppressionExists) {
    lineupFeedExit('suppression exists', {
      matchId: mid,
      dedupeKey: dedupe_key,
      suppressionExists: true,
      dedupeKeyExists: false,
    });
    luLog('skip: suppressed', { matchId: mid, dedupe_key });
    return { ok: true, created: false, reason: 'suppressed' };
  }

  const { data: existing, error: exErr } = await supabase
    .from('team_feed_posts')
    .select('id')
    .eq('dedupe_key', dedupe_key)
    .maybeSingle();
  const dedupeKeyExists = Boolean(existing?.id);
  lineupFeedDevLog('[LINEUP FEED]', 'dedupe check', {
    matchId: mid,
    dedupeKey: dedupe_key,
    dedupeKeyExists,
    suppressionExists: false,
  });
  if (exErr) {
    lineupFeedExit('dedupe lookup error', {
      matchId: mid,
      dedupeKey: dedupe_key,
      dedupeKeyExists: false,
      error: exErr.message,
    });
    return { ok: false, error: exErr.message };
  }
  if (existing?.id) {
    lineupFeedExit('dedupe exists', {
      matchId: mid,
      dedupeKey: dedupe_key,
      dedupeKeyExists: true,
      suppressionExists: false,
    });
    return { ok: true, created: false, reason: 'already_exists' };
  }

  const { data: match, error: matchErr } = await fetchMatchById(mid);
  if (matchErr) {
    lineupFeedExit('match load error', {
      matchId: mid,
      matchFound: false,
      dedupeKey: dedupe_key,
      error: matchErr,
    });
    return { ok: false, error: matchErr };
  }
  if (!match) {
    lineupFeedExit('missing match', {
      matchId: mid,
      matchFound: false,
      dedupeKey: dedupe_key,
    });
    return { ok: false, error: 'Spiel nicht gefunden.' };
  }

  const status = (match.status ?? '').toLowerCase();
  const teamSeasonIdEarly = match.team_season_id?.trim() ?? '';

  if (FINISHED_MATCH_STATUSES.has(status)) {
    lineupFeedExit('match finished', {
      matchFound: true,
      matchId: mid,
      teamSeasonId: teamSeasonIdEarly || null,
      matchStatus: status,
      dedupeKey: dedupe_key,
      kickoff: match.match_date ?? null,
      allowedWindow: 'blocked',
      reason: 'match_finished',
    });
    luLog('skip: match_finished', { matchId: mid, status });
    return { ok: true, created: false, reason: 'match_finished' };
  }

  const { data: evRaw, error: evErr } = await supabase
    .from('events')
    .select('id, starts_at')
    .eq('match_id', mid)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (evErr) luLog('events lookup warning', { matchId: mid, error: evErr.message });
  const eventId = (evRaw as { id?: string } | null)?.id?.trim() ?? '';
  if (!eventId) {
    lineupFeedExit('missing event — using match fallback', {
      matchFound: true,
      matchId: mid,
      eventId: null,
      teamSeasonId: teamSeasonIdEarly || null,
      matchStatus: status,
      dedupeKey: dedupe_key,
      reason: 'event_fallback',
    });
  }

  const starts_at =
    (evRaw as { starts_at?: string | null } | null)?.starts_at?.trim() ||
    match.match_date?.trim() ||
    '';
  if (!starts_at) {
    lineupFeedExit('no kickoff', {
      matchFound: true,
      matchId: mid,
      eventId,
      teamSeasonId: teamSeasonIdEarly || null,
      matchStatus: status,
      kickoff: null,
      dedupeKey: dedupe_key,
      allowedWindow: 'blocked',
    });
    luLog('skip: no_kickoff', { matchId: mid });
    return { ok: true, created: false, reason: 'no_kickoff' };
  }

  const minutesLeft = minutesUntilKickoff(starts_at, now);
  const minutesSince = minutesSinceKickoff(starts_at, now);
  if (minutesLeft == null || minutesSince == null) {
    lineupFeedExit('invalid kickoff', {
      matchFound: true,
      matchId: mid,
      eventId,
      teamSeasonId: teamSeasonIdEarly || null,
      matchStatus: status,
      kickoff: starts_at,
      minutesUntilKickoff: minutesLeft,
      minutesSinceKickoff: minutesSince,
      allowedWindow: 'blocked',
      dedupeKey: dedupe_key,
    });
    return { ok: true, created: false, reason: 'invalid_kickoff' };
  }

  const windowEval = evaluateLineupFeedWindow({
    status,
    minutesUntilKickoff: minutesLeft,
    minutesSinceKickoff: minutesSince,
  });
  if (!windowEval.allowed) {
    lineupFeedExit(windowEval.reason, {
      matchFound: true,
      matchId: mid,
      eventId,
      teamSeasonId: teamSeasonIdEarly || null,
      matchStatus: status,
      kickoff: starts_at,
      minutesUntilKickoff: minutesLeft,
      minutesSinceKickoff: minutesSince,
      allowedWindow: windowEval.allowedWindow,
      dedupeKey: dedupe_key,
      reason: windowEval.reason,
    });
    luLog('skip: outside_window', {
      matchId: mid,
      minutesLeft,
      minutesSince,
      allowedWindow: windowEval.allowedWindow,
      reason: windowEval.reason,
    });
    return { ok: true, created: false, reason: windowEval.reason };
  }

  const lineupData = await fetchSavedLineupForFeedPost(mid);
  if (!lineupData) {
    lineupFeedExit('lineup could not be loaded', {
      matchFound: true,
      matchId: mid,
      teamSeasonId: teamSeasonIdEarly || null,
      matchStatus: status,
      dedupeKey: dedupe_key,
      reason: 'lineup_load_failed',
    });
    return { ok: false, error: 'Aufstellung konnte nicht geladen werden.' };
  }
  if (lineupData.fieldCount < MIN_FIELD_PLAYERS) {
    lineupFeedDevWarn('[LINEUP FEED] lineup-count', {
      matchId: mid,
      blockedReason: 'insufficient_lineup',
      source: lineupData.source,
      totalPlayers: lineupData.lineupCounts.totalPlayers,
      fieldPlayers: lineupData.lineupCounts.fieldPlayers,
      goalkeeperCount: lineupData.lineupCounts.goalkeeperCount,
      feedPlayersLength: lineupData.players.length,
      detectedPositions: lineupData.lineupCounts.detectedPositions,
      minFieldPlayersRequired: MIN_FIELD_PLAYERS,
    });
    lineupFeedExit('not enough field players', {
      matchFound: true,
      matchId: mid,
      teamSeasonId: teamSeasonIdEarly || null,
      matchStatus: status,
      source: lineupData.source,
      rawLineupCount: lineupData.rawLineupCount,
      fieldPlayerCount: lineupData.fieldCount,
      playerNames: lineupData.playerNames,
      formationFound: Boolean(lineupData.formation),
      dedupeKey: dedupe_key,
      reason: 'insufficient_lineup',
    });
    luLog('skip: insufficient_lineup', {
      matchId: mid,
      fieldCount: lineupData.fieldCount,
      source: lineupData.source,
    });
    return { ok: true, created: false, reason: 'insufficient_lineup' };
  }

  const teamSeasonId = match.team_season_id?.trim();
  if (!teamSeasonId) {
    lineupFeedExit('missing team season', {
      matchFound: true,
      matchId: mid,
      matchStatus: status,
      fieldPlayerCount: lineupData.fieldCount,
      formationFound: Boolean(lineupData.formation),
      dedupeKey: dedupe_key,
    });
    return { ok: false, error: 'Keine team_season_id am Spiel.' };
  }

  const teamInfo = await resolveTeamForSeason(teamSeasonId);
  let teamId = teamInfo?.teamId ?? '';
  let teamName = teamInfo?.name ?? 'Unser Team';
  if (!teamId) {
    const { data: tsMin } = await supabase
      .from('team_seasons')
      .select('team_id')
      .eq('id', teamSeasonId)
      .maybeSingle();
    teamId = (tsMin as { team_id?: string | null } | null)?.team_id?.trim() ?? '';
    if (!teamInfo && teamId) {
      const { data: teamRow } = await supabase.from('teams').select('name').eq('id', teamId).maybeSingle();
      const n = (teamRow as { name?: string | null } | null)?.name;
      if (n != null && String(n).trim()) teamName = String(n).trim();
    }
  }
  if (!teamId) {
    lineupFeedExit('missing team id — cannot insert feed post', {
      matchFound: true,
      matchId: mid,
      eventId: eventId || null,
      teamSeasonId,
      matchStatus: status,
      source: lineupData.source,
      fieldPlayerCount: lineupData.fieldCount,
      dedupeKey: dedupe_key,
      reason: 'missing_team_id',
    });
    return { ok: false, error: 'Team zur Saison nicht gefunden.' };
  }

  const deep_link = `/app/match/${encodeURIComponent(mid)}`;

  const slotToPlayer = new Map<FieldSlotId, string>();
  for (const pos of lineupData.lineupCounts.detectedPositions) {
    slotToPlayer.set(pos.slot, pos.playerId);
  }
  const feedPlayers = await buildLineupFeedPlayersFromSlotMap(slotToPlayer, lineupData.formation);

  for (const pl of feedPlayers) {
    lineupFeedDevWarn('[LINEUP FEED] player payload', {
      slot: pl.slot,
      positionLabel: pl.positionLabel,
      playerName: pl.playerName,
      player_id: pl.player_id,
    });
  }

  const payload: LineupFeedPayload = {
    match_id: mid,
    event_id: eventId,
    team_season_id: teamSeasonId,
    formation: lineupData.formation,
    lineup_players: feedPlayers,
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
    team_id: teamId,
    event_id: eventId || null,
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
      lineupFeedExit('dedupe exists race', {
        matchFound: true,
        matchId: mid,
        eventId,
        teamSeasonId,
        matchStatus: status,
        kickoff: starts_at,
        minutesUntilKickoff: minutesLeft,
        fieldPlayerCount: lineupData.fieldCount,
        formationFound: Boolean(lineupData.formation),
        dedupeKey: dedupe_key,
        dedupeKeyExists: true,
      });
      return { ok: true, created: false, reason: 'duplicate_race' };
    }
    lineupFeedExit('insert error', {
      matchFound: true,
      matchId: mid,
      eventId,
      teamSeasonId,
      error: insErr.message,
      dedupeKey: dedupe_key,
    });
    return { ok: false, error: insErr.message };
  }

  lineupFeedExit('post created', {
    matchFound: true,
    matchId: mid,
    eventId: eventId || null,
    teamSeasonId,
    teamName,
    matchStatus: status,
    kickoff: starts_at,
    minutesUntilKickoff: minutesLeft,
    minutesSinceKickoff: minutesSince,
    allowedWindow: windowEval.allowedWindow,
    source: lineupData.source,
    rawLineupCount: lineupData.rawLineupCount,
    fieldPlayerCount: lineupData.fieldCount,
    playerNames: lineupData.playerNames,
    formationFound: Boolean(lineupData.formation),
    dedupeKey: dedupe_key,
    dedupeKeyExists: false,
    suppressionExists: false,
    reason: 'created',
  });
  luLog('created', { matchId: mid, dedupe_key, eventId });
  return { ok: true, created: true };
}

/** Nach erfolgreichem Aufstellungs-Save: Feed-Post anstoßen (Fehler blockieren Speichern nicht). */
export async function triggerLineupFeedPostAfterSave(matchId: string): Promise<void> {
  const mid = matchId?.trim();
  lineupFeedDevWarn('[LINEUP FEED] save-trigger start', { matchId: mid ?? matchId });
  if (!mid) {
    lineupFeedDevWarn('[LINEUP FEED] save-trigger error', { matchId, error: 'missing match id' });
    return;
  }
  try {
    const result = await ensureLineupFeedPostForMatch(mid);
    lineupFeedDevWarn('[LINEUP FEED] save-trigger result', { matchId: mid, result });
  } catch (error) {
    lineupFeedDevWarn('[LINEUP FEED] save-trigger error', {
      matchId: mid,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export type EnsureLineupFeedPostsForSeasonResult = {
  scanned: number;
  created: number;
  skipped: number;
  errors: string[];
};

/** Beim Feed-Laden: Aufstellungs-Posts für upcoming (60-Min-Fenster) oder live Spiele sicherstellen. */
export async function ensureLineupFeedPostsForSeason(
  teamSeasonId: string,
  now: Date = new Date(),
): Promise<EnsureLineupFeedPostsForSeasonResult> {
  lineupFeedDevLog('[LINEUP FEED] season scan start', { teamSeasonId });
  const sid = teamSeasonId?.trim();
  const result: EnsureLineupFeedPostsForSeasonResult = {
    scanned: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };
  if (!sid) {
    lineupFeedExit('ensureLineupFeedPostsForSeason skipped: missing team season', {
      teamSeasonId: sid,
      ensureCalled: true,
    });
    return result;
  }

  lineupFeedExit('ensureLineupFeedPostsForSeason called', {
    teamSeasonId: sid,
    ensureCalled: true,
  });

  const [upcomingRes, liveRes] = await Promise.all([
    supabase.from('matches').select('id').eq('team_season_id', sid).eq('status', 'upcoming'),
    supabase.from('matches').select('id').eq('team_season_id', sid).eq('status', 'live'),
  ]);

  const error = upcomingRes.error ?? liveRes.error;
  if (error) {
    lineupFeedExit('ensureLineupFeedPostsForSeason matches query error', {
      teamSeasonId: sid,
      error: error.message,
    });
    result.errors.push(error.message);
    return result;
  }

  const matchIds = new Set<string>();
  for (const row of [...(upcomingRes.data ?? []), ...(liveRes.data ?? [])]) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (id) matchIds.add(id);
  }

  lineupFeedDevLog('[LINEUP FEED]', 'candidate matches for season', {
    teamSeasonId: sid,
    upcomingCount: (upcomingRes.data ?? []).length,
    liveCount: (liveRes.data ?? []).length,
    matchCount: matchIds.size,
  });

  for (const id of matchIds) {
    result.scanned += 1;
    const res = await ensureLineupFeedPostForMatch(id, now);
    if (!res.ok) {
      lineupFeedExit('ensureLineupFeedPostForMatch failed in batch', {
        matchId: id,
        teamSeasonId: sid,
        error: res.error,
      });
      result.errors.push(`${id}: ${res.error}`);
      continue;
    }
    if (res.created) result.created += 1;
    else {
      lineupFeedExit('ensureLineupFeedPostForMatch skipped in batch', {
        matchId: id,
        teamSeasonId: sid,
        reason: res.reason ?? 'unknown',
      });
      result.skipped += 1;
    }
  }

  lineupFeedExit('ensureLineupFeedPostsForSeason finished', {
    teamSeasonId: sid,
    ...result,
  });
  return result;
}
