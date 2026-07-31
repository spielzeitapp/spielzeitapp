import { supabase } from './supabaseClient';
import {
  getSeasonStatusLabel,
  normalizeTeamSeasonStatus,
  type TeamSeasonLifecycleStatus,
} from './seasonLifecycle';
import { hasDraftSeasonForSource } from './seasonPreparation';

export type SeasonCardModel = {
  id: string;
  displayName: string;
  status: TeamSeasonLifecycleStatus;
  statusLabel: string;
  ageGroup: string | null;
  seasonName: string | null;
  teamName: string | null;
  preparedFromLabel: string | null;
};

export type SeasonManagementSnapshot = {
  teamId: string;
  active: SeasonCardModel | null;
  draft: SeasonCardModel | null;
  hasDraftForActive: boolean;
};

type TeamSeasonRow = {
  id: string;
  team_id: string;
  status?: string | null;
  display_name?: string | null;
  age_group?: string | null;
  prepared_from_team_season_id?: string | null;
  teams?: { name?: string | null } | { name?: string | null }[] | null;
  seasons?: { name?: string | null } | { name?: string | null }[] | null;
};

function pickJoin<T extends Record<string, unknown>>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function rowToCard(row: TeamSeasonRow, preparedFromLabel: string | null): SeasonCardModel {
  const team = pickJoin(row.teams);
  const season = pickJoin(row.seasons);
  const teamName = team?.name?.trim() || null;
  const seasonName = season?.name?.trim() || null;
  const displayName =
    row.display_name?.trim() ||
    (teamName && seasonName ? `${teamName} · ${seasonName}` : teamName || seasonName || 'Saison');

  const status = normalizeTeamSeasonStatus(row.status);

  return {
    id: row.id,
    displayName,
    status,
    statusLabel: getSeasonStatusLabel(row.status),
    ageGroup: row.age_group?.trim() || null,
    seasonName,
    teamName,
    preparedFromLabel,
  };
}

function isMigrationError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('column') &&
    (m.includes('status') ||
      m.includes('display_name') ||
      m.includes('age_group') ||
      m.includes('prepared_from'))
  );
}

export function mapPrepareDraftError(code: string, message: string): string {
  if (code === 'draft_exists') {
    return 'Entwurf bereits vorhanden. Es kann pro aktiver Saison nur ein Entwurf existieren.';
  }
  if (code === 'duplicate_team_season') {
    return message || 'Team-Saison für diese Saison existiert bereits.';
  }
  if (code === 'not_found') {
    return 'Aktuelle Saison wurde nicht gefunden.';
  }
  if (isMigrationError(message)) {
    return 'Datenbank-Migration fehlt noch (team_seasons Lifecycle-Felder). Bitte Migration 20260612120000 anwenden.';
  }
  if (/permission|policy|row-level security|42501|forbidden|not authorized/i.test(message)) {
    return 'Du hast derzeit keine Berechtigung, für diese Mannschaft eine neue Saison anzulegen. Bitte überprüfe deine Trainerberechtigung.';
  }
  return message || 'Saison-Entwurf konnte nicht erstellt werden.';
}

/**
 * Lädt aktive Saison und Entwurf für das Team der gewählten team_season.
 */
export async function fetchSeasonManagementSnapshot(
  anchorTeamSeasonId: string,
): Promise<{ data: SeasonManagementSnapshot | null; error: string | null }> {
  const anchorId = anchorTeamSeasonId?.trim();
  if (!anchorId) {
    return { data: null, error: 'Keine Team-Saison gewählt.' };
  }

  const { data: anchor, error: anchorErr } = await supabase
    .from('team_seasons')
    .select('id, team_id')
    .eq('id', anchorId)
    .maybeSingle();

  if (anchorErr) {
    const msg = isMigrationError(anchorErr.message)
      ? 'Datenbank-Migration fehlt noch (team_seasons.status).'
      : anchorErr.message;
    return { data: null, error: msg };
  }
  if (!anchor?.team_id) {
    return { data: null, error: 'Team-Saison nicht gefunden.' };
  }

  const teamId = String(anchor.team_id);

  const { data: rows, error: listErr } = await supabase
    .from('team_seasons')
    .select(
      `
      id,
      team_id,
      status,
      display_name,
      age_group,
      prepared_from_team_season_id,
      teams ( name ),
      seasons ( name )
    `,
    )
    .eq('team_id', teamId);

  if (listErr) {
    const msg = isMigrationError(listErr.message)
      ? 'Datenbank-Migration fehlt noch (team_seasons Lifecycle-Felder).'
      : listErr.message;
    return { data: null, error: msg };
  }

  const all = (rows ?? []) as TeamSeasonRow[];
  const byId = new Map(all.map((r) => [r.id, r]));

  const activeCandidates = all.filter((r) => normalizeTeamSeasonStatus(r.status) === 'active');
  let activeRow: TeamSeasonRow | null =
    activeCandidates.find((r) => r.id === anchorId) ??
    activeCandidates[0] ??
    null;

  if (!activeRow && normalizeTeamSeasonStatus(all.find((r) => r.id === anchorId)?.status) !== 'draft') {
    activeRow = all.find((r) => r.id === anchorId) ?? null;
  }

  const draftRow =
    all.find((r) => normalizeTeamSeasonStatus(r.status) === 'draft') ?? null;

  let preparedFromLabel: string | null = null;
  if (draftRow?.prepared_from_team_season_id) {
    const src = byId.get(draftRow.prepared_from_team_season_id);
    if (src) {
      preparedFromLabel = rowToCard(src, null).displayName;
    }
  }

  const active = activeRow ? rowToCard(activeRow, null) : null;
  const draft = draftRow ? rowToCard(draftRow, preparedFromLabel) : null;

  let hasDraftForActive = Boolean(draft);
  if (active && !hasDraftForActive) {
    hasDraftForActive = await hasDraftSeasonForSource(active.id);
  }

  return {
    data: {
      teamId,
      active,
      draft,
      hasDraftForActive,
    },
    error: null,
  };
}
