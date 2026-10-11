import { supabase } from './supabaseClient';
import type { SetupKey, SetupCheck, SetupSnapshot } from './managerSetupModel';
export * from './managerSetupModel';
export async function loadSetup(id: string) {
  const { data, error } = await supabase.rpc('admin_team_setup_snapshot', { p_team_season_id: id });
  return { data: data as SetupSnapshot | null, error: error?.message ?? null };
}
export async function saveSetup(id: string, key: SetupKey, value: SetupCheck) {
  const { data, error } = await supabase.rpc('admin_save_setup_check', { p_team_season_id: id, p_step: key, p_value: value });
  return { data: data as SetupSnapshot | null, error: error?.message ?? null };
}
export async function createSetupTeam(input: { clubId: string; name: string; ageGroup: string; seasonName: string }) {
  const { data, error } = await supabase.rpc('admin_setup_team_season', {
    p_club_id: input.clubId, p_name: input.name, p_age_group: input.ageGroup, p_season_name: input.seasonName,
  });
  return { data: data as { status: string; team_id: string; team_season_id: string } | null, error: error?.message ?? null };
}
