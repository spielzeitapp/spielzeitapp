import { normalizeMatchEventGoalType } from './matchEventScores';
import { supabase } from './supabaseClient';

export type TournamentGoalScorer = {
  playerId: string;
  playerName: string;
  goals: number;
};

type GoalEventRow = {
  player_id: string | null;
  type: string | null;
};

function formatPlayerDisplayName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const fn = (first ?? '').trim();
  const ln = (last ?? '').trim();
  return [fn, ln].join(' ').replace(/\s+/g, ' ').trim() || 'Spieler';
}

/** Turnierspiele: wir sind Heim — nur `goal`-Events zählen. */
export function aggregateTournamentGoalScorers(
  events: ReadonlyArray<GoalEventRow>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (normalizeMatchEventGoalType(event.type) !== 'goal') continue;
    const playerId = event.player_id?.trim();
    if (!playerId) continue;
    counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
  }
  return counts;
}

export function sortTournamentGoalScorers(rows: TournamentGoalScorer[]): TournamentGoalScorer[] {
  return [...rows].sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    return a.playerName.localeCompare(b.playerName, 'de');
  });
}

export async function fetchTournamentGoalScorers(
  matchIds: string[],
): Promise<{ data: TournamentGoalScorer[]; error: string | null }> {
  const ids = [...new Set(matchIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { data: [], error: null };

  const { data: goalsData, error: goalsError } = await supabase
    .from('match_events')
    .select('player_id, type')
    .in('match_id', ids)
    .eq('type', 'goal');

  if (goalsError) return { data: [], error: goalsError.message };

  const counts = aggregateTournamentGoalScorers((goalsData ?? []) as GoalEventRow[]);
  const playerIds = [...counts.keys()];
  if (playerIds.length === 0) return { data: [], error: null };

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .in('id', playerIds);

  if (playersError) return { data: [], error: playersError.message };

  const nameById = new Map<string, string>();
  for (const player of players ?? []) {
    const row = player as { id: string; first_name?: string | null; last_name?: string | null };
    nameById.set(row.id, formatPlayerDisplayName(row.first_name, row.last_name));
  }

  return {
    data: sortTournamentGoalScorers(
      playerIds.map((playerId) => ({
        playerId,
        playerName: nameById.get(playerId) ?? 'Spieler',
        goals: counts.get(playerId) ?? 0,
      })),
    ),
    error: null,
  };
}
