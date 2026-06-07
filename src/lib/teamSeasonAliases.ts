import { supabase } from './supabaseClient';
import { collectUniqueKnownNames, isTeamAliasMatch, normalizeTeamAliasName } from './teamSeasonAliasMatch';

export { collectUniqueKnownNames, isTeamAliasMatch, normalizeTeamAliasName } from './teamSeasonAliasMatch';

export type TeamSeasonAliasRow = {
  id: string;
  team_season_id: string;
  alias: string;
  created_at: string;
};

export type TournamentImportRecognition = {
  teamSeasonName: string | null;
  teamName: string | null;
  aliases: string[];
  knownNames: string[];
};

export async function loadTeamSeasonAliases(
  teamSeasonId: string,
): Promise<{ data: TeamSeasonAliasRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('team_season_aliases')
    .select('id, team_season_id, alias, created_at')
    .eq('team_season_id', teamSeasonId)
    .order('alias', { ascending: true });

  if (error) {
    if (/team_season_aliases|does not exist|schema cache/i.test(error.message ?? '')) {
      return { data: [], error: null };
    }
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as TeamSeasonAliasRow[], error: null };
}

export async function addTeamSeasonAlias(
  teamSeasonId: string,
  alias: string,
): Promise<{ error: string | null }> {
  const trimmed = alias.trim();
  if (!trimmed) {
    return { error: 'Alias darf nicht leer sein.' };
  }

  const existing = await loadTeamSeasonAliases(teamSeasonId);
  if (existing.error) return { error: existing.error };

  const key = normalizeTeamAliasName(trimmed);
  const duplicate = existing.data.some((row) => normalizeTeamAliasName(row.alias) === key);
  if (duplicate) {
    return { error: 'Dieser Alias ist bereits hinterlegt.' };
  }

  const { error } = await supabase.from('team_season_aliases').insert({
    team_season_id: teamSeasonId,
    alias: trimmed,
  });

  if (error) {
    if (/unique|duplicate/i.test(error.message ?? '')) {
      return { error: 'Dieser Alias ist bereits hinterlegt.' };
    }
    return { error: error.message };
  }

  return { error: null };
}

export async function deleteTeamSeasonAlias(aliasId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('team_season_aliases').delete().eq('id', aliasId);
  return { error: error?.message ?? null };
}

export async function buildTournamentImportRecognition(
  teamSeasonId: string,
): Promise<TournamentImportRecognition> {
  const { data, error } = await supabase
    .from('team_seasons')
    .select('name, teams(name)')
    .eq('id', teamSeasonId)
    .maybeSingle();

  const row = data as {
    name?: string | null;
    teams?: { name?: string } | { name?: string }[] | null;
  } | null;

  const teams = row?.teams;
  const teamObj = Array.isArray(teams) ? teams[0] : teams;
  const teamSeasonName = (row?.name ?? '').trim() || null;
  const teamName = (teamObj?.name ?? '').trim() || null;

  const aliasRes = await loadTeamSeasonAliases(teamSeasonId);
  const aliases = aliasRes.data.map((a) => a.alias.trim()).filter(Boolean);

  const knownNames = collectUniqueKnownNames([teamSeasonName, teamName, ...aliases]);

  if (error && !row) {
    return {
      teamSeasonName: null,
      teamName: null,
      aliases,
      knownNames,
    };
  }

  return {
    teamSeasonName,
    teamName,
    aliases,
    knownNames,
  };
}
