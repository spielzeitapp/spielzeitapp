import { supabase } from './supabaseClient';
import {
  buildPreparedSeasonDisplayName,
  computeNextAgeGroup,
  computeNextAgeGroupFromSource,
  computeNextSeasonName,
  resolveCurrentAgeGroup,
  type CurrentSeasonLabelSource,
} from './seasonLifecycle';

/**
 * STEP 2 — Saison-Entwurf (nur team_seasons-Zeile, keine Kopie von Kader/Terminen/Feed).
 *
 * Spielerübernahme beim Abschluss: siehe seasonTransition (team_season_players Upsert).
 * Prepare-Flow: keine Spieler-Umänderung (transferPlayers=false).
 *
 * ## team_seasons (Supabase)
 * - Kern: id, team_id, season_id (+ Lifecycle aus STEP 1)
 * - Optional: display_name, age_group, prepared_from_team_season_id, status, archived_at
 * - Join: teams (name, age_group?), seasons (name)
 *
 * ## age_group — Analyse (keine erzwungene Migration)
 * 1. `team_seasons.age_group` (STEP 1, Saison-Snapshot) — bevorzugt für Entwurf
 * 2. `teams.age_group` — Fallback, wenn Spalte auf team_seasons leer (heute in useSession/TeamSwitcher)
 * 3. Parsing aus team.name / display_name (U11 im Vereinsnamen)
 * Für spätere Saisonkopie: `prepared_from_team_season_id` + `age_group` auf dem Draft.
 */

export type TeamSeasonRowForPrep = {
  id: string;
  team_id: string;
  season_id: string;
  status?: string | null;
  display_name?: string | null;
  age_group?: string | null;
  teamName?: string | null;
  teamAgeGroup?: string | null;
  seasonName?: string | null;
};

export type PrepareNextSeasonDraftResult =
  | {
      ok: true;
      draftTeamSeasonId: string;
      seasonId: string;
      displayName: string;
      nextAgeGroup: string | null;
      nextSeasonName: string;
      createdSeason: boolean;
    }
  | {
      ok: false;
      code:
        | 'invalid_input'
        | 'not_found'
        | 'draft_exists'
        | 'duplicate_team_season'
        | 'load_failed'
        | 'season_resolve_failed'
        | 'insert_failed';
      message: string;
    };

type TeamSeasonDbRow = {
  id: string;
  team_id: string;
  season_id: string;
  status?: string | null;
  display_name?: string | null;
  age_group?: string | null;
  teams?: { name?: string | null; age_group?: string | null } | { name?: string | null; age_group?: string | null }[] | null;
  seasons?: { id?: string; name?: string | null } | { id?: string; name?: string | null }[] | null;
};

function pickJoin<T extends Record<string, unknown>>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

export function teamSeasonRowToLabelSource(row: TeamSeasonRowForPrep): CurrentSeasonLabelSource {
  return {
    teamName: row.teamName,
    seasonName: row.seasonName,
    ageGroup: row.age_group?.trim() || row.teamAgeGroup?.trim() || null,
    displayName: row.display_name,
  };
}

export function normalizeTeamSeasonForPrep(raw: TeamSeasonDbRow): TeamSeasonRowForPrep {
  const team = pickJoin(raw.teams);
  const season = pickJoin(raw.seasons);
  return {
    id: raw.id,
    team_id: raw.team_id,
    season_id: raw.season_id,
    status: raw.status,
    display_name: raw.display_name,
    age_group: raw.age_group,
    teamName: team?.name ?? null,
    teamAgeGroup: team?.age_group ?? null,
    seasonName: season?.name ?? null,
  };
}

/**
 * Ermittelt Altersklasse für den Entwurf (team_seasons → teams → Name-Parsing).
 */
export function resolveAgeGroupForDraft(row: TeamSeasonRowForPrep): {
  current: string | null;
  next: string | null;
  source: 'team_seasons' | 'teams' | 'parsed' | 'none';
} {
  const tsAg = row.age_group?.trim();
  if (tsAg) {
    return {
      current: tsAg,
      next: computeNextAgeGroup(tsAg),
      source: 'team_seasons',
    };
  }

  const teamAg = row.teamAgeGroup?.trim();
  if (teamAg) {
    return {
      current: teamAg,
      next: computeNextAgeGroup(teamAg),
      source: 'teams',
    };
  }

  const parsed = resolveCurrentAgeGroup(teamSeasonRowToLabelSource(row));
  if (parsed) {
    return {
      current: parsed,
      next: computeNextAgeGroup(parsed),
      source: 'parsed',
    };
  }

  return { current: null, next: null, source: 'none' };
}

/**
 * Prüft, ob für diese Quell-Saison bereits ein Draft existiert.
 */
