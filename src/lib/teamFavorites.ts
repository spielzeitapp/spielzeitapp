import { supabase } from './supabaseClient';
/** Uses the same fan membership as fan onboarding; never replaces an existing role. */
export async function ensureFanTeamAccess(userId: string, teamSeasonId: string): Promise<string | null> {
  try {
  const { data: season, error: seasonError } = await supabase.from('team_seasons')
    .select('id,teams!inner(clubs!inner(status))').eq('id', teamSeasonId).eq('status', 'active').maybeSingle();
  const team = season && (Array.isArray(season.teams) ? season.teams[0] : season.teams);
  const club = team && (Array.isArray(team.clubs) ? team.clubs[0] : team.clubs);
  if (seasonError || !season || club?.status !== 'active') return 'Diese Mannschaft ist derzeit nicht verfügbar.';
  const { error } = await supabase.from('memberships').upsert({ user_id: userId, team_season_id: teamSeasonId, role: 'fan' }, {
    onConflict: 'user_id,team_season_id', ignoreDuplicates: true,
  });
  return error?.message ?? null;
  } catch { return 'Mannschaft konnte nicht geöffnet werden. Bitte erneut versuchen.'; }
}
