/**
 * Zentraler Kader-Service (STEP 4 Dual-Read / Dual-Write, STEP 5 Join-first Read).
 *
 * Source of Truth für Kaderzugehörigkeit: team_season_players (Join-first).
 * Compatibility: players.team_season_id — nur Fallback, wenn Join technisch fehlt/Hard-Disable.
 *
 * listRoster-Reihenfolge:
 * A) Join-Read versuchen (außer Hard-Disable via VITE_ROSTER_JOIN_V1=false)
 * B) bei Erfolg Join verwenden (auch Count 0 — leerer Kader ist valide)
 * C) nur bei technischem Join-Fehler → Legacy players.team_season_id
 *
 * Regel players.team_season_id bei Multi-Season (Writes/Compat):
 * - aktive Season hat Vorrang
 * - Draft überschreibt eine bestehende aktive Zuordnung NICHT
 * - sonst: Ziel-Season setzen, wenn leer oder gleich der Ziel-Season
 */
import { supabase } from './supabaseClient';
import { isRosterJoinV1HardDisabled, isRosterJoinV1Enabled } from './featureFlags';

export type RosterStatus = 'active' | 'paused' | 'archived';

export type RosterPlayer = {
  id: string;
  team_season_id: string;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number | null;
  position: string | null;
  birthdate: string | null;
  avatar_url: string | null;
  cutout_url: string | null;
  is_active: boolean;
  status: RosterStatus;
  is_laz_player: boolean;
  is_injured: boolean;
  injured_since: string | null;
  injured_until: string | null;
  display_name: string;
};

export type RosterListMode = 'active' | 'paused' | 'all';

export type CreateRosterPlayerInput = {
  teamSeasonId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string | null;
  birthdateIso: string | null;
};

export type UpdateRosterSeasonFieldsInput = {
  playerId: string;
  teamSeasonId: string;
  firstName?: string;
  lastName?: string;
  jerseyNumber?: number | null;
  position?: string | null;
  status?: RosterStatus;
  isActive?: boolean;
  isLazPlayer?: boolean;
};

function normalizeStatus(raw: string | null | undefined, isActive?: boolean | null): RosterStatus {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === 'paused' || s === 'archived') return s;
  if (s === 'active') return 'active';
  if (isActive === false) return 'paused';
  return 'active';
}

function displayName(first: string | null, last: string | null): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  return [f, l].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'Spieler';
}

function normalizeBirthdate(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  return String(raw).trim().slice(0, 10) || null;
}

/** Ob Join-Read bevorzugt wird (Hard-Disable = false). */
export function shouldUseRosterJoin(): boolean {
  return isRosterJoinV1Enabled();
}

function isJoinTechnicallyUnavailable(message: string | null | undefined): boolean {
  const m = String(message ?? '').toLowerCase();
  if (!m) return false;
  return (
    /does not exist/.test(m) ||
    /schema cache/.test(m) ||
    /could not find the table/.test(m) ||
    /relation .* does not exist/.test(m) ||
    (/team_season_players/.test(m) && /not find|unknown|missing/.test(m))
  );
}

async function enrichAvatarsAndBirthdates(
  players: RosterPlayer[],
): Promise<{ data: RosterPlayer[]; error: string | null }> {
  const playerIds = players.map((p) => p.id);
  if (playerIds.length === 0) return { data: players, error: null };

  const { data: avatarRows, error: avatarError } = await supabase
    .from('player_avatars')
    .select('player_id, avatar_url')
    .in('player_id', playerIds);
  if (avatarError) return { data: players, error: avatarError.message };

  const avatarMap = ((avatarRows ?? []) as Array<{ player_id: string; avatar_url: string | null }>).reduce<
    Record<string, string | null>
  >((acc, row) => {
    acc[row.player_id] = row.avatar_url != null ? String(row.avatar_url).trim() || null : null;
    return acc;
  }, {});

  const { data: profileRows, error: profileError } = await supabase
    .from('player_profiles')
    .select('player_id, birthdate')
    .in('player_id', playerIds);
  if (profileError) return { data: players, error: profileError.message };

  const birthMap = ((profileRows ?? []) as Array<{ player_id: string; birthdate?: string | null }>).reduce<
    Record<string, string | null>
  >((acc, row) => {
    acc[row.player_id] = normalizeBirthdate(row.birthdate ?? null);
    return acc;
  }, {});

  return {
    data: players.map((p) => ({
      ...p,
      avatar_url: avatarMap[p.id] ?? null,
      birthdate: birthMap[p.id] ?? null,
    })),
    error: null,
  };
}

