/**
 * Eltern-Kind-Verknüpfung: Status, Skip („Später verknüpfen“) und aktive Saisons.
 * Keine RLS-Umgehung — nur Client-Hilfen über Auth-Metadata + erlaubte Queries.
 */

import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { formatTeamSeasonDisplayLabel, isSeasonActive, isSeasonDraft } from './seasonLifecycle';

/** user_metadata-Flag: Onboarding ohne Kind abgeschlossen (kein player_guardians-Eintrag). */
export const PARENT_LINK_DEFERRED_META_KEY = 'parent_link_deferred';

export function isParentLinkDeferred(user: User | null | undefined): boolean {
  if (!user) return false;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return meta?.[PARENT_LINK_DEFERRED_META_KEY] === true;
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
export async function listActiveTeamSeasonsForParentLink(): Promise<{
  data: ParentLinkTeamSeasonOption[];
  error: string | null;
}> {
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
    .in('status', ['active', 'draft'])
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
    if (!(isSeasonActive(status) || isSeasonDraft(status))) continue;
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

async function listActiveTeamSeasonsForParentLinkLegacy(): Promise<{
  data: ParentLinkTeamSeasonOption[];
  error: string | null;
}> {
  const { data: teamSeasonRows, error: tsError } = await supabase
    .from('team_seasons')
    .select('id, team_id, status, display_name, age_group')
    .in('status', ['active', 'draft']);

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
}): { complete: boolean; needsOnboardingUi: boolean } {
  if (opts.hasGuardian) {
    return { complete: true, needsOnboardingUi: false };
  }
  if (opts.deferred) {
    return { complete: true, needsOnboardingUi: false };
  }
  const looksLikeParent =
    opts.previewIsParent || opts.backendIsParent || opts.hasParentMembership;
  if (looksLikeParent) {
    return { complete: false, needsOnboardingUi: true };
  }
  return { complete: true, needsOnboardingUi: false };
}
