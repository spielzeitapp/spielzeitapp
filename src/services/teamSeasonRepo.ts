import { supabase } from '../lib/supabaseClient';

export type TeamSeasonTeam = { id: string; name: string; age_group?: string };
export type TeamSeasonSeason = { id: string; name: string };

export type TeamSeasonListItem = {
  id: number;
  team_id?: number;
  season_id?: number;
  team: TeamSeasonTeam;
  season: TeamSeasonSeason;
  /** Same as team, for UI label ts.teams?.name */
  teams?: TeamSeasonTeam;
  /** Same as season, for UI label ts.seasons?.name. No year – seasons table has only (id, name). */
  seasons?: TeamSeasonSeason;
};

/** Für UI: Saison-Anzeige ohne year (DB hat nur id, name). */
export function getSeasonLabel(item: TeamSeasonListItem | null | undefined): string {
  return item?.season?.name ?? '—';
}

/** Supabase kann teams/seasons als Objekt oder 1-elementiges Array zurückgeben. */
function normalizeRow(raw: unknown): TeamSeasonListItem | null {
  const row = raw as {
    id: number;
    team_id?: number;
    season_id?: number;
    teams?: TeamSeasonTeam | TeamSeasonTeam[] | null;
    seasons?: TeamSeasonSeason | TeamSeasonSeason[] | null;
  };
  const teams = Array.isArray(row.teams) ? row.teams[0] : row.teams;
  const seasons = Array.isArray(row.seasons) ? row.seasons[0] : row.seasons;
  if (teams && seasons) {
    return {
      id: row.id,
      team_id: row.team_id,
      season_id: row.season_id,
      team: teams,
      season: seasons,
      teams,
      seasons,
    };
  }
  return null;
}

/**
 * Lädt Team-Season-Kombinationen inkl. team + season Namen. seasons hat nur (id, name), kein year.
 */
export async function listTeamSeasons(): Promise<TeamSeasonListItem[]> {
  const { data, error } = await supabase
    .from('team_seasons')
    .select(`
  id,
  team_id,
  season_id,
  teams:teams ( id, name ),
  seasons:seasons ( id, name )
`)
    .order('id', { ascending: true });

  if (error) {
    console.error('[teamSeasonRepo] listTeamSeasons error:', error.message, error.details);
    return [];
  }

  const rows = (data ?? []) as unknown[];
  const result: TeamSeasonListItem[] = [];

  for (const raw of rows) {
    const item = normalizeRow(raw);
    if (item) result.push(item);
  }

  return result;
}
