import { supabase } from './supabaseClient';
import { isStandaloneDisplayMode } from './pwaDisplayMode';
import { formatPlayerAppLastUsed } from './playerAppStatus';

export async function recordHomeAppOpen(userId: string): Promise<void> {
  if (!isStandaloneDisplayMode()) return;
  const key = `home-app-open:${userId}`;
  try {
    if (Number(sessionStorage.getItem(key)) > 0) return;
  } catch { /* Session storage is optional. */ }
  const { error } = await supabase.rpc('record_home_app_open');
  if (!error) {
    try { sessionStorage.setItem(key, String(Date.now())); } catch { /* optional */ }
  }
}

export async function getTeamParentHomeAppUsage(teamSeasonId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc('get_team_parent_home_app_usage', { p_team_season_id: teamSeasonId });
  if (error) throw error;
  return new Map(((data ?? []) as Array<{ user_id: string; last_opened_at: string }>).map(row => [row.user_id, row.last_opened_at]));
}

export function homeAppUsageLabel(lastOpenedAt: string | undefined): string {
  if (!lastOpenedAt) return 'Home-Icon noch nicht beobachtet';
  const date = formatPlayerAppLastUsed(lastOpenedAt);
  return `Über Home-Icon geöffnet${date ? ` · ${date}` : ''}`;
}
