/**
 * Read-only Helper für team_season_players (STEP 3).
 * usePlayers bleibt unverändert auf players.team_season_id.
 * Diese Funktionen sind vorbereitet für STEP 4 Dual-Read.
 */
import { supabase } from './supabaseClient';
import { isRosterJoinV1Enabled } from './featureFlags';

export type TeamSeasonRosterRow = {
  roster_id: string;
  team_season_id: string;
  player_id: string;
  jersey_number: number | null;
  season_position: string | null;
  season_status: string;
  season_is_active: boolean;
  season_is_laz_player: boolean;
  joined_at: string | null;
  left_at: string | null;
  first_name: string | null;
  last_name: string | null;
  cutout_url: string | null;
  is_injured: boolean | null;
  injured_since: string | null;
  injured_until: string | null;
  players_team_season_id: string | null;
};

/** Ob die App den Join-Pfad nutzen soll (STEP 3: immer false, außer Flag). */
export function shouldUseRosterJoin(): boolean {
  return isRosterJoinV1Enabled();
}

/**
 * Liest Kader einer Season aus v_team_season_roster (bzw. Fallback Join).
 * Wird in STEP 3 nur für Validierung/Probe genutzt — nicht von usePlayers.
 */
export async function listTeamSeasonRoster(
  teamSeasonId: string,
): Promise<{ data: TeamSeasonRosterRow[]; error: string | null }> {
  const sid = teamSeasonId?.trim();
  if (!sid) return { data: [], error: 'team_season_id fehlt' };

  const { data, error } = await supabase
    .from('v_team_season_roster')
    .select(
      [
        'roster_id',
        'team_season_id',
        'player_id',
        'jersey_number',
        'season_position',
        'season_status',
        'season_is_active',
        'season_is_laz_player',
        'joined_at',
        'left_at',
        'first_name',
        'last_name',
        'cutout_url',
        'is_injured',
        'injured_since',
        'injured_until',
        'players_team_season_id',
      ].join(', '),
    )
    .eq('team_season_id', sid)
    .order('jersey_number', { ascending: true, nullsFirst: false });

  if (error) {
    // Fallback ohne View (falls Migration noch nicht deployed)
    const fb = await supabase
      .from('team_season_players')
      .select(
        'id, team_season_id, player_id, jersey_number, position, status, is_active, is_laz_player, joined_at, left_at, players:players ( first_name, last_name, cutout_url, is_injured, injured_since, injured_until, team_season_id )',
      )
      .eq('team_season_id', sid)
      .order('jersey_number', { ascending: true, nullsFirst: false });

    if (fb.error) return { data: [], error: error.message };

    const mapped: TeamSeasonRosterRow[] = ((fb.data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const p = (Array.isArray(row.players) ? row.players[0] : row.players) as
        | Record<string, unknown>
        | null
        | undefined;
      return {
        roster_id: String(row.id),
        team_season_id: String(row.team_season_id),
        player_id: String(row.player_id),
        jersey_number: row.jersey_number != null ? Number(row.jersey_number) : null,
        season_position: row.position != null ? String(row.position) : null,
        season_status: String(row.status ?? 'active'),
        season_is_active: row.is_active !== false,
        season_is_laz_player: row.is_laz_player === true,
        joined_at: row.joined_at != null ? String(row.joined_at) : null,
        left_at: row.left_at != null ? String(row.left_at) : null,
        first_name: p?.first_name != null ? String(p.first_name) : null,
        last_name: p?.last_name != null ? String(p.last_name) : null,
        cutout_url: p?.cutout_url != null ? String(p.cutout_url) : null,
        is_injured: p?.is_injured === true,
        injured_since: p?.injured_since != null ? String(p.injured_since) : null,
        injured_until: p?.injured_until != null ? String(p.injured_until) : null,
        players_team_season_id: p?.team_season_id != null ? String(p.team_season_id) : null,
      };
    });
    return { data: mapped, error: null };
  }

  return { data: (data as TeamSeasonRosterRow[]) ?? [], error: null };
}
