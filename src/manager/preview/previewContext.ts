import { supabase } from '../../lib/supabaseClient';
import { fetchUserRole, type SessionTeamSeasonItem } from '../../auth/useSession';

const STAFF_ROLES = new Set(['trainer', 'head_coach', 'co_trainer']);
const isUuid = (value: string) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

/** Read the existing team context, without changing the Manager's selection.
 * Staff need a matching membership; club administrators need the existing scoped RPC.
 * All reads still run with the signed-in user's RLS permissions.
 */
export async function loadPreviewTeamSeason(userId: string, clubId: string, seasonId: string): Promise<SessionTeamSeasonItem> {
  if (!userId || !isUuid(clubId) || !isUuid(seasonId)) throw Error('Bitte eine gültige Mannschaft und Saison auswählen.');
  if (await fetchUserRole(userId) !== 'admin') {
    const [membership, clubs] = await Promise.all([
      supabase.from('memberships').select('role').eq('user_id', userId).eq('team_season_id', seasonId),
      supabase.rpc('manager_list_my_club_admin_team_seasons'),
    ]);
    const staff = !membership.error && membership.data?.some(row => STAFF_ROLES.has(String(row.role).toLowerCase()));
    const clubAdmin = !clubs.error && clubs.data?.some((row: {club_id: string; team_season_id: string}) => row.club_id === clubId && row.team_season_id === seasonId);
    if (!staff && !clubAdmin) throw Error('Für diese Mannschaft ist kein Manager-Zugang vorhanden.');
  }
  const {data, error} = await supabase.from('team_seasons').select(`
    id, team_id, season_id, status, display_name, age_group,
    teams:teams(id, name, club_id, age_group, clubs(name, logo_url)),
    seasons:seasons(id, name)
  `).eq('id', seasonId).maybeSingle();
  if (error) throw Error(error.message);
  const team = one(data?.teams);
  const season = one(data?.seasons);
  if (!data || !team || !season || team.club_id !== clubId) throw Error('Mannschaft und Verein passen nicht zusammen oder sind nicht verfügbar.');
  const club = one(team.clubs);
  const normalizedTeam = {...team, logo_url: club?.logo_url ?? null};
  return {...data, team: normalizedTeam, teams: normalizedTeam, season, seasons: season} as unknown as SessionTeamSeasonItem;
}
