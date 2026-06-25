import { supabase } from './supabaseClient';

export async function fetchTournamentEventIdForMatch(matchId: string): Promise<string | null> {
  const id = String(matchId ?? '').trim();
  if (!id) return null;

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
): Promise<{ error: string | null }> {
  const eventId = String(tournamentEventId ?? '').trim();
  if (!eventId) return { error: 'Turnier-Event fehlt.' };

  const unique = [...new Set(playerIds.map((id) => String(id ?? '').trim()).filter(Boolean))];

  const { error: delErr } = await supabase.from('tournament_squad').delete().eq('tournament_event_id', eventId);
  if (delErr) return { error: delErr.message };

  if (unique.length === 0) return { error: null };

  const rows = unique.map((player_id) => ({ tournament_event_id: eventId, player_id }));
  const { error: insErr } = await supabase.from('tournament_squad').insert(rows);
  return { error: insErr?.message ?? null };
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
