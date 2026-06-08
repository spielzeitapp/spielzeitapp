import { supabase } from './supabaseClient';
import type { TournamentFinalSummary } from './tournamentFinalSummary';

export type TournamentCompletionState = {
  completedAt: string | null;
  completedBy: string | null;
  finalPlacement: number | null;
  finalTeamsCount: number | null;
  finalLabel: string | null;
};

const COMPLETION_COLUMNS =
  'tournament_completed_at, tournament_completed_by, tournament_final_placement, tournament_final_teams_count, tournament_final_label';

function mapCompletionRow(row: Record<string, unknown> | null): TournamentCompletionState {
  return {
    completedAt: (row?.tournament_completed_at as string | null) ?? null,
    completedBy: (row?.tournament_completed_by as string | null) ?? null,
    finalPlacement:
      row?.tournament_final_placement == null
        ? null
        : Number(row.tournament_final_placement),
    finalTeamsCount:
      row?.tournament_final_teams_count == null
        ? null
        : Number(row.tournament_final_teams_count),
    finalLabel: (row?.tournament_final_label as string | null) ?? null,
  };
}

export async function fetchTournamentCompletion(
  eventId: string,
): Promise<{ data: TournamentCompletionState; error: string | null }> {
  const { data, error } = await supabase
    .from('events')
    .select(COMPLETION_COLUMNS)
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    if (/tournament_completed|column/i.test(error.message ?? '')) {
      return {
        data: {
          completedAt: null,
          completedBy: null,
          finalPlacement: null,
          finalTeamsCount: null,
          finalLabel: null,
        },
        error: null,
      };
    }
    return { data: mapCompletionRow(null), error: error.message };
  }

  return { data: mapCompletionRow((data ?? null) as Record<string, unknown>), error: null };
}

export async function completeTournamentEvent(params: {
  eventId: string;
  userId: string;
  summary: TournamentFinalSummary;
}): Promise<{ data: TournamentCompletionState | null; error: string | null }> {
  const payload = {
    tournament_completed_at: new Date().toISOString(),
    tournament_completed_by: params.userId,
    tournament_final_placement: params.summary.finalPlacementRank,
    tournament_final_teams_count: params.summary.finalPlacementTotal,
    tournament_final_label: params.summary.finalPlacementLabel,
  };

  const { data, error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', params.eventId)
    .select(COMPLETION_COLUMNS)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: mapCompletionRow((data ?? null) as Record<string, unknown>), error: null };
}
