/**
 * Saisonabschluss + Saisonwechsel (ohne Migration, ohne Player-Duplikate).
 *
 * Datenmodell (Supabase-App):
 * - Stammdatensatz: public.players (inkl. team_season_id)
 * - Kaderzuordnung: players.team_season_id (kein separates team_season_players in der App)
 * - player_guardians / player_users hängen an player_id → nicht kopieren/remappen
 *
 * Spätere Schema-Erweiterung: Join-Tabelle team_season_players, damit alte Saisons
 * ihren Kader behalten können, während Spieler in der neuen Saison stehen.
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

export { SEASON_SOFT_LOCK_MESSAGE };

export type SeasonTransferOptions = {
  /** players.team_season_id auf die neue Saison umhängen (gleiche player_id). */
  transferPlayers: boolean;
  /** Staff-memberships (trainer / co_trainer / head_coach) neu anlegen. */
  copyStaff: boolean;
  /** team_photos.photo_url auf neue Saison. */
  copyTeamPhoto: boolean;
  /** team_notification_settings. */
  copyNotificationSettings: boolean;
  /** team_season_aliases. */
  copyAliases: boolean;
};

export const DEFAULT_SEASON_TRANSFER_OPTIONS: SeasonTransferOptions = {
  // Default aus: Transfer leert den Kader der Quell-Saison (players.team_season_id).
  transferPlayers: false,
  copyStaff: true,
  copyTeamPhoto: true,
  copyNotificationSettings: true,
  copyAliases: true,
};

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
 * Spieler-Stammdatensätze behalten dieselbe id.
 * Nur die saisonbezogene Zuordnung players.team_season_id wird umgehängt.
 * Zusätzlich: parent/player-Memberships der Quelle auf die Ziel-Saison spiegeln
 * (Zugang), ohne player_guardians / player_users anzufassen.
 */
async function transferPlayersToSeason(sourceId: string, targetId: string): Promise<string | null> {
  const { error: moveErr } = await supabase
    .from('players')
    .update({ team_season_id: targetId })
    .eq('team_season_id', sourceId);

  if (moveErr) return moveErr.message;

  const { data: accessMemberships, error: memErr } = await supabase
    .from('memberships')
    .select('user_id, role')
    .eq('team_season_id', sourceId)
    .in('role', ['parent', 'player']);

  if (memErr) return memErr.message;

  for (const m of accessMemberships ?? []) {
    const userId = String(m.user_id ?? '').trim();
    const role = String(m.role ?? '').trim();
    if (!userId || !role) continue;

    const { data: existing } = await supabase
      .from('memberships')
      .select('user_id, role')
      .eq('team_season_id', targetId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing?.user_id) continue;

    const { error: insErr } = await supabase.from('memberships').insert({
      user_id: userId,
      team_season_id: targetId,
      role,
    });
    if (insErr) return insErr.message;
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
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sourceId = sourceTeamSeasonId.trim();
  const targetId = targetTeamSeasonId.trim();
  if (!sourceId || !targetId) return { ok: false, message: 'Saison-IDs fehlen.' };
  if (sourceId === targetId) return { ok: false, message: 'Quelle und Ziel sind identisch.' };

  if (options.copyStaff) {
    const err = await copyStaffMemberships(sourceId, targetId);
    if (err) return { ok: false, message: err };
  }

  if (options.transferPlayers) {
    const err = await transferPlayersToSeason(sourceId, targetId);
    if (err) return { ok: false, message: err };
  }

  if (options.copyTeamPhoto) {
    const err = await copyTeamPhoto(sourceId, targetId);
    if (err) return { ok: false, message: err };
  }

  if (options.copyNotificationSettings) {
    const err = await copyNotificationSettings(sourceId, targetId);
    if (err) return { ok: false, message: err };
  }

  if (options.copyAliases) {
    const err = await copyAliases(sourceId, targetId);
    if (err) return { ok: false, message: err };
  }

  return { ok: true };
}

export type PrepareSeasonWithOptionsInput = {
  sourceTeamSeasonId: string;
  seasonName?: string | null;
  ageGroup?: string | null;
  /** Nur Settings/Staff/Foto/Aliase — keine Spieler-Umänderung im Prepare-Flow. */
  options: Omit<SeasonTransferOptions, 'transferPlayers'> & { transferPlayers?: false };
};

/**
 * Flow A: Neue Saison vorbereiten.
 * Quell-Saison bleibt aktiv. Spieler werden nicht umgehängt.
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
    transferPlayers: false,
  });

  if (!transfer.ok) {
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
 * Flow B: Saison abschließen und neue Saison erstellen.
 * Archivierung der Quelle nur wenn confirmArchiveSource === true.
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

  const transfer = await applySeasonTransfer(sourceId, targetId, input.options);
  if (!transfer.ok) return { ok: false, message: transfer.message };

  const activated = await activateTeamSeason(targetId);
  if (!activated.ok) return { ok: false, message: activated.message };

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
    parts.push('Spieler (erscheinen danach im Kader der neuen Saison)');
  }
  if (options.copyStaff) parts.push('Trainer & Betreuer');
  if (options.copyTeamPhoto) parts.push('Mannschaftsfoto');
  if (options.copyNotificationSettings) parts.push('Erinnerungseinstellungen');
  if (options.copyAliases) parts.push('Team-Aliase');
  const take = parts.length ? parts.join(', ') : 'nur leere Saison-Struktur';
  if (archiveSource) {
    return `Alte Saison wird abgeschlossen. Übernommen: ${take}. Spiele, Trainings und Ergebnisse bleiben in der alten Saison.`;
  }
  return `Entwurf wird angelegt (Quell-Saison bleibt aktiv). Übernommen: ${take}. Spieler bleiben in der aktiven Saison, bis du explizit abschließt.`;
}

export type { TeamSeasonRowForPrep };
export { isSeasonActive };
