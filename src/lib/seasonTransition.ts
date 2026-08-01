/**
 * Saisonabschluss + Saisonwechsel.
 *
 * Kader-Transfer (STEP 5): INSERT/UPSERT in team_season_players (gleiche player_id).
 * players.team_season_id nur Compatibility (aktive Season priorisieren; Draft überschreibt nicht).
 * Keine Player-Duplikate. Stats bleiben an alten Events/Matches.
 */
import { supabase } from './supabaseClient';
import {
  canPrepareNextSeason,
  isSeasonArchived,
  isSeasonActive,
  normalizeTeamSeasonStatus,
  SEASON_SOFT_LOCK_MESSAGE,
  type TeamSeasonLifecycleStatus,
} from './seasonLifecycle';
import {
  prepareNextSeasonDraft,
  type PrepareNextSeasonDraftResult,
  type TeamSeasonRowForPrep,
} from './seasonPreparation';
import { syncPlayersTeamSeasonIdCompat } from './rosterService';

export { SEASON_SOFT_LOCK_MESSAGE };

export type SeasonTransferOptions = {
  /**
   * Spieler in neue Saison übernehmen via team_season_players (gleiche player_id).
   * Quell-Kader bleibt erhalten.
   */
  transferPlayers: boolean;
  /**
   * Optional: nur diese player_ids übernehmen.
   * null/undefined = alle aktiven Kaderspieler der Quelle.
   * [] = niemanden.
   */
  selectedPlayerIds?: string[] | null;
  /** Staff-memberships (trainer / co_trainer / head_coach) neu anlegen. */
  copyStaff: boolean;
  /** team_photos.photo_url auf neue Saison. */
  copyTeamPhoto: boolean;
  /** team_notification_settings. */
  copyNotificationSettings: boolean;
  /** team_season_aliases. */
  copyAliases: boolean;
  /**
   * Zukünftige Termine der Quelle auf die Ziel-Saison umhängen (gleiche event.id).
   * Nur sinnvoll beim Abschließen / nachträglicher Korrektur — nicht beim Draft-Prepare.
   */
  transferFutureEvents?: boolean;
  /**
   * Optional: nur diese event_ids umhängen.
   * null/undefined = alle Kandidaten aus listFutureEventsForSeasonTransfer.
   * [] = keine.
   */
  selectedEventIds?: string[] | null;
};

export const DEFAULT_SEASON_TRANSFER_OPTIONS: SeasonTransferOptions = {
  // STEP 5: Default an — Transfer nur über Join (kein Verschieben).
  transferPlayers: true,
  selectedPlayerIds: null,
  copyStaff: true,
  copyTeamPhoto: true,
  copyNotificationSettings: true,
  copyAliases: true,
  transferFutureEvents: true,
  selectedEventIds: null,
};

export type FutureEventTransferCandidate = {
  id: string;
  type: string | null;
  kind: string | null;
  opponent: string | null;
  starts_at: string;
  status: string | null;
  match_id: string | null;
  rsvp_count: number;
  label: string;
};

let teamSeasonPlayersAvailable: boolean | null = null;

/** Ob team_season_players für Transfer nutzbar ist. */
export async function isTeamSeasonPlayersAvailable(): Promise<boolean> {
  if (teamSeasonPlayersAvailable != null) return teamSeasonPlayersAvailable;
  const { error } = await supabase.from('team_season_players').select('id').limit(1);
  teamSeasonPlayersAvailable = !error;
  return teamSeasonPlayersAvailable;
}

export type TransferCandidatePlayer = {
  id: string;
  display_name: string;
  jersey_number: number | null;
  position: string | null;
  /** Saisonstatus der Quell-Membership (active | paused). */
  roster_status: 'active' | 'paused';
};

function normalizeTransferRosterStatus(
  status: unknown,
  isActive: unknown,
): 'active' | 'paused' | 'archived' {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'archived') return 'archived';
  if (s === 'paused') return 'paused';
  if (s === 'active') return 'active';
  if (isActive === false) return 'paused';
  return 'active';
}

