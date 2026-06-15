import { supabase } from './supabaseClient';
import { isInactiveEventStatus } from './eventFilters';

/**
 * Match-IDs, die für Saisonsstatistik zählen:
 * - Liga/Freundschaftsspiel mit aktivem Event
 * - Turnierspiel mit aktivem Turnier-Event
 * Keine verwaisten Import-/Turnier-Leichen ohne Event.
 */
export async function fetchValidSeasonMatchIds(teamSeasonId: string): Promise<Set<string>> {
  const sid = teamSeasonId.trim();
  const valid = new Set<string>();
  if (!sid) return valid;

  const { data: matchEvents, error: matchEvErr } = await supabase
    .from('events')
    .select('match_id, status, kind')
    .eq('team_season_id', sid)
    .eq('kind', 'match')
    .not('match_id', 'is', null);

  if (!matchEvErr) {
    for (const row of matchEvents ?? []) {
      const mid = (row as { match_id?: string | null }).match_id;
      if (!mid || isInactiveEventStatus((row as { status?: string | null }).status)) continue;
      valid.add(String(mid));
    }
  }

  const { data: tournamentEvents, error: tourEvErr } = await supabase
    .from('events')
    .select('id, status')
    .eq('team_season_id', sid)
    .eq('kind', 'tournament');

  if (!tourEvErr) {
    const activeTournamentIds = (tournamentEvents ?? [])
      .filter((row) => !isInactiveEventStatus((row as { status?: string | null }).status))
      .map((row) => String((row as { id: string }).id));

    if (activeTournamentIds.length > 0) {
      const { data: tmRows, error: tmErr } = await supabase
        .from('tournament_matches')
        .select('match_id')
        .in('tournament_event_id', activeTournamentIds);

      if (!tmErr) {
        for (const row of tmRows ?? []) {
          const mid = (row as { match_id?: string }).match_id;
          if (mid) valid.add(String(mid));
        }
      }
    }
  }

  return valid;
}

export type VisibleSeasonMatch = {
  id: string;
  opponent: string | null;
  match_date: string | null;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
};

/** Sichtbare Saison-Spiele (nur an aktive Events gebunden, wie Trainerstatistik). */
export async function fetchVisibleSeasonMatches(
  teamSeasonId: string,
  limit?: number,
): Promise<VisibleSeasonMatch[]> {
  const sid = teamSeasonId.trim();
  if (!sid) return [];

  const validIds = await fetchValidSeasonMatchIds(sid);
  if (validIds.size === 0) return [];

  let query = supabase
    .from('matches')
    .select('id, opponent, match_date, status, score_home, score_away')
    .eq('team_season_id', sid)
    .in('id', [...validIds])
    .order('match_date', { ascending: false });

  if (limit != null && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as VisibleSeasonMatch[];
}