async function listRosterLegacy(
  teamSeasonId: string,
  mode: RosterListMode,
): Promise<{ data: RosterPlayer[]; error: string | null }> {
  let query = supabase
    .from('players')
    .select(
      'id, team_season_id, first_name, last_name, jersey_number, position, is_active, status, is_laz_player, is_injured, injured_since, injured_until, cutout_url',
    )
    .eq('team_season_id', teamSeasonId);

  if (mode === 'active') {
    query = query.or('status.eq.active,and(status.is.null,is_active.eq.true)');
  } else if (mode === 'paused') {
    query = query.eq('status', 'paused');
  }

  const { data, error } = await query
    .order('jersey_number', { ascending: true, nullsFirst: false })
    .order('last_name', { ascending: true, nullsFirst: false })
    .order('first_name', { ascending: true, nullsFirst: false });

  if (error) return { data: [], error: error.message };

  const base: RosterPlayer[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const first = row.first_name != null ? String(row.first_name) : null;
    const last = row.last_name != null ? String(row.last_name) : null;
    const status = normalizeStatus(
      row.status != null ? String(row.status) : null,
      row.is_active as boolean | null | undefined,
    );
    return {
      id: String(row.id),
      team_season_id: String(row.team_season_id),
      first_name: first,
      last_name: last,
      jersey_number: row.jersey_number != null ? Number(row.jersey_number) : null,
      position: row.position != null ? String(row.position).trim() || null : null,
      birthdate: null,
      avatar_url: null,
      cutout_url: row.cutout_url != null ? String(row.cutout_url).trim() || null : null,
      is_active: row.is_active !== false,
      status,
      is_laz_player: row.is_laz_player === true,
      is_injured: row.is_injured === true,
      injured_since: row.injured_since != null ? String(row.injured_since) : null,
      injured_until: row.injured_until != null ? String(row.injured_until) : null,
      display_name: displayName(first, last),
    };
  });

  return enrichAvatarsAndBirthdates(base);
}

async function listRosterJoin(
  teamSeasonId: string,
  mode: RosterListMode,
): Promise<{ data: RosterPlayer[]; error: string | null }> {
  let query = supabase
    .from('team_season_players')
    .select(
      [
        'id',
        'team_season_id',
        'player_id',
        'jersey_number',
        'position',
        'status',
        'is_active',
        'is_laz_player',
        'players:players ( id, first_name, last_name, cutout_url, is_injured, injured_since, injured_until )',
      ].join(', '),
    )
    .eq('team_season_id', teamSeasonId);

  if (mode === 'active') {
    query = query.or('status.eq.active,and(status.is.null,is_active.eq.true)');
  } else if (mode === 'paused') {
    query = query.eq('status', 'paused');
  }

  const { data, error } = await query
    .order('jersey_number', { ascending: true, nullsFirst: false });

  if (error) return { data: [], error: error.message };

  const mapped: RosterPlayer[] = [];
  for (const raw of (data ?? []) as unknown[]) {
    const row = raw as Record<string, unknown>;
    const pRaw = row.players;
    const p = (Array.isArray(pRaw) ? pRaw[0] : pRaw) as Record<string, unknown> | null | undefined;
    if (!p?.id && !row.player_id) continue;
    const first = p?.first_name != null ? String(p.first_name) : null;
    const last = p?.last_name != null ? String(p.last_name) : null;
    const status = normalizeStatus(
      row.status != null ? String(row.status) : null,
      row.is_active as boolean | null | undefined,
    );
    mapped.push({
      id: String(p?.id ?? row.player_id),
      team_season_id: String(row.team_season_id),
      first_name: first,
      last_name: last,
      jersey_number: row.jersey_number != null ? Number(row.jersey_number) : null,
      position: row.position != null ? String(row.position).trim() || null : null,
      birthdate: null,
      avatar_url: null,
      cutout_url: p?.cutout_url != null ? String(p.cutout_url).trim() || null : null,
      is_active: row.is_active !== false,
      status,
      is_laz_player: row.is_laz_player === true,
      is_injured: p?.is_injured === true,
      injured_since: p?.injured_since != null ? String(p.injured_since) : null,
      injured_until: p?.injured_until != null ? String(p.injured_until) : null,
      display_name: displayName(first, last),
    });
  }

  mapped.sort((a, b) => {
    const ja = a.jersey_number;
    const jb = b.jersey_number;
    if (ja != null && jb != null && ja !== jb) return ja - jb;
    if (ja != null && jb == null) return -1;
    if (ja == null && jb != null) return 1;
    const ln = (a.last_name ?? '').localeCompare(b.last_name ?? '', 'de');
    if (ln !== 0) return ln;
    return (a.first_name ?? '').localeCompare(b.first_name ?? '', 'de');
  });

  return enrichAvatarsAndBirthdates(mapped);
}