/** Kader der Quelle für Assistenten-Auswahl: active + paused (ohne archived). */
export async function listTransferCandidatePlayers(
  sourceTeamSeasonId: string,
): Promise<{ data: TransferCandidatePlayer[]; error: string | null; source: 'join' | 'legacy' | 'none' }> {
  const sid = sourceTeamSeasonId?.trim();
  if (!sid) return { data: [], error: 'Quell-Saison fehlt.', source: 'none' };

  if (await isTeamSeasonPlayersAvailable()) {
    const { data, error } = await supabase
      .from('team_season_players')
      .select(
        'player_id, jersey_number, position, status, is_active, players:players ( id, first_name, last_name )',
      )
      .eq('team_season_id', sid)
      .is('left_at', null)
      .order('jersey_number', { ascending: true, nullsFirst: false });

    if (!error) {
      const rows = ((data ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          const roster_status = normalizeTransferRosterStatus(row.status, row.is_active);
          if (roster_status === 'archived') return null;
          const pRaw = row.players;
          const p = (Array.isArray(pRaw) ? pRaw[0] : pRaw) as Record<string, unknown> | null | undefined;
          const first = p?.first_name != null ? String(p.first_name).trim() : '';
          const last = p?.last_name != null ? String(p.last_name).trim() : '';
          const display_name = [first, last].filter(Boolean).join(' ') || 'Spieler';
          const id = String(row.player_id ?? p?.id ?? '').trim();
          if (!id) return null;
          return {
            id,
            display_name,
            jersey_number: row.jersey_number != null ? Number(row.jersey_number) : null,
            position: row.position != null ? String(row.position) : null,
            roster_status: roster_status as 'active' | 'paused',
          };
        })
        .filter((r): r is TransferCandidatePlayer => r != null);

      rows.sort((a, b) => {
        if (a.roster_status !== b.roster_status) {
          return a.roster_status === 'active' ? -1 : 1;
        }
        const ja = a.jersey_number;
        const jb = b.jersey_number;
        if (ja != null && jb != null && ja !== jb) return ja - jb;
        if (ja != null && jb == null) return -1;
        if (ja == null && jb != null) return 1;
        return a.display_name.localeCompare(b.display_name, 'de');
      });

      return { data: rows, error: null, source: 'join' };
    }
  }

  // Fallback nur wenn Join fehlt
  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, jersey_number, position, status, is_active')
    .eq('team_season_id', sid)
    .order('jersey_number', { ascending: true, nullsFirst: false });

  if (error) return { data: [], error: error.message, source: 'legacy' };
  const rows = ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const roster_status = normalizeTransferRosterStatus(row.status, row.is_active);
      if (roster_status === 'archived') return null;
      const first = row.first_name != null ? String(row.first_name).trim() : '';
      const last = row.last_name != null ? String(row.last_name).trim() : '';
      return {
        id: String(row.id),
        display_name: [first, last].filter(Boolean).join(' ') || 'Spieler',
        jersey_number: row.jersey_number != null ? Number(row.jersey_number) : null,
        position: row.position != null ? String(row.position) : null,
        roster_status: roster_status as 'active' | 'paused',
      };
    })
    .filter((r): r is TransferCandidatePlayer => r != null);
  return { data: rows, error: null, source: 'legacy' };
}

function formatFutureEventCandidateLabel(row: {
  type?: string | null;
  kind?: string | null;
  opponent?: string | null;
  starts_at: string;
}): string {
  const when = new Date(row.starts_at);
  const dateLabel = Number.isNaN(when.getTime())
    ? row.starts_at
    : when.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const kind = String(row.kind ?? row.type ?? 'termin').trim().toLowerCase();
  const kindLabel =
    kind === 'training'
      ? 'Training'
      : kind === 'tournament' || kind === 'turnier'
        ? 'Turnier'
        : kind === 'match' || kind === 'game'
          ? 'Spiel'
          : 'Termin';
  const opponent = (row.opponent ?? '').trim();
  return opponent ? `${dateLabel} ${kindLabel} vs. ${opponent}` : `${dateLabel} ${kindLabel}`;
}

/**
 * Zukünftige Termine einer Saison (Kandidaten für Übernahme in die neue Saison).
 * Kriterium: starts_at >= asOf (Default: jetzt), Status nicht canceled.
 * Vergangene Events/Matches bleiben bewusst draußen.
 */
