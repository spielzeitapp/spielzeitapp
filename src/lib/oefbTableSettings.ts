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

export function isOefbClubTableUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'vereine.oefb.at' && !u.port && !u.username && !u.password && !u.search && !u.hash && /^\/[a-z0-9-]+\/Mannschaften\/Saison-\d{4}-\d{2}\/[a-z0-9-]+\/Tabellen\/?$/i.test(u.pathname); } catch { return false; }
}

export async function getOefbTableSettings(teamSeasonId: string): Promise<{
  data: OefbTableSettings | null;
  error: string | null;
}> {
  const { data, error } = await supabase.from('team_seasons')
    .select('oefb_table_competition_id, oefb_table_url, oefb_table_team_name')
    .eq('id', teamSeasonId).maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data?.oefb_table_url || (!data.oefb_table_competition_id && !isOefbClubTableUrl(data.oefb_table_url)) || !data.oefb_table_team_name) {
    return { data: null, error: null };
  }
  // Club imports have a season-specific table URL but no public competition ID.
  // Resolve it without changing the saved source or requiring another import.
  let resolvedCompetitionId = '';
  if (!data.oefb_table_competition_id && isOefbClubTableUrl(data.oefb_table_url)) {
    try {
      const response = await fetch(`/api/oefb/table?view=clubCompetition&url=${encodeURIComponent(data.oefb_table_url)}`, { signal: AbortSignal.timeout(22000) });
      if (response.ok) {
        const result = await response.json();
        if (/^\d{1,10}$/.test(String(result.competitionId ?? ''))) resolvedCompetitionId = String(result.competitionId);
      }
    } catch { /* Keep the club table available if the public resolver is temporarily unavailable. */ }
  }
  return { data: {
    competitionId: String(data.oefb_table_competition_id || resolvedCompetitionId || ''),
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
  if ((url || teamName) && ((!parseOefbCompetitionUrl(url) && !isOefbClubTableUrl(url)) || !teamName)) {
    return { data: null, error: 'Gültigen ÖFB-Bewerbslink und Mannschaftsnamen angeben.' };
  }
  const { error } = await supabase.rpc(isOefbClubTableUrl(url) ? 'admin_set_team_season_club_table' : 'admin_set_team_season_oefb_table', {
    p_team_season_id: input.teamSeasonId,
    p_url: url,
    p_team_name: teamName,
  });
  if (error) return { data: null, error: error.message };
  return getOefbTableSettings(input.teamSeasonId);
}
