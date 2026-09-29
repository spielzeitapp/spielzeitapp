import { supabase } from './supabaseClient';

export type OefbTableSettings = {
  competitionId: string;
  sourceUrl: string;
  teamName: string;
};

export function parseOefbCompetitionUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'www.oefb.at') return null;
    return /^\/bewerbe\/Bewerb\/([0-9]{1,10})\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function getOefbTableSettings(teamSeasonId: string): Promise<{
  data: OefbTableSettings | null;
  error: string | null;
}> {
  const { data, error } = await supabase.from('team_seasons')
    .select('oefb_table_competition_id, oefb_table_url, oefb_table_team_name')
    .eq('id', teamSeasonId).maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data?.oefb_table_competition_id || !data.oefb_table_url || !data.oefb_table_team_name) {
    return { data: null, error: null };
  }
  return { data: {
    competitionId: String(data.oefb_table_competition_id),
    sourceUrl: String(data.oefb_table_url),
    teamName: String(data.oefb_table_team_name),
  }, error: null };
}

export async function adminSaveOefbTableSettings(input: {
  teamSeasonId: string;
  sourceUrl: string;
  teamName: string;
}): Promise<{ data: OefbTableSettings | null; error: string | null }> {
  const url = input.sourceUrl.trim();
  const teamName = input.teamName.trim();
  if ((url || teamName) && (!parseOefbCompetitionUrl(url) || !teamName)) {
    return { data: null, error: 'Gültigen ÖFB-Bewerbslink und Mannschaftsnamen angeben.' };
  }
  const { error } = await supabase.rpc('admin_set_team_season_oefb_table', {
    p_team_season_id: input.teamSeasonId,
    p_url: url,
    p_team_name: teamName,
  });
  if (error) return { data: null, error: error.message };
  return getOefbTableSettings(input.teamSeasonId);
}