export async function listFutureEventsForSeasonTransfer(
  sourceTeamSeasonId: string,
  opts?: { asOf?: string | Date | null },
): Promise<{ data: FutureEventTransferCandidate[]; error: string | null }> {
  const sid = sourceTeamSeasonId?.trim();
  if (!sid) return { data: [], error: 'Quell-Saison fehlt.' };

  const asOfIso =
    opts?.asOf instanceof Date
      ? opts.asOf.toISOString()
      : typeof opts?.asOf === 'string' && opts.asOf.trim()
        ? opts.asOf.trim()
        : new Date().toISOString();

  const { data, error } = await supabase
    .from('events')
    .select('id, type, kind, opponent, starts_at, status, match_id')
    .eq('team_season_id', sid)
    .gte('starts_at', asOfIso)
    .order('starts_at', { ascending: true });

  if (error) return { data: [], error: error.message };

  const rows = (data ?? []).filter((row) => {
    const st = String((row as { status?: string }).status ?? '')
      .trim()
      .toLowerCase();
    return st !== 'canceled' && st !== 'cancelled' && st !== 'deleted';
  }) as Array<{
    id: string;
    type?: string | null;
    kind?: string | null;
    opponent?: string | null;
    starts_at: string;
    status?: string | null;
    match_id?: string | null;
  }>;

  const ids = rows.map((r) => String(r.id));
  const rsvpByEvent = new Map<string, number>();
  if (ids.length > 0) {
    const { data: attendance } = await supabase
      .from('event_attendance')
      .select('event_id')
      .in('event_id', ids);
    for (const a of attendance ?? []) {
      const eid = String((a as { event_id?: string }).event_id ?? '');
      if (!eid) continue;
      rsvpByEvent.set(eid, (rsvpByEvent.get(eid) ?? 0) + 1);
    }
  }

  return {
    data: rows.map((r) => {
      const id = String(r.id);
      return {
        id,
        type: r.type ?? null,
        kind: r.kind ?? null,
        opponent: r.opponent ?? null,
        starts_at: r.starts_at,
        status: r.status ?? null,
        match_id: r.match_id ?? null,
        rsvp_count: rsvpByEvent.get(id) ?? 0,
        label: formatFutureEventCandidateLabel(r),
      };
    }),
    error: null,
  };
}

export type ReassignEventsResult =
  | { ok: true; movedEventIds: string[]; movedMatchIds: string[] }
  | { ok: false; message: string; movedEventIds?: string[] };

/**
 * Hängt bestehende Events auf die Ziel-Saison um (UPDATE team_season_id).
 * Behält event.id, RSVP (event_attendance), Turnier-Tabellen und Jobs.
 * Erzeugt keine neuen notification_jobs / Pushes.
 */
export async function reassignEventsToTeamSeason(input: {
  sourceTeamSeasonId: string;
  targetTeamSeasonId: string;
  eventIds: string[];
}): Promise<ReassignEventsResult> {
  const sourceId = input.sourceTeamSeasonId.trim();
  const targetId = input.targetTeamSeasonId.trim();
  const eventIds = [...new Set(input.eventIds.map((id) => String(id).trim()).filter(Boolean))];

  if (!sourceId || !targetId) return { ok: false, message: 'Saison-IDs fehlen.' };
  if (sourceId === targetId) return { ok: false, message: 'Quelle und Ziel sind identisch.' };
  if (eventIds.length === 0) return { ok: true, movedEventIds: [], movedMatchIds: [] };

  const { data: targetRow, error: targetErr } = await supabase
    .from('team_seasons')
    .select('id, status')
    .eq('id', targetId)
    .maybeSingle();
  if (targetErr) return { ok: false, message: targetErr.message };
  if (!targetRow) return { ok: false, message: 'Ziel-Saison nicht gefunden.' };
  if (isSeasonArchived((targetRow as { status?: string }).status)) {
    return { ok: false, message: 'Ziel-Saison ist archiviert — Übernahme nicht möglich.' };
  }

  const { data: existing, error: loadErr } = await supabase
    .from('events')
    .select('id, team_season_id, match_id')
    .in('id', eventIds)
    .eq('team_season_id', sourceId);

  if (loadErr) return { ok: false, message: loadErr.message };

  const movable = (existing ?? []) as Array<{
    id: string;
    team_season_id: string;
    match_id?: string | null;
  }>;
  if (movable.length === 0) {
    return { ok: false, message: 'Keine passenden Events in der Quell-Saison gefunden.' };
  }

  const movableIds = movable.map((e) => String(e.id));
  const matchIds = [
    ...new Set(
      movable
        .map((e) => (e.match_id != null ? String(e.match_id).trim() : ''))
        .filter(Boolean),
    ),
  ];

  const { error: updErr } = await supabase
    .from('events')
    .update({ team_season_id: targetId })
    .in('id', movableIds)
    .eq('team_season_id', sourceId);

  if (updErr) return { ok: false, message: updErr.message, movedEventIds: [] };

  if (matchIds.length > 0) {
    const { error: matchErr } = await supabase
      .from('matches')
      .update({ team_season_id: targetId })
      .in('id', matchIds)
      .eq('team_season_id', sourceId);
    if (matchErr) {
      console.warn('[reassignEventsToTeamSeason] matches update', matchErr.message);
      return {
        ok: false,
        message: `Events umgehängt, aber Match-Zuordnung fehlgeschlagen: ${matchErr.message}`,
        movedEventIds: movableIds,
      };
    }
  }

  // Feed-Posts an Event hängen — team_season_id mitziehen (falls vorhanden).
  const { error: feedErr } = await supabase
    .from('team_feed_posts')
    .update({ team_season_id: targetId })
    .in('event_id', movableIds)
    .eq('team_season_id', sourceId);
  if (feedErr) {
    // Nicht blockierend: Spalte/Policy kann fehlen; Event-ID bleibt Source of Truth für RSVP.
    console.warn('[reassignEventsToTeamSeason] team_feed_posts', feedErr.message);
  }

  return { ok: true, movedEventIds: movableIds, movedMatchIds: matchIds };
}

