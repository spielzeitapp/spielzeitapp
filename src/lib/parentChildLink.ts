/**
 * Eltern-Kind-Verknüpfung: Status, Skip („Später verknüpfen“) und aktive Saisons.
 * Keine RLS-Umgehung — nur Client-Hilfen über Auth-Metadata + erlaubte Queries.
 */

import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { formatTeamSeasonDisplayLabel, isSeasonActive, isSeasonDraft } from './seasonLifecycle';

/** user_metadata-Flag: Onboarding ohne Kind abgeschlossen (kein player_guardians-Eintrag). */
export const PARENT_LINK_DEFERRED_META_KEY = 'parent_link_deferred';

/** user_metadata-Flag: Elternrolle bewusst gewählt (vor Membership / Kind-Verknüpfung). */
export const PARENT_ROLE_CHOSEN_META_KEY = 'parent_role_chosen';

export function isParentLinkDeferred(user: User | null | undefined): boolean {
  if (!user) return false;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return meta?.[PARENT_LINK_DEFERRED_META_KEY] === true;
}

export function isParentRoleChosen(user: User | null | undefined): boolean {
  if (!user) return false;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return meta?.[PARENT_ROLE_CHOSEN_META_KEY] === true;
}

/**
 * UI-Rolle „parent“ für Nutzer ohne Membership: gewählte Elternrolle oder verschobene Verknüpfung.
 * deferred allein impliziert Eltern-Onboarding (Self-Healing für fehlerhafte Testkonten).
 */
export function resolveParentUiRole(user: User | null | undefined): 'parent' | null {
  if (!user) return null;
  if (isParentRoleChosen(user) || isParentLinkDeferred(user)) return 'parent';
  return null;
}

export async function persistParentRoleChoice(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    data: { [PARENT_ROLE_CHOSEN_META_KEY]: true },
  });
  return { error: error?.message ?? null };
}

export async function setParentLinkDeferred(deferred: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    data: { [PARENT_LINK_DEFERRED_META_KEY]: deferred },
  });
  return { error: error?.message ?? null };
}

export async function clearParentLinkDeferred(): Promise<{ error: string | null }> {
  return setParentLinkDeferred(false);
}

export async function userHasPlayerGuardian(userId: string): Promise<{
  hasGuardian: boolean;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('player_guardians')
    .select('player_id')
    .eq('user_id', userId)
    .limit(1);
  if (error) return { hasGuardian: false, error: error.message };
  return { hasGuardian: (data ?? []).length > 0, error: null };
}

export type ParentLinkTeamSeasonOption = {
  id: string;
  label: string;
  teamId: string;
  status: string | null;
};

/**
 * Nur active/draft-Saisons für Kind-Verknüpfung, deterministisch sortiert.
 * Labels über zentrale formatTeamSeasonDisplayLabel (U12 statt historisches Team-U11).
 */
export type ParentLinkPlayerOption = {
  id: string;
  display_name: string;
  jersey_number: number | null;
};

export async function listActiveTeamSeasonsForParentLink(): Promise<{
  data: ParentLinkTeamSeasonOption[];
  error: string | null;
}> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc('list_parent_link_team_seasons');
  if (!rpcError && Array.isArray(rpcRows) && rpcRows.length > 0) {
    const opts: ParentLinkTeamSeasonOption[] = (rpcRows as Array<{
      id: string;
      team_id: string;
      label?: string | null;
      status?: string | null;
    }>).map((row) => ({
      id: String(row.id),
      teamId: String(row.team_id),
      label: String(row.label ?? '').trim() || 'Mannschaft',
      status: row.status ?? 'active',
    }));
    return { data: opts, error: null };
  }

  if (rpcError && !/could not find the function|42883|does not exist/i.test(rpcError.message)) {
    console.warn('[parentChildLink] list_parent_link_team_seasons RPC', rpcError.message);
  }

  const { data: rows, error } = await supabase
    .from('team_seasons')
    .select(
      `
      id,
      team_id,
      status,
      display_name,
      age_group,
      teams ( id, name, age_group ),
      seasons ( name )
    `,
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    // Fallback ohne Joins / neuere Spalten
    if (/column|relationship|does not exist|42703/i.test(error.message)) {
      return listActiveTeamSeasonsForParentLinkLegacy();
    }
    return { data: [], error: error.message };
  }

  type Raw = {
    id: string;
    team_id: string;
    status?: string | null;
    display_name?: string | null;
    age_group?: string | null;
    teams?:
      | { id?: string; name?: string | null; age_group?: string | null }
      | { id?: string; name?: string | null; age_group?: string | null }[]
      | null;
    seasons?: { name?: string | null } | { name?: string | null }[] | null;
  };

  const opts: ParentLinkTeamSeasonOption[] = [];
  for (const raw of (rows ?? []) as Raw[]) {
    const status = (raw.status ?? '').toLowerCase();
    if (!isSeasonActive(status)) continue;
    const team = Array.isArray(raw.teams) ? raw.teams[0] : raw.teams;
    const season = Array.isArray(raw.seasons) ? raw.seasons[0] : raw.seasons;
    const label = formatTeamSeasonDisplayLabel({
      displayName: raw.display_name,
      ageGroup: raw.age_group ?? team?.age_group,
      teamName: team?.name,
      seasonName: season?.name,
      status: raw.status,
    });
    opts.push({
      id: String(raw.id),
      teamId: String(raw.team_id),
      label: label || 'Mannschaft',
      status: raw.status ?? null,
    });
  }

  opts.sort((a, b) => a.label.localeCompare(b.label, 'de'));
  return { data: opts, error: null };
}

/**
 * Minimale Spielerliste für Kind-Verknüpfung (RPC bevorzugt, sonst Legacy players-Compat).
 */
