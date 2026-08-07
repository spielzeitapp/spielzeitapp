import { supabase } from './supabaseClient';
import {
  getDemoTournamentCompletion,
  isDemoTournamentEventId,
  setDemoTournamentCompletion,
} from '../demo/demoTournamentState';

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
  if (isDemoTournamentEventId(eventId)) {
    return { data: getDemoTournamentCompletion(eventId), error: null };
  }

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
  placement: number | null;
  teamsCount: number | null;
  label: string | null;
}): Promise<{ data: TournamentCompletionState | null; error: string | null }> {
  const mapped: TournamentCompletionState = {
    completedAt: new Date().toISOString(),
    completedBy: params.userId || 'demo-trainer',
    finalPlacement: params.placement,
    finalTeamsCount: params.teamsCount,
    finalLabel: params.label?.trim() || null,
  };

  if (isDemoTournamentEventId(params.eventId)) {
    setDemoTournamentCompletion(params.eventId, mapped);
    return { data: mapped, error: null };
  }

  const payload = {
    tournament_completed_at: mapped.completedAt,
    tournament_completed_by: params.userId,
    tournament_final_placement: params.placement,
    tournament_final_teams_count: params.teamsCount,
    tournament_final_label: params.label?.trim() || null,
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
