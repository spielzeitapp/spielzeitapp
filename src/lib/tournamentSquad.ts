import { supabase } from './supabaseClient';
import {
  getDemoTournamentEventIdForMatch,
  getDemoTournamentSquadPlayerIds,
  isDemoTournamentEventId,
  setDemoTournamentSquadPlayerIds,
} from '../demo/demoTournamentState';

export async function fetchTournamentEventIdForMatch(matchId: string): Promise<string | null> {
  const id = String(matchId ?? '').trim();
  if (!id) return null;

  const demoEventId = getDemoTournamentEventIdForMatch(id);
  if (demoEventId) return demoEventId;

  const { data, error } = await supabase
    .from('tournament_matches')
    .select('tournament_event_id')
    .eq('match_id', id)
    .maybeSingle();

  if (error) return null;
  return String((data as { tournament_event_id?: string | null } | null)?.tournament_event_id ?? '').trim() || null;
}

export async function fetchTournamentSquadPlayerIds(
  tournamentEventId: string,
): Promise<{ data: string[]; error: string | null }> {
  const eventId = String(tournamentEventId ?? '').trim();
  if (!eventId) return { data: [], error: 'Turnier-Event fehlt.' };

  if (isDemoTournamentEventId(eventId)) {
    return { data: getDemoTournamentSquadPlayerIds(eventId), error: null };
  }

  const { data, error } = await supabase
    .from('tournament_squad')
    .select('player_id')
    .eq('tournament_event_id', eventId);

  if (error) return { data: [], error: error.message };

  const ids = (data ?? [])
    .map((row) => String((row as { player_id?: string | null }).player_id ?? '').trim())
    .filter(Boolean);

  return { data: ids, error: null };
}

export async function saveTournamentSquad(
  tournamentEventId: string,
  playerIds: string[],
  expectedPlayerIds: string[],
): Promise<{ error: string | null }> {
  const eventId = String(tournamentEventId ?? '').trim();
  if (!eventId) return { error: 'Turnier-Event fehlt.' };

  const unique = [...new Set(playerIds.map((id) => String(id ?? '').trim()).filter(Boolean))];

  if (isDemoTournamentEventId(eventId)) {
    setDemoTournamentSquadPlayerIds(eventId, unique);
    return { error: null };
  }

  const { error } = await supabase.rpc('save_tournament_squad_draft', {
    p_event: eventId,
    p_players: unique,
    p_expected: expectedPlayerIds,
  });
  return { error: error?.message ?? null };
}

export type TournamentSquadPublication = {
  selected_player_ids: string[];
  version: number;
  published_at: string;
};

export async function getTournamentSquadPublication(eventId: string) {
  const { data, error } = await supabase
    .from('tournament_squad_publications')
    .select('selected_player_ids, version, published_at')
    .eq('event_id', eventId)
    .maybeSingle();
  return { data: data as TournamentSquadPublication | null, error };
}

export async function publishTournamentSquad(
  eventId: string,
  selectedIds: string[],
  version: number,
  messages: { selected: string; notSelected: string },
) {
  const { data, error } = await supabase.rpc('publish_tournament_squad', {
    p_event: eventId,
    p_expected: selectedIds,
    p_version: version,
    p_selected_message: messages.selected.trim(),
    p_not_selected_message: messages.notSelected.trim(),
  });
  return { data: data as TournamentSquadPublication | null, error };
}

/** RSVP-Event: Turnier-Event bei Turnierspielen, sonst Match-Event. */
export async function resolveAttendanceEventIdForMatch(matchId: string): Promise<string | null> {
  const tournamentEventId = await fetchTournamentEventIdForMatch(matchId);
  if (tournamentEventId) return tournamentEventId;

  const { data: events, error } = await supabase
    .from('events')
    .select('id')
    .eq('match_id', matchId)
    .order('starts_at', { ascending: false })
    .limit(1);

  if (error) return null;
  return String(events?.[0]?.id ?? '').trim() || null;
}
