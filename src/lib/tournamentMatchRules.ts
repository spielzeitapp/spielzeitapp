import { supabase } from './supabaseClient';

export type TournamentMatchRules = {
  duration: number;
  minimum: number | null;
  penalty: number;
};

export const DEFAULT_TOURNAMENT_MATCH_RULES: TournamentMatchRules = {
  duration: 12,
  minimum: null,
  penalty: 2,
};

export async function fetchTournamentMatchRules(eventId: string) {
  const { data, error } = await supabase.from('events')
    .select('tournament_match_rules').eq('id', eventId).maybeSingle();
  return { rules: (data?.tournament_match_rules ?? null) as TournamentMatchRules | null, error: error?.message };
}

export async function saveTournamentMatchRules(eventId: string, rules: TournamentMatchRules, expected: TournamentMatchRules | null) {
  const { data, error } = await supabase.rpc('save_tournament_match_rules', {
    p_event: eventId, p_duration: rules.duration, p_minimum: rules.minimum,
    p_penalty: rules.penalty, p_expected: expected,
  });
  return { rules: data as TournamentMatchRules | null, error: error?.message };
}
