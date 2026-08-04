import { supabase } from './supabaseClient';
import {
  getSeasonStatusLabel,
  normalizeTeamSeasonStatus,
  type TeamSeasonLifecycleStatus,
} from './seasonLifecycle';
import { hasDraftSeasonForSource } from './seasonPreparation';
import {
  normalizeSeasonPhase,
  resolveSeasonPhase,
  seasonPhaseLabelDe,
  type SeasonPhase,
  type SeasonPhaseSource,
} from './seasonPhase';

export type SeasonCardModel = {
  id: string;
  displayName: string;
  status: TeamSeasonLifecycleStatus;
  statusLabel: string;
  ageGroup: string | null;
  seasonName: string | null;
  seasonPhase: SeasonPhase | null;
  seasonPhaseLabel: string | null;
  seasonPhaseSource: SeasonPhaseSource;
  seasonPhaseOverrideLabel: string | null;
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
  season_phase?: string | null;
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
  const seasonPhase = normalizeSeasonPhase(row.season_phase);
  const resolvedSeasonPhase = resolveSeasonPhase({ seasonName, storedPhase: seasonPhase });

  return {
    id: row.id,
    displayName,
    status,
    statusLabel: getSeasonStatusLabel(row.status),
    ageGroup: row.age_group?.trim() || null,
    seasonName,
    seasonPhase,
    seasonPhaseLabel: resolvedSeasonPhase.label,
    seasonPhaseSource: resolvedSeasonPhase.source,
    seasonPhaseOverrideLabel: seasonPhaseLabelDe(seasonPhase),
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
      m.includes('prepared_from') ||
      m.includes('season_phase'))
  );
}

export function mapPrepareDraftError(code: string, message: string): string {
  if (code === 'draft_exists') {
    return 'Neue Saison ist bereits in Vorbereitung. Bitte den Wechsel abschließen oder die Vorbereitung prüfen.';
  }
  if (code === 'duplicate_team_season') {
    return 'Für diese Saison existiert bereits eine Mannschaft. Bitte einen anderen Saisonnamen wählen.';
  }
  if (code === 'not_found') {
    return 'Die aktuelle Saison wurde nicht gefunden. Bitte Seite neu laden.';
  }
  if (isMigrationError(message)) {
    return 'Die Saisonverwaltung ist auf diesem System noch nicht vollständig freigeschaltet. Bitte den Administrator kontaktieren.';
  }
  if (/permission|policy|row-level security|42501|forbidden|not authorized/i.test(message)) {
    return 'Du hast derzeit keine Berechtigung, für diese Mannschaft eine neue Saison anzulegen. Bitte prüfe deine Trainerberechtigung.';
  }
  // Technische DB-/RLS-Texte nicht an Trainer weiterreichen
  if (/column|relation|schema|policy|rls|violates|constraint|null value/i.test(message)) {
    return 'Die neue Saison konnte nicht angelegt werden. Bitte später erneut versuchen oder den Administrator kontaktieren.';
  }
  return message || 'Die neue Saison konnte nicht vorbereitet werden.';
}

/**
 * Lädt aktive Saison und Entwurf für das Team der gewählten team_season.
 */
export async function fetchSeasonManagementSnapshot(
  anchorTeamSeasonId: string,
): Promise<{ data: SeasonManagementSnapshot | null; error: string | null }> {
  const anchorId = anchorTeamSeasonId?.trim();
  if (!anchorId) {
    return { data: null, error: 'Keine Mannschaft gewählt.' };
  }

  const { data: anchor, error: anchorErr } = await supabase
    .from('team_seasons')
    .select('id, team_id')
    .eq('id', anchorId)
    .maybeSingle();

  if (anchorErr) {
    const msg = isMigrationError(anchorErr.message)
      ? 'Die Saisonverwaltung ist auf diesem System noch nicht vollständig freigeschaltet.'
      : anchorErr.message;
    return { data: null, error: msg };
  }
  if (!anchor?.team_id) {
    return { data: null, error: 'Mannschaft nicht gefunden. Bitte Seite neu laden.' };
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
      season_phase,
      prepared_from_team_season_id,
      teams ( name ),
      seasons ( name )
    `,
    )
    .eq('team_id', teamId);

  let all: TeamSeasonRow[] = [];
  if (listErr && /season_phase|column|schema cache/i.test(listErr.message)) {
    const fallback = await supabase
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
    if (fallback.error) {
      const msg = isMigrationError(fallback.error.message)
        ? 'Die Saisonverwaltung ist auf diesem System noch nicht vollständig freigeschaltet.'
        : fallback.error.message;
      return { data: null, error: msg };
    }
    all = (fallback.data ?? []) as TeamSeasonRow[];
  } else if (listErr) {
    const msg = isMigrationError(listErr.message)
      ? 'Die Saisonverwaltung ist auf diesem System noch nicht vollständig freigeschaltet.'
      : listErr.message;
    return { data: null, error: msg };
  } else {
    all = (rows ?? []) as TeamSeasonRow[];
  }
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

/** Setzt Saisonphase: null = Automatik, sonst manueller Override. */
export async function updateTeamSeasonPhase(
  teamSeasonId: string,
  phase: SeasonPhase | null,
): Promise<{ error: string | null }> {
  const id = teamSeasonId?.trim();
  if (!id) return { error: 'Keine Saison gewählt.' };

  const { error } = await supabase
    .from('team_seasons')
    .update({ season_phase: phase })
    .eq('id', id);

  if (error) {
    if (/season_phase|column|schema cache/i.test(error.message)) {
      return {
        error:
          'Saisonphase ist auf diesem System noch nicht freigeschaltet. Bitte Migration 20260803180000_team_season_phase.sql ausführen.',
      };
    }
    return { error: error.message };
  }
  return { error: null };
}
