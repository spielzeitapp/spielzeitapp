import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Spieler-IDs dieses Users, die im Kader dieser team_season sind (Guardian + player_users).
 */
export async function fetchPlayerIdsForUserInTeamSeason(
  admin: SupabaseClient,
  userId: string,
  teamSeasonId: string,
): Promise<string[]> {
  const { data: players, error: pErr } = await admin
    .from('players')
    .select('id')
    .eq('team_season_id', teamSeasonId)
    .eq('is_active', true);
  if (pErr) throw pErr;
  const rosterIds = new Set((players ?? []).map((p: { id: string }) => p.id));

  const { data: g, error: gErr } = await admin
    .from('player_guardians')
    .select('player_id')
    .eq('user_id', userId);
  if (gErr) throw gErr;
  const fromG = (g ?? [])
    .map((x: { player_id: string }) => x.player_id)
    .filter((id: string) => rosterIds.has(id));

  const { data: pu, error: puErr } = await admin.from('player_users').select('player_id').eq('user_id', userId);
  if (puErr) throw puErr;
  const fromPu = (pu ?? [])
    .map((x: { player_id: string }) => x.player_id)
    .filter((id: string) => rosterIds.has(id));

  return Array.from(new Set([...fromG, ...fromPu]));
}

/** User mit Membership parent/player für diese Saison (Reminder-Empfänger). */
export async function fetchRecipientUserIdsForTeamSeason(
  admin: SupabaseClient,
  teamSeasonId: string,
): Promise<string[]> {
  const { data: members, error } = await admin
    .from('memberships')
    .select('user_id')
    .eq('team_season_id', teamSeasonId)
    .in('role', ['parent', 'player']);
  if (error) throw error;
  const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  return Array.from(new Set(ids));
}