type TeamSeasonLifecycleRow = {
  id: string;
  team_id: string;
  status?: string | null;
  archived_at?: string | null;
  age_group?: string | null;
  display_name?: string | null;
  prepared_from_team_season_id?: string | null;
};

let archivedAtColumnAvailable: boolean | null = null;
let ageGroupColumnAvailable: boolean | null = null;

async function probeArchivedAtColumn(): Promise<boolean> {
  if (archivedAtColumnAvailable != null) return archivedAtColumnAvailable;
  const { error } = await supabase.from('team_seasons').select('archived_at').limit(1);
  archivedAtColumnAvailable = !error;
  return archivedAtColumnAvailable;
}

async function probeAgeGroupColumn(): Promise<boolean> {
  if (ageGroupColumnAvailable != null) return ageGroupColumnAvailable;
  const { error } = await supabase.from('team_seasons').select('age_group').limit(1);
  ageGroupColumnAvailable = !error;
  return ageGroupColumnAvailable;
}

export type SeasonWritableState =
  | { writable: true; status: TeamSeasonLifecycleStatus }
  | { writable: false; status: TeamSeasonLifecycleStatus; message: string };

/** Soft-Lock: archived Saisons sind nicht beschreibbar. */
export async function getTeamSeasonWritableState(
  teamSeasonId: string | null | undefined,
): Promise<SeasonWritableState | { error: string }> {
  const id = teamSeasonId?.trim();
  if (!id) return { error: 'Keine Team-Saison gewählt.' };

  const hasArchivedAt = await probeArchivedAtColumn();
  const selectCols = hasArchivedAt ? 'id, status, archived_at' : 'id, status';

  const { data, error } = await supabase
    .from('team_seasons')
    .select(selectCols)
    .eq('id', id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: 'Team-Saison nicht gefunden.' };

  const row = data as { status?: string | null; archived_at?: string | null };
  const status = normalizeTeamSeasonStatus(row.status);
  const archived = isSeasonArchived(row.status, hasArchivedAt ? row.archived_at : null);

  if (archived || status === 'archived') {
    return { writable: false, status: 'archived', message: SEASON_SOFT_LOCK_MESSAGE };
  }

  return { writable: true, status };
}

export async function assertTeamSeasonWritable(
  teamSeasonId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const state = await getTeamSeasonWritableState(teamSeasonId);
  if ('error' in state) return { ok: false, message: state.error };
  if (!state.writable) return { ok: false, message: state.message };
  return { ok: true };
}

export type ArchiveTeamSeasonResult =
  | { ok: true; teamSeasonId: string }
  | { ok: false; message: string };

/** Saison abschließen (Soft-Lock). Keine Löschung historischer Daten. */
export async function archiveTeamSeason(teamSeasonId: string): Promise<ArchiveTeamSeasonResult> {
  const id = teamSeasonId.trim();
  if (!id) return { ok: false, message: 'Saison fehlt. Bitte Seite neu laden.' };

  const { data: current, error: loadErr } = await supabase
    .from('team_seasons')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (loadErr) return { ok: false, message: loadErr.message };
  if (!current) return { ok: false, message: 'Team-Saison nicht gefunden.' };

  if (normalizeTeamSeasonStatus((current as { status?: string }).status) === 'archived') {
    return { ok: true, teamSeasonId: id };
  }

  const patch: Record<string, unknown> = { status: 'archived' };
  if (await probeArchivedAtColumn()) {
    patch.archived_at = new Date().toISOString();
  }

  const { error: updErr } = await supabase.from('team_seasons').update(patch).eq('id', id);
  if (updErr) return { ok: false, message: updErr.message };

  // Pending Reminder-Jobs der archivierten Saison stoppen (keine neuen Pushes).
  const { data: seasonEvents } = await supabase.from('events').select('id').eq('team_season_id', id);
  const eventIds = (seasonEvents ?? [])
    .map((r) => String((r as { id?: string }).id ?? '').trim())
    .filter(Boolean);
  if (eventIds.length > 0) {
    const { error: jobErr } = await supabase
      .from('notification_jobs')
      .update({
        status: 'failed',
        last_error: 'season_archived',
        updated_at: new Date().toISOString(),
      })
      .in('event_id', eventIds)
      .eq('status', 'pending');
    if (jobErr) {
      console.warn('[archiveTeamSeason] notification_jobs cancel', jobErr.message);
    }
  }

  return { ok: true, teamSeasonId: id };
}

