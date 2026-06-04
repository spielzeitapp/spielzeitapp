import { supabase } from './supabaseClient';

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

const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
};

/** Normalisiert Namen für Alias-Vergleich (Import). */
export function normalizeTeamAliasName(name: string): string {
  let s = name.trim().toLowerCase();
  for (const [from, to] of Object.entries(UMLAUT_MAP)) {
    s = s.split(from).join(to);
  }
  try {
    s = s.normalize('NFD').replace(/\p{M}/gu, '');
  } catch {
    /* ältere Umgebungen ohne Unicode-Property */
  }
  return s
    .replace(/\./g, ' ')
    .replace(/[/\\|]/g, ' ')
    .replace(/[-–—_]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(normalized: string): string[] {
  const stop = new Set(['u', 'u8', 'u9', 'u10', 'u11', 'u12', 'u13', 'u14', 'u15', 'u16', 'u17', 'u18', 'u19', 'fc', 'sv', 'sc', 'sk', 'spg', 'nsg', 'sg', 'tsv', 'fsv', 'fk', 'ask', 'usc']);
  return normalized
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t));
}

function tokensContainedIn(haystack: string, needles: string[]): boolean {
  if (needles.length === 0) return false;
  return needles.every((n) => haystack.includes(n));
}

/**
 * Prüft, ob ein Turnier-Teilnehmername zu einem unserer bekannten Namen passt.
 * Vorsichtiger Enthält-Vergleich (min. Token-Länge / mehrwortige Aliase).
 */
export function isTeamAliasMatch(candidateName: string, knownNames: string[]): boolean {
  const cand = normalizeTeamAliasName(candidateName);
  if (!cand) return false;

  const candTokens = significantTokens(cand);

  for (const known of knownNames) {
    const raw = known.trim();
    if (!raw) continue;

    const norm = normalizeTeamAliasName(raw);
    if (!norm) continue;

    if (cand === norm) return true;

    const shorter = cand.length <= norm.length ? cand : norm;
    const longer = cand.length > norm.length ? cand : norm;

    if (shorter.length >= 4 && longer.includes(shorter)) {
      return true;
    }

    const knownTokens = significantTokens(norm);
    if (knownTokens.length >= 1 && tokensContainedIn(cand, knownTokens)) {
      const hasSubstantial = knownTokens.some((t) => t.length >= 4);
      if (hasSubstantial || knownTokens.length >= 2) {
        return true;
      }
    }

    if (candTokens.length >= 2 && tokensContainedIn(norm, candTokens)) {
      const hasSubstantial = candTokens.some((t) => t.length >= 4);
      if (hasSubstantial) return true;
    }
  }

  return false;
}

export function collectUniqueKnownNames(names: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const trimmed = (name ?? '').trim();
    if (!trimmed) continue;
    const key = normalizeTeamAliasName(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

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