/**
 * Zentraler Kader-Reader. UI soll nur diese Funktion / usePlayers nutzen.
 * Join-first: historische Soft-Lock-Kader bleiben sichtbar, auch wenn Compat auf die neue Season zeigt.
 */
export async function listRoster(
  teamSeasonId: string,
  mode: RosterListMode = 'active',
): Promise<{ data: RosterPlayer[]; error: string | null; source: 'join' | 'legacy' }> {
  const sid = teamSeasonId?.trim();
  if (!sid) return { data: [], error: 'Keine Mannschaft gewählt.', source: 'legacy' };

  // Notfall-Rollback nur über Build-Env — nicht via Browser-localStorage
  if (isRosterJoinV1HardDisabled()) {
    const res = await listRosterLegacy(sid, mode);
    return { ...res, source: 'legacy' };
  }

  // A/B: Join versuchen; Erfolg (auch Count 0) ist maßgeblich
  const joinRes = await listRosterJoin(sid, mode);
  if (!joinRes.error) {
    return { ...joinRes, source: 'join' };
  }

  // C: nur wenn Join-Struktur technisch fehlt → Legacy Compatibility
  if (isJoinTechnicallyUnavailable(joinRes.error)) {
    const legacyRes = await listRosterLegacy(sid, mode);
    return { ...legacyRes, source: 'legacy' };
  }

  return { ...joinRes, source: 'join' };
}

/**
 * Vergleich Legacy vs Join für Staging-Validierung (beide Pfade, unabhängig vom Flag).
 */
export async function compareRosterPaths(
  teamSeasonId: string,
  mode: RosterListMode = 'all',
): Promise<{
  match: boolean;
  legacyCount: number;
  joinCount: number;
  mismatches: string[];
  error: string | null;
}> {
  const [legacy, join] = await Promise.all([
    listRosterLegacy(teamSeasonId, mode),
    listRosterJoin(teamSeasonId, mode),
  ]);
  if (legacy.error || join.error) {
    return {
      match: false,
      legacyCount: legacy.data.length,
      joinCount: join.data.length,
      mismatches: [],
      error: legacy.error ?? join.error,
    };
  }

  const legacyById = new Map(legacy.data.map((p) => [p.id, p]));
  const joinById = new Map(join.data.map((p) => [p.id, p]));
  const mismatches: string[] = [];

  const allIds = new Set([...legacyById.keys(), ...joinById.keys()]);
  for (const id of allIds) {
    const a = legacyById.get(id);
    const b = joinById.get(id);
    if (!a) {
      mismatches.push(`${id}: nur in Join`);
      continue;
    }
    if (!b) {
      mismatches.push(`${id}: nur in Legacy`);
      continue;
    }
    const fields: Array<keyof RosterPlayer> = [
      'jersey_number',
      'position',
      'status',
      'is_active',
      'is_laz_player',
    ];
    for (const f of fields) {
      if (a[f] !== b[f]) {
        mismatches.push(`${id}.${f}: legacy=${String(a[f])} join=${String(b[f])}`);
      }
    }
  }

  return {
    match: mismatches.length === 0 && legacy.data.length === join.data.length,
    legacyCount: legacy.data.length,
    joinCount: join.data.length,
    mismatches,
    error: null,
  };
}