export async function hasDraftSeasonForSource(teamSeasonId: string): Promise<boolean> {
  const id = teamSeasonId?.trim();
  if (!id) return false;

  const { data, error } = await supabase
    .from('team_seasons')
    .select('id')
    .eq('prepared_from_team_season_id', id)
    .eq('status', 'draft')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[seasonPreparation] hasDraftSeasonForSource', error.message);
    return false;
  }

  return Boolean((data as { id?: string } | null)?.id);
}

async function loadTeamSeasonForPrep(
  teamSeasonId: string,
): Promise<{ row: TeamSeasonRowForPrep } | { error: string }> {
  const { data, error } = await supabase
    .from('team_seasons')
    .select(
      `
      id,
      team_id,
      season_id,
      status,
      display_name,
      age_group,
      teams ( name, age_group ),
      seasons ( id, name )
    `,
    )
    .eq('id', teamSeasonId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'Saison nicht gefunden' };
  }

  return { row: normalizeTeamSeasonForPrep(data as TeamSeasonDbRow) };
}

async function resolveOrCreateSeasonId(
  nextSeasonName: string,
): Promise<{ seasonId: string; created: boolean } | { error: string }> {
  const name = nextSeasonName.trim();
  if (!name) {
    return { error: 'Saisonname fehlt' };
  }

  const { data: existing, error: findErr } = await supabase
    .from('seasons')
    .select('id')
    .eq('name', name)
    .limit(1)
    .maybeSingle();

  if (findErr) {
    console.error('[seasonPreparation] seasons.select failed', {
      operation: 'seasons.select',
      table: 'seasons',
      code: findErr.code,
      message: findErr.message,
      seasonName: name,
    });
    return { error: findErr.message };
  }
  if (existing?.id) {
    return { seasonId: String(existing.id), created: false };
  }

  const { data: inserted, error: insErr } = await supabase
    .from('seasons')
    .insert({ name })
    .select('id')
    .single();

  if (insErr) {
    console.error('[seasonPreparation] seasons.insert failed', {
      operation: 'seasons.insert',
      table: 'seasons',
      code: insErr.code,
      message: insErr.message,
      seasonName: name,
    });
    // Race / RLS-RETURNING: erneut lesen
    const { data: retry, error: retryErr } = await supabase
      .from('seasons')
      .select('id')
      .eq('name', name)
      .limit(1)
      .maybeSingle();
    if (retry?.id) {
      return { seasonId: String(retry.id), created: false };
    }
    if (retryErr) {
      console.error('[seasonPreparation] seasons.select retry failed', {
        operation: 'seasons.select_retry',
        table: 'seasons',
        code: retryErr.code,
        message: retryErr.message,
        seasonName: name,
      });
    }
    return { error: insErr.message };
  }

  if (!inserted?.id) {
    return { error: 'season konnte nicht angelegt werden' };
  }

  return { seasonId: String(inserted.id), created: true };
}

/**
 * Legt eine neue team_season als Entwurf an (keine Spieler/Events/Matches/Memberships/Feed).
 * Optional: seasonNameOverride / ageGroupOverride für den Assistenten.
 */
