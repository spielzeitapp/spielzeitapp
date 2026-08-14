import { supabase } from './supabaseClient';
import { safeText } from './safeText';
import {
  sortTournamentGoalScorers,
  type TournamentGoalScorer,
  aggregateTournamentGoalScorers,
  fetchTournamentGoalScorers,
} from './tournamentGoalScorers';

export type TournamentManualGoalScorerRow = {
  id: string;
  eventId: string;
  playerId: string;
  goals: number;
};

function formatPlayerDisplayName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const fn = safeText(first);
  const ln = safeText(last);
  return [fn, ln].join(' ').replace(/\s+/g, ' ').trim() || 'Spieler';
}

export function mergeTournamentGoalScorerCounts(
  matchEventCounts: Map<string, number>,
  manualCounts: Map<string, number>,
): Map<string, number> {
  const merged = new Map(matchEventCounts);
  for (const [playerId, goals] of manualCounts) {
    merged.set(playerId, (merged.get(playerId) ?? 0) + goals);
  }
  return merged;
}

async function resolvePlayerNames(playerIds: string[]): Promise<Map<string, string>> {
  const nameById = new Map<string, string>();
  if (playerIds.length === 0) return nameById;

  const { data: players, error } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .in('id', playerIds);

  if (error) return nameById;

  for (const player of players ?? []) {
    const row = player as { id: string; first_name?: string | null; last_name?: string | null };
    nameById.set(row.id, formatPlayerDisplayName(row.first_name, row.last_name));
  }
  return nameById;
}

export async function fetchTournamentManualGoalScorers(
  eventId: string,
): Promise<{ data: TournamentManualGoalScorerRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('tournament_manual_goal_scorers')
    .select('id, event_id, player_id, goals')
    .eq('event_id', eventId);

  if (error) {
    if (/tournament_manual_goal_scorers|does not exist|schema cache/i.test(error.message ?? '')) {
      return { data: [], error: null };
    }
    return { data: [], error: error.message };
  }

  return {
    data: (data ?? []).map((row) => {
      const r = row as {
        id: string;
        event_id: string;
        player_id: string;
        goals: number;
      };
      return {
        id: r.id,
        eventId: r.event_id,
        playerId: r.player_id,
        goals: Number(r.goals ?? 0),
      };
    }),
    error: null,
  };
}

export async function upsertTournamentManualGoalScorer(params: {
  eventId: string;
  playerId: string;
  goals: number;
  userId: string | null;
}): Promise<{ error: string | null }> {
  const goals = Math.trunc(params.goals);
  if (!Number.isFinite(goals) || goals < 1) {
    return { error: 'Bitte mindestens 1 Tor eingeben.' };
  }

  const { error } = await supabase.from('tournament_manual_goal_scorers').upsert(
    {
      event_id: params.eventId,
      player_id: params.playerId,
      goals,
      created_by: params.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,player_id' },
  );

  return { error: error?.message ?? null };
}

export async function fetchTournamentCombinedGoalScorers(params: {
  matchIds: string[];
  eventId: string;
}): Promise<{
  data: TournamentGoalScorer[];
  hasMatchEventGoals: boolean;
  error: string | null;
}> {
  if (String(params.eventId ?? '').trim() === 'ev-tournament') {
    return { data: [], hasMatchEventGoals: false, error: null };
  }

  const [matchResult, manualResult] = await Promise.all([
    fetchTournamentGoalScorers(params.matchIds),
    fetchTournamentManualGoalScorers(params.eventId),
  ]);

  if (matchResult.error) {
    return { data: [], hasMatchEventGoals: false, error: matchResult.error };
  }
  if (manualResult.error) {
    return { data: [], hasMatchEventGoals: false, error: manualResult.error };
  }

  const matchCounts = new Map(
    matchResult.data.map((row) => [row.playerId, row.goals] as const),
  );
  const manualCounts = new Map(
    manualResult.data.map((row) => [row.playerId, row.goals] as const),
  );
  const merged = mergeTournamentGoalScorerCounts(matchCounts, manualCounts);
  const playerIds = [...merged.keys()];

  const nameById = await resolvePlayerNames(playerIds);
  for (const row of matchResult.data) {
    if (!nameById.has(row.playerId)) nameById.set(row.playerId, row.playerName);
  }

  const hasMatchEventGoals = matchResult.data.length > 0;

  return {
    data: sortTournamentGoalScorers(
      playerIds.map((playerId) => ({
        playerId,
        playerName: nameById.get(playerId) ?? 'Spieler',
        goals: merged.get(playerId) ?? 0,
      })),
    ),
    hasMatchEventGoals,
    error: null,
  };
}

/** Nur für Tests/Diagnose: Zähler aus match_events ohne Spielernamen. */
export async function countTournamentMatchEventGoals(
  matchIds: string[],
): Promise<number> {
  const ids = [...new Set(matchIds.map((id) => safeText(id)).filter(Boolean))];
  if (ids.length === 0) return 0;

  const { data, error } = await supabase
    .from('match_events')
    .select('player_id, type')
    .in('match_id', ids)
    .eq('type', 'goal');

  if (error) return 0;
  return aggregateTournamentGoalScorers((data ?? []) as { player_id: string | null; type: string | null }[]).size;
}