async function loadSeasonStatus(teamSeasonId: string): Promise<string | null> {
  const { data } = await supabase
    .from('team_seasons')
    .select('status')
    .eq('id', teamSeasonId)
    .maybeSingle();
  return data?.status != null ? String(data.status).toLowerCase() : null;
}

/**
 * Compatibility: players.team_season_id pflegen ohne aktive Membership durch Draft zu überschreiben.
 */
export async function syncPlayersTeamSeasonIdCompat(
  playerId: string,
  targetTeamSeasonId: string,
): Promise<{ ok: boolean; message?: string; updated: boolean }> {
  const { data: player, error } = await supabase
    .from('players')
    .select('id, team_season_id')
    .eq('id', playerId)
    .maybeSingle();
  if (error || !player) return { ok: false, message: error?.message ?? 'Spieler nicht gefunden', updated: false };

  const current = player.team_season_id != null ? String(player.team_season_id) : null;
  if (current === targetTeamSeasonId) return { ok: true, updated: false };
  if (current == null) {
    const { error: upd } = await supabase
      .from('players')
      .update({ team_season_id: targetTeamSeasonId })
      .eq('id', playerId);
    return upd ? { ok: false, message: upd.message, updated: false } : { ok: true, updated: true };
  }

  const [currentStatus, targetStatus] = await Promise.all([
    loadSeasonStatus(current),
    loadSeasonStatus(targetTeamSeasonId),
  ]);

  // Draft darf aktive Zuordnung nicht überschreiben
  if (targetStatus === 'draft' && currentStatus === 'active') {
    return { ok: true, updated: false };
  }

  // Aktive Ziel-Season hat Vorrang
  if (targetStatus === 'active' || currentStatus !== 'active') {
    const { error: upd } = await supabase
      .from('players')
      .update({ team_season_id: targetTeamSeasonId })
      .eq('id', playerId);
    return upd ? { ok: false, message: upd.message, updated: false } : { ok: true, updated: true };
  }

  return { ok: true, updated: false };
}

async function upsertJoinRow(input: {
  playerId: string;
  teamSeasonId: string;
  jerseyNumber: number | null;
  position: string | null;
  status: RosterStatus;
  isActive: boolean;
  isLazPlayer: boolean;
}): Promise<string | null> {
  const { error } = await supabase.from('team_season_players').upsert(
    {
      player_id: input.playerId,
      team_season_id: input.teamSeasonId,
      jersey_number: input.jerseyNumber,
      position: input.position,
      status: input.status,
      is_active: input.isActive,
      is_laz_player: input.isLazPlayer,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'player_id,team_season_id' },
  );
  return error?.message ?? null;
}

/**
 * Neuen Spieler anlegen: Stamm + Join-Row + Compatibility-Spalte.
 */