export async function prepareNextSeasonDraft(
  currentTeamSeason: string | TeamSeasonRowForPrep,
  overrides?: { seasonName?: string | null; ageGroup?: string | null },
): Promise<PrepareNextSeasonDraftResult> {
  let current: TeamSeasonRowForPrep;

  if (typeof currentTeamSeason === 'string') {
    const id = currentTeamSeason.trim();
    if (!id) {
      return { ok: false, code: 'invalid_input', message: 'Saison fehlt. Bitte Seite neu laden.' };
    }
    const loaded = await loadTeamSeasonForPrep(id);
    if ('error' in loaded) {
      return {
        ok: false,
        code: loaded.error.includes('nicht gefunden') ? 'not_found' : 'load_failed',
        message: loaded.error,
      };
    }
    current = loaded.row;
  } else {
    current = currentTeamSeason;
    if (!current.id?.trim() || !current.team_id?.trim() || !current.season_id?.trim()) {
      return { ok: false, code: 'invalid_input', message: 'Saisondaten unvollständig. Bitte Seite neu laden.' };
    }
  }

  if (await hasDraftSeasonForSource(current.id)) {
    return {
      ok: false,
      code: 'draft_exists',
      message: 'Für diese Saison existiert bereits ein Entwurf.',
    };
  }

  const labelSource = teamSeasonRowToLabelSource(current);
  const ageInfo = resolveAgeGroupForDraft(current);
  const overrideAge = overrides?.ageGroup?.trim() || null;
  const nextAgeGroup = overrideAge || ageInfo.next || computeNextAgeGroupFromSource(labelSource);
  const seasonRaw = current.seasonName?.trim() ?? '';
  const overrideSeason = overrides?.seasonName?.trim() || null;
  const nextSeasonName =
    overrideSeason || (seasonRaw ? computeNextSeasonName(seasonRaw) : '');
  // Ziel-Altersklasse/Saison sind Source of Truth (Wizard-Override oder Default) —
  // Display-Name darf sie nicht nochmals hochzählen (sonst U12-Auswahl → „U13 …“).
  const displayName = buildPreparedSeasonDisplayName({
    teamName: labelSource.teamName,
    targetAgeGroup: nextAgeGroup,
    targetSeasonName: nextSeasonName || '—',
  });

  if (!nextSeasonName) {
    return {
      ok: false,
      code: 'season_resolve_failed',
      message: 'Saisonname der aktuellen Saison konnte nicht fortgeschrieben werden.',
    };
  }

  const seasonResolved = await resolveOrCreateSeasonId(nextSeasonName);
  if ('error' in seasonResolved) {
    console.error('[seasonPreparation] seasons resolve/create failed', seasonResolved.error);
    return {
      ok: false,
      code: 'season_resolve_failed',
      message: seasonResolved.error,
    };
  }

  const { data: existingTs } = await supabase
    .from('team_seasons')
    .select('id, status')
    .eq('team_id', current.team_id)
    .eq('season_id', seasonResolved.seasonId)
    .maybeSingle();

  if (existingTs?.id) {
    const status = (existingTs as { status?: string }).status;
    return {
      ok: false,
      code: 'duplicate_team_season',
      message:
        status === 'draft'
          ? 'Team-Saison für diese Saison existiert bereits als Entwurf.'
          : 'Team-Saison für diese Saison existiert bereits.',
    };
  }

  const insertPayload: Record<string, unknown> = {
    team_id: current.team_id,
    season_id: seasonResolved.seasonId,
    status: 'draft',
    prepared_from_team_season_id: current.id,
    display_name: displayName,
  };

  // age_group nur setzen, wenn Spalte existiert (keine Migration in diesem Step).
  if (nextAgeGroup) {
    const { error: probeErr } = await supabase.from('team_seasons').select('age_group').limit(1);
    if (!probeErr) {
      insertPayload.age_group = nextAgeGroup;
    }
  }

  const { data: draftRow, error: insertErr } = await supabase
    .from('team_seasons')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertErr || !draftRow?.id) {
    console.error('[seasonPreparation] team_seasons.insert failed', {
      operation: 'team_seasons.insert',
      table: 'team_seasons',
      code: insertErr?.code,
      message: insertErr?.message,
      details: insertErr?.details,
      hint: insertErr?.hint,
      sourceTeamSeasonId: current.id,
      teamId: current.team_id,
      seasonId: seasonResolved.seasonId,
      status: 'draft',
    });
    return {
      ok: false,
      code: 'insert_failed',
      message: insertErr?.message ?? 'Entwurf konnte nicht angelegt werden',
    };
  }

  const draftId = String(draftRow.id);

  // Damit der Trainer den Entwurf in der Session sieht: eigene Staff-Membership anlegen.
  // Andere Staff-Mitglieder optional über Transfer; player_guardians/users bleiben unberührt.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = user?.id?.trim() ?? '';
    if (uid) {
      const { data: srcMem } = await supabase
        .from('memberships')
        .select('role')
        .eq('team_season_id', current.id)
        .eq('user_id', uid)
        .maybeSingle();
      const roleRaw = String((srcMem as { role?: string } | null)?.role ?? 'trainer')
        .trim()
        .toLowerCase();
      const role =
        roleRaw === 'co_trainer' || roleRaw === 'head_coach' || roleRaw === 'trainer'
          ? roleRaw
          : 'trainer';
      const { error: memErr } = await supabase.from('memberships').insert({
        user_id: uid,
        team_season_id: draftId,
        role,
      });
      if (memErr && !/duplicate|unique|already exists/i.test(memErr.message ?? '')) {
        console.error('[seasonPreparation] memberships.insert failed', {
          operation: 'memberships.insert',
          table: 'memberships',
          code: memErr.code,
          message: memErr.message,
          sourceTeamSeasonId: current.id,
          targetTeamSeasonId: draftId,
          teamId: current.team_id,
          role,
        });
      }
    }
  } catch (err) {
    console.warn('[seasonPreparation] draft membership ensure failed', err);
  }

  return {
    ok: true,
    draftTeamSeasonId: draftId,
    seasonId: seasonResolved.seasonId,
    displayName,
    nextAgeGroup,
    nextSeasonName,
    createdSeason: seasonResolved.created,
  };
}