export async function activateTeamSeason(teamSeasonId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = teamSeasonId.trim();
  if (!id) return { ok: false, message: 'Saison fehlt. Bitte Seite neu laden.' };

  const { error } = await supabase
    .from('team_seasons')
    .update({ status: 'active' })
    .eq('id', id);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

async function copyStaffMemberships(sourceId: string, targetId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, role')
    .eq('team_season_id', sourceId);

  if (error) return error.message;

  const staffRoles = new Set(['trainer', 'co_trainer', 'head_coach', 'admin']);
  const rows = (data ?? []).filter((m) => staffRoles.has(String(m.role ?? '').trim().toLowerCase()));

  for (const m of rows) {
    const userId = String(m.user_id ?? '').trim();
    const role = String(m.role ?? '').trim();
    if (!userId || !role) continue;

    const { data: existing } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('team_season_id', targetId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.user_id) {
      const { error: updErr } = await supabase
        .from('memberships')
        .update({ role })
        .eq('team_season_id', targetId)
        .eq('user_id', userId);
      if (updErr) return updErr.message;
    } else {
      const { error: insErr } = await supabase.from('memberships').insert({
        user_id: userId,
        team_season_id: targetId,
        role,
      });
      if (insErr) return insErr.message;
    }
  }

  return null;
}

/**
 * Spieler in Ziel-Saison übernehmen:
 * - INSERT/UPSERT team_season_players (gleiche player_id, Quell-Kader bleibt)
 * - parent/player-Memberships spiegeln (Zugang)
 * - players.team_season_id NICHT als Transfer-Mechanismus (Compat separat nach Activate)
 */
async function transferPlayersToSeason(
  sourceId: string,
  targetId: string,
  selectedPlayerIds?: string[] | null,
): Promise<{ error: string | null; transferredPlayerIds: string[] }> {
  if (!(await isTeamSeasonPlayersAvailable())) {
    return {
      error:
        'Spielerübernahme ist noch nicht freigeschaltet (Kaderzuordnung fehlt). Bitte Administrator kontaktieren.',
      transferredPlayerIds: [],
    };
  }

  let query = supabase
    .from('team_season_players')
    .select('player_id, jersey_number, position, is_laz_player, status, is_active')
    .eq('team_season_id', sourceId)
    .is('left_at', null);

  if (Array.isArray(selectedPlayerIds)) {
    if (selectedPlayerIds.length === 0) return { error: null, transferredPlayerIds: [] };
    query = query.in('player_id', selectedPlayerIds);
  }

  const { data: sourceRows, error: loadErr } = await query;
  if (loadErr) return { error: loadErr.message, transferredPlayerIds: [] };

  const rows = (sourceRows ?? []) as Array<{
    player_id: string;
    jersey_number: number | null;
    position: string | null;
    is_laz_player: boolean | null;
    status: string | null;
    is_active: boolean | null;
  }>;

  const transferredPlayerIds: string[] = [];

  for (const row of rows) {
    const playerId = String(row.player_id ?? '').trim();
    if (!playerId) continue;

    const statusRaw = String(row.status ?? 'active').toLowerCase();
    // archived Quell-Zeilen nicht in neue Saison übernehmen
    if (statusRaw === 'archived') continue;
    // paused bleibt paused; sonst active
    const startStatus = statusRaw === 'paused' ? 'paused' : 'active';
    const startActive = startStatus === 'active';

    const { error: upsertErr } = await supabase.from('team_season_players').upsert(
      {
        player_id: playerId,
        team_season_id: targetId,
        jersey_number: row.jersey_number,
        position: row.position != null ? String(row.position).trim() || null : null,
        is_laz_player: row.is_laz_player === true,
        status: startStatus,
        is_active: startActive,
        left_at: null,
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id,team_season_id' },
    );
    if (upsertErr) return { error: upsertErr.message, transferredPlayerIds };

    transferredPlayerIds.push(playerId);
  }

  // Zugang: parent/player-Memberships der Quelle auf Ziel spiegeln (keine Guardians kopieren)
  const { data: accessMemberships, error: memErr } = await supabase
    .from('memberships')
    .select('user_id, role')
    .eq('team_season_id', sourceId)
    .in('role', ['parent', 'player']);

  if (memErr) return { error: memErr.message, transferredPlayerIds };

  const transferredSet = new Set(transferredPlayerIds);
  // Wenn Teilauswahl: nur Memberships spiegeln, wenn User mit übernommenen Spielern verknüpft ist — MVP: alle parent/player der Quelle spiegeln (wie bisher)
  void transferredSet;

  for (const m of accessMemberships ?? []) {
    const userId = String(m.user_id ?? '').trim();
    const role = String(m.role ?? '').trim();
    if (!userId || !role) continue;

    const { data: existing } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('team_season_id', targetId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.user_id) continue;

    const { error: insErr } = await supabase.from('memberships').insert({
      user_id: userId,
      team_season_id: targetId,
      role,
    });
    if (insErr && !/duplicate|unique/i.test(insErr.message)) {
      return { error: insErr.message, transferredPlayerIds };
    }
  }

  return { error: null, transferredPlayerIds };
}

/** Nach Activate: Compat-Spalte auf neue aktive Season setzen (Draft-Regel in syncPlayersTeamSeasonIdCompat). */
async function syncCompatAfterPlayerTransfer(
  targetId: string,
  playerIds: string[],
): Promise<string | null> {
  for (const playerId of playerIds) {
    const res = await syncPlayersTeamSeasonIdCompat(playerId, targetId);
    if (!res.ok) return res.message ?? 'Compatibility-Update fehlgeschlagen.';
  }
  return null;
}

async function copyTeamPhoto(sourceId: string, targetId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_photos')
    .select('photo_url')
    .eq('team_season_id', sourceId)
    .maybeSingle();

  if (error) {
    if (/team_photos|does not exist|schema cache/i.test(error.message)) return null;
    return error.message;
  }

  const url = String((data as { photo_url?: string } | null)?.photo_url ?? '').trim();
  if (!url) return null;

  const { data: existing } = await supabase
    .from('team_photos')
    .select('team_season_id')
    .eq('team_season_id', targetId)
    .maybeSingle();

  if (existing?.team_season_id) {
    const { error: updErr } = await supabase
      .from('team_photos')
      .update({ photo_url: url })
      .eq('team_season_id', targetId);
    return updErr?.message ?? null;
  }

  const { error: insErr } = await supabase.from('team_photos').insert({
    team_season_id: targetId,
    photo_url: url,
  });
  return insErr?.message ?? null;
}

async function copyNotificationSettings(sourceId: string, targetId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_notification_settings')
    .select('*')
    .eq('team_season_id', sourceId)
    .maybeSingle();

  if (error) {
    if (/team_notification_settings|does not exist|schema cache/i.test(error.message)) return null;
    return error.message;
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const payload: Record<string, unknown> = { ...row, team_season_id: targetId };
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;

  const { data: existing } = await supabase
    .from('team_notification_settings')
    .select('team_season_id')
    .eq('team_season_id', targetId)
    .maybeSingle();

  if (existing?.team_season_id) {
    const { error: updErr } = await supabase
      .from('team_notification_settings')
      .update(payload)
      .eq('team_season_id', targetId);
    return updErr?.message ?? null;
  }

  const { error: insErr } = await supabase.from('team_notification_settings').insert(payload);
  return insErr?.message ?? null;
}

async function copyAliases(sourceId: string, targetId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_season_aliases')
    .select('alias')
    .eq('team_season_id', sourceId);

  if (error) {
    if (/team_season_aliases|does not exist|schema cache/i.test(error.message)) return null;
    return error.message;
  }

  for (const row of data ?? []) {
    const alias = String((row as { alias?: string }).alias ?? '').trim();
    if (!alias) continue;
    const { error: insErr } = await supabase.from('team_season_aliases').insert({
      team_season_id: targetId,
      alias,
    });
    if (insErr && !/duplicate|unique/i.test(insErr.message)) return insErr.message;
  }
  return null;
}

export async function applySeasonTransfer(
  sourceTeamSeasonId: string,
  targetTeamSeasonId: string,
  options: SeasonTransferOptions,
): Promise<
  | { ok: true; transferredPlayerIds: string[] }
  | { ok: false; message: string; transferredPlayerIds?: string[] }
> {
  const sourceId = sourceTeamSeasonId.trim();
  const targetId = targetTeamSeasonId.trim();
  if (!sourceId || !targetId) return { ok: false, message: 'Saison-IDs fehlen.' };
  if (sourceId === targetId) return { ok: false, message: 'Quelle und Ziel sind identisch.' };

  let transferredPlayerIds: string[] = [];

  if (options.copyStaff) {
    const err = await copyStaffMemberships(sourceId, targetId);
    if (err) return { ok: false, message: err };
  }

  if (options.transferPlayers) {
    const res = await transferPlayersToSeason(sourceId, targetId, options.selectedPlayerIds);
    if (res.error) return { ok: false, message: res.error, transferredPlayerIds: res.transferredPlayerIds };
    transferredPlayerIds = res.transferredPlayerIds;
  }

  if (options.copyTeamPhoto) {
    const err = await copyTeamPhoto(sourceId, targetId);
    if (err) return { ok: false, message: err, transferredPlayerIds };
  }

  if (options.copyNotificationSettings) {
    const err = await copyNotificationSettings(sourceId, targetId);
    if (err) return { ok: false, message: err, transferredPlayerIds };
  }

  if (options.copyAliases) {
    const err = await copyAliases(sourceId, targetId);
    if (err) return { ok: false, message: err, transferredPlayerIds };
  }

  if (options.transferFutureEvents) {
    const listed = await listFutureEventsForSeasonTransfer(sourceId);
    if (listed.error) return { ok: false, message: listed.error, transferredPlayerIds };
    let ids = listed.data.map((e) => e.id);
    if (Array.isArray(options.selectedEventIds)) {
      const allow = new Set(options.selectedEventIds.map((id) => String(id).trim()).filter(Boolean));
      ids = ids.filter((id) => allow.has(id));
    }
    if (ids.length > 0) {
      const moved = await reassignEventsToTeamSeason({
        sourceTeamSeasonId: sourceId,
        targetTeamSeasonId: targetId,
        eventIds: ids,
      });
      if (!moved.ok) return { ok: false, message: moved.message, transferredPlayerIds };
    }
  }

  return { ok: true, transferredPlayerIds };
}

export type PrepareSeasonWithOptionsInput = {
  sourceTeamSeasonId: string;
  seasonName?: string | null;
  ageGroup?: string | null;
  /**
   * Prepare: Quell-Saison bleibt aktiv.
   * Spielerübernahme nur via team_season_players (Join); Compat wird nicht überschrieben (Draft-Regel).
   */
  options: SeasonTransferOptions;
};

/**
 * Flow A: Neue Saison vorbereiten.
 * Quell-Saison bleibt aktiv. Spieler werden nicht verschoben — nur Join-Memberships in den Draft.
 */
export async function prepareSeasonDraftWithOptions(
  input: PrepareSeasonWithOptionsInput,
): Promise<PrepareNextSeasonDraftResult & { transferError?: string }> {
  const prepared = await prepareNextSeasonDraft(input.sourceTeamSeasonId, {
    seasonName: input.seasonName,
    ageGroup: input.ageGroup,
  });
  if (!prepared.ok) return prepared;

  const transfer = await applySeasonTransfer(input.sourceTeamSeasonId, prepared.draftTeamSeasonId, {
    ...input.options,
    // Explizit: Prepare erzwingt kein Archivieren; Transfer ist Join-only
    transferPlayers: input.options.transferPlayers === true,
    // Termine bleiben in der aktiven Quelle, bis der Wechsel abgeschlossen wird.
    transferFutureEvents: false,
  });

  if (!transfer.ok) {
    console.error('[seasonTransition] prepare transfer failed', {
      operation: 'applySeasonTransfer',
      message: transfer.message,
      sourceTeamSeasonId: input.sourceTeamSeasonId,
      targetTeamSeasonId: prepared.draftTeamSeasonId,
    });
    return { ...prepared, transferError: transfer.message };
  }

  return prepared;
}

export type CompleteSeasonTransitionInput = {
  sourceTeamSeasonId: string;
  seasonName?: string | null;
  ageGroup?: string | null;
  options: SeasonTransferOptions;
  /** Muss true sein — Quell-Saison wird nur mit ausdrücklicher Bestätigung archiviert. */
  confirmArchiveSource: boolean;
  /** Bestehenden Draft nutzen, sonst neu anlegen. */
  existingDraftTeamSeasonId?: string | null;
};

export type CompleteSeasonTransitionResult =
  | {
      ok: true;
      newTeamSeasonId: string;
      archivedSource: boolean;
      nextSeasonName?: string;
      displayName?: string;
    }
  | { ok: false; message: string };

/**
 * Flow B: Vorhandenen Draft aktivieren + Quell-Saison abschließen
 * (oder Draft neu anlegen, wenn none). Interne Logik — UI-Shortcut „close_and_create“ entfernt.
 */
export async function completeSeasonTransition(
  input: CompleteSeasonTransitionInput,
): Promise<CompleteSeasonTransitionResult> {
  if (!input.confirmArchiveSource) {
    return {
      ok: false,
      message: 'Bitte bestätige den Abschluss der alten Saison im letzten Schritt.',
    };
  }

  const sourceId = input.sourceTeamSeasonId.trim();
  if (!sourceId) return { ok: false, message: 'Quell-Saison fehlt.' };

  let targetId = input.existingDraftTeamSeasonId?.trim() || '';
  let nextSeasonName: string | undefined;
  let displayName: string | undefined;

  if (!targetId) {
    const prepared = await prepareNextSeasonDraft(sourceId, {
      seasonName: input.seasonName,
      ageGroup: input.ageGroup,
    });
    if (!prepared.ok) return { ok: false, message: prepared.message };
    targetId = prepared.draftTeamSeasonId;
    nextSeasonName = prepared.nextSeasonName;
    displayName = prepared.displayName;
  } else if (input.ageGroup?.trim() && (await probeAgeGroupColumn())) {
    await supabase
      .from('team_seasons')
      .update({ age_group: input.ageGroup.trim() })
      .eq('id', targetId);
  }

  const transfer = await applySeasonTransfer(sourceId, targetId, {
    ...input.options,
    // Events erst nach Activate umhängen — Ziel ist dann die Work-Season.
    transferFutureEvents: false,
  });
  if (!transfer.ok) return { ok: false, message: transfer.message };

  const activated = await activateTeamSeason(targetId);
  if (!activated.ok) return { ok: false, message: activated.message };

  if (transfer.transferredPlayerIds.length > 0) {
    const compatErr = await syncCompatAfterPlayerTransfer(targetId, transfer.transferredPlayerIds);
    if (compatErr) return { ok: false, message: compatErr };
  }

  if (input.options.transferFutureEvents !== false) {
    const listed = await listFutureEventsForSeasonTransfer(sourceId);
    if (listed.error) return { ok: false, message: listed.error };
    let ids = listed.data.map((e) => e.id);
    if (Array.isArray(input.options.selectedEventIds)) {
      const allow = new Set(
        input.options.selectedEventIds.map((id) => String(id).trim()).filter(Boolean),
      );
      ids = ids.filter((id) => allow.has(id));
    }
    if (ids.length > 0) {
      const moved = await reassignEventsToTeamSeason({
        sourceTeamSeasonId: sourceId,
        targetTeamSeasonId: targetId,
        eventIds: ids,
      });
      if (!moved.ok) return { ok: false, message: moved.message };
    }
  }

  const archived = await archiveTeamSeason(sourceId);
  if (!archived.ok) return { ok: false, message: archived.message };

  return {
    ok: true,
    newTeamSeasonId: targetId,
    archivedSource: true,
    nextSeasonName,
    displayName,
  };
}

export function canRunSeasonTransition(role: string | null | undefined): boolean {
  return canPrepareNextSeason(role);
}

export function describeTransferForConfirm(options: SeasonTransferOptions, archiveSource: boolean): string {
  const parts: string[] = [];
  if (options.transferPlayers) {
    const n = Array.isArray(options.selectedPlayerIds)
      ? options.selectedPlayerIds.length
      : null;
    parts.push(
      n == null
        ? 'Spieler (gleiche Profile, neuer Kader in der neuen Saison)'
        : `${n} Spieler (gleiche Profile, neuer Kader in der neuen Saison)`,
    );
  }
  if (options.copyStaff) parts.push('Trainer & Betreuer');
  if (options.copyTeamPhoto) parts.push('Mannschaftsfoto');
  if (options.copyNotificationSettings) parts.push('Erinnerungseinstellungen');
  if (options.copyAliases) parts.push('Team-Aliase');
  if (options.transferFutureEvents) {
    const n = Array.isArray(options.selectedEventIds) ? options.selectedEventIds.length : null;
    parts.push(
      n == null
        ? 'zukünftige Termine (gleiche Event-ID, RSVP bleibt)'
        : `${n} zukünftige Termine (gleiche Event-ID, RSVP bleibt)`,
    );
  }
  const take = parts.length ? parts.join(', ') : 'nur leere Saison-Struktur';
  if (archiveSource) {
    return `Alte Saison wird abgeschlossen. Übernommen: ${take}. Der alte Kader und die Historie bleiben in der abgeschlossenen Saison sichtbar.`;
  }
  return `Neue Saison wird vorbereitet (aktuelle Saison bleibt aktiv). Übernommen: ${take}. Den Wechsel schließt du später bewusst ab.`;
}

export type { TeamSeasonRowForPrep };
export { isSeasonActive };