export async function createRosterPlayer(
  input: CreateRosterPlayerInput,
): Promise<{ playerId: string | null; error: string | null }> {
  const { data: insertedRows, error: insertError } = await supabase
    .from('players')
    .insert({
      team_season_id: input.teamSeasonId,
      first_name: input.firstName,
      last_name: input.lastName,
      jersey_number: input.jerseyNumber,
      position: input.position,
      is_active: true,
      status: 'active',
      is_laz_player: false,
    })
    .select('id');

  if (insertError) return { playerId: null, error: insertError.message };
  const playerId = (insertedRows as { id: string }[] | null)?.[0]?.id ?? null;
  if (!playerId) return { playerId: null, error: 'Spieler-ID fehlt nach Insert.' };

  const joinErr = await upsertJoinRow({
    playerId,
    teamSeasonId: input.teamSeasonId,
    jerseyNumber: input.jerseyNumber,
    position: input.position,
    status: 'active',
    isActive: true,
    isLazPlayer: false,
  });
  if (joinErr) {
    // Soft-fail Join: Stamm existiert; Flag/legacy weiter nutzbar. Fehler zurückgeben.
    return { playerId, error: `Spieler angelegt, Kader-Zuordnung fehlgeschlagen: ${joinErr}` };
  }

  if (input.birthdateIso !== undefined) {
    const { error: profileError } = await supabase.from('player_profiles').upsert(
      {
        player_id: playerId,
        birthdate: input.birthdateIso,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id' },
    );
    if (profileError) return { playerId, error: profileError.message };
  }

  return { playerId, error: null };
}

/**
 * Saisonbezogene Kaderfelder + Stamm-Name aktualisieren (Dual-Write).
 */
export async function updateRosterPlayerSeasonFields(
  input: UpdateRosterSeasonFieldsInput,
): Promise<{ ok: boolean; error: string | null }> {
  const playerPatch: Record<string, unknown> = {};
  if (input.firstName !== undefined) playerPatch.first_name = input.firstName;
  if (input.lastName !== undefined) playerPatch.last_name = input.lastName;

  // Season fields auch auf players, wenn Compatibility-Season = diese Season (oder leer → sync)
  const { data: player } = await supabase
    .from('players')
    .select('team_season_id, jersey_number, position, status, is_active, is_laz_player')
    .eq('id', input.playerId)
    .maybeSingle();

  const currentCompat = player?.team_season_id != null ? String(player.team_season_id) : null;
  const writeSeasonOntoPlayers = currentCompat == null || currentCompat === input.teamSeasonId;

  if (writeSeasonOntoPlayers) {
    if (input.jerseyNumber !== undefined) playerPatch.jersey_number = input.jerseyNumber;
    if (input.position !== undefined) playerPatch.position = input.position;
    if (input.status !== undefined) {
      playerPatch.status = input.status;
      playerPatch.is_active = input.status === 'active';
    }
    if (input.isActive !== undefined) playerPatch.is_active = input.isActive;
    if (input.isLazPlayer !== undefined) playerPatch.is_laz_player = input.isLazPlayer;
  }

  if (Object.keys(playerPatch).length > 0) {
    const { error } = await supabase.from('players').update(playerPatch).eq('id', input.playerId);
    if (error) return { ok: false, error: error.message };
  }

  await syncPlayersTeamSeasonIdCompat(input.playerId, input.teamSeasonId);

  const status =
    input.status ??
    normalizeStatus(player?.status != null ? String(player.status) : null, player?.is_active as boolean | null);
  const isActive = input.isActive ?? (input.status ? input.status === 'active' : player?.is_active !== false);
  const jersey =
    input.jerseyNumber !== undefined
      ? input.jerseyNumber
      : player?.jersey_number != null
        ? Number(player.jersey_number)
        : null;
  const position =
    input.position !== undefined
      ? input.position
      : player?.position != null
        ? String(player.position)
        : null;
  const isLaz =
    input.isLazPlayer !== undefined ? input.isLazPlayer : player?.is_laz_player === true;

  const joinErr = await upsertJoinRow({
    playerId: input.playerId,
    teamSeasonId: input.teamSeasonId,
    jerseyNumber: jersey,
    position,
    status,
    isActive: Boolean(isActive),
    isLazPlayer: isLaz,
  });
  if (joinErr) return { ok: false, error: joinErr };

  return { ok: true, error: null };
}

/**
 * Stamm-Verletzungsfelder (dauerhaft am player) + optional LAZ saisonbezogen.
 */
export async function updatePlayerMasterFlags(input: {
  playerId: string;
  teamSeasonId?: string | null;
  is_laz_player?: boolean;
  is_injured?: boolean;
  injured_since?: string | null;
  injured_until?: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  const patch: Record<string, unknown> = {};
  if (input.is_injured !== undefined) patch.is_injured = input.is_injured;
  if (input.injured_since !== undefined) patch.injured_since = input.injured_since;
  if (input.injured_until !== undefined) patch.injured_until = input.injured_until;
  // LAZ: Compatibility auf players + Join wenn Season bekannt
  if (input.is_laz_player !== undefined) patch.is_laz_player = input.is_laz_player;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('players').update(patch).eq('id', input.playerId);
    if (error) return { ok: false, error: error.message };
  }

  if (input.teamSeasonId && input.is_laz_player !== undefined) {
    const res = await updateRosterPlayerSeasonFields({
      playerId: input.playerId,
      teamSeasonId: input.teamSeasonId,
      isLazPlayer: input.is_laz_player,
    });
    if (!res.ok) return res;
  }

  return { ok: true, error: null };
}