export async function listPlayersForParentLink(
  teamSeasonId: string,
  userId: string,
): Promise<{ data: ParentLinkPlayerOption[]; error: string | null }> {
  const sid = teamSeasonId?.trim();
  if (!sid) return { data: [], error: 'Keine Mannschaft gewählt.' };

  const { data: rpcRows, error: rpcError } = await supabase.rpc('list_parent_link_roster', {
    p_team_season_id: sid,
  });

  if (!rpcError && Array.isArray(rpcRows)) {
    const mapped = (rpcRows as Array<{
      id: string;
      display_name?: string | null;
      jersey_number?: number | null;
    }>).map((row) => ({
      id: String(row.id),
      display_name: String(row.display_name ?? '').trim() || 'Spieler',
      jersey_number: row.jersey_number != null ? Number(row.jersey_number) : null,
    }));
    return { data: mapped, error: null };
  }

  if (rpcError && !/could not find the function|42883|does not exist/i.test(rpcError.message)) {
    console.warn('[parentChildLink] list_parent_link_roster RPC', rpcError.message);
  }

  const { data: playerRows, error: playerError } = await supabase
    .from('players')
    .select('id, first_name, last_name, jersey_number')
    .eq('team_season_id', sid)
    .or('status.eq.active,and(status.is.null,is_active.eq.true)');

  if (playerError) {
    return { data: [], error: playerError.message };
  }

  let linkedIds = new Set<string>();
  if (userId) {
    const { data: linkedRows, error: linkedError } = await supabase
      .from('player_guardians')
      .select('player_id')
      .eq('user_id', userId);

    if (linkedError) {
      return { data: [], error: linkedError.message };
    }

    linkedIds = new Set((linkedRows ?? []).map((r: { player_id: string }) => r.player_id));
  }

  const mapped: ParentLinkPlayerOption[] = ((playerRows ?? []) as Array<{
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    jersey_number?: number | null;
  }>)
    .filter((row) => !linkedIds.has(row.id))
    .map((row) => {
      const first = (row.first_name ?? '').toString().trim();
      const last = (row.last_name ?? '').toString().trim();
      return {
        id: row.id,
        display_name: `${first} ${last}`.trim() || 'Spieler',
        jersey_number: row.jersey_number != null ? Number(row.jersey_number) : null,
      };
    });

  return { data: mapped, error: null };
}

async function listActiveTeamSeasonsForParentLinkLegacy(): Promise<{
  data: ParentLinkTeamSeasonOption[];
  error: string | null;
}> {
  const { data: teamSeasonRows, error: tsError } = await supabase
    .from('team_seasons')
    .select('id, team_id, status, display_name, age_group')
    .eq('status', 'active');

  if (tsError) {
    // Älteste Variante: kein status-Filter möglich → alles laden und clientseitig filtern, wenn status fehlt
    if (/status|42703|column/i.test(tsError.message)) {
      const { data: allRows, error } = await supabase.from('team_seasons').select('id, team_id');
      if (error) return { data: [], error: error.message };
      const teamIds = [...new Set((allRows ?? []).map((r: { team_id: string }) => r.team_id))];
      const { data: teamsRows } = await supabase.from('teams').select('id, name').in('id', teamIds);
      const nameById = new Map((teamsRows ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
      return {
        data: (allRows ?? []).map((r: { id: string; team_id: string }) => ({
          id: String(r.id),
          teamId: String(r.team_id),
          label: nameById.get(r.team_id) ?? 'Team',
          status: null,
        })),
        error: null,
      };
    }
    return { data: [], error: tsError.message };
  }

  const teamIds = [...new Set((teamSeasonRows ?? []).map((r: { team_id: string }) => r.team_id))];
  const { data: teamsRows, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, age_group')
    .in('id', teamIds);
  if (teamsError) return { data: [], error: teamsError.message };

  const teamById = new Map(
    (teamsRows ?? []).map((t: { id: string; name?: string; age_group?: string }) => [t.id, t]),
  );

  const opts: ParentLinkTeamSeasonOption[] = (teamSeasonRows ?? []).map(
    (r: {
      id: string;
      team_id: string;
      status?: string | null;
      display_name?: string | null;
      age_group?: string | null;
    }) => {
      const team = teamById.get(r.team_id);
      const label = formatTeamSeasonDisplayLabel({
        displayName: r.display_name,
        ageGroup: r.age_group ?? team?.age_group,
        teamName: team?.name,
        status: r.status,
      });
      return {
        id: String(r.id),
        teamId: String(r.team_id),
        label: label || team?.name || 'Team',
        status: r.status ?? null,
      };
    },
  );

  opts.sort((a, b) => a.label.localeCompare(b.label, 'de'));
  return { data: opts, error: null };
}

/** Gate-Logik: Eltern mit Guardian oder Skip gelten als onboarding-fertig. */
export function isParentOnboardingSatisfied(opts: {
  hasGuardian: boolean;
  hasParentMembership: boolean;
  deferred: boolean;
  previewIsParent: boolean;
  backendIsParent: boolean;
  parentRoleChosen?: boolean;
}): { complete: boolean; needsOnboardingUi: boolean } {
  if (opts.hasGuardian) {
    return { complete: true, needsOnboardingUi: false };
  }
  if (opts.deferred) {
    return { complete: true, needsOnboardingUi: false };
  }
  const looksLikeParent =
    opts.previewIsParent ||
    opts.backendIsParent ||
    opts.hasParentMembership ||
    opts.parentRoleChosen === true;
  if (looksLikeParent) {
    return { complete: false, needsOnboardingUi: true };
  }
  return { complete: true, needsOnboardingUi: false };
}
