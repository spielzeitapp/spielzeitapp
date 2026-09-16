import { supabase } from './supabaseClient';

export type MatchSquadPublication = {
  match_id: string;
  event_id: string;
  selected_player_ids: string[];
  version: number;
  published_at: string;
};

export async function getMatchSquadPublication(matchId: string): Promise<{
  data: MatchSquadPublication | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('match_squad_publications')
    .select('match_id, event_id, selected_player_ids, version, published_at')
    .eq('match_id', matchId)
    .maybeSingle();
  return { data: (data as MatchSquadPublication | null) ?? null, error: error?.message ?? null };
}

export async function publishMatchSquad(matchId: string): Promise<{
  ok: boolean;
  error: string | null;
  version?: number;
  publishedAt?: string;
}> {
  const { data, error } = await supabase.rpc('publish_match_squad', { p_match_id: matchId });
  if (error) return { ok: false, error: error.message };
  const result = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (result.ok !== true) {
    const code = String(result.error ?? 'publish_failed');
    const friendly = code === 'empty_squad'
      ? 'Bitte zuerst mindestens einen Spieler in den Kader aufnehmen.'
      : code === 'forbidden'
        ? 'Keine Berechtigung zum Veröffentlichen des Kaders.'
        : 'Kader konnte nicht veröffentlicht werden.';
    return { ok: false, error: friendly };
  }
  return {
    ok: true,
    error: null,
    version: Number(result.version ?? 1),
    publishedAt: typeof result.published_at === 'string' ? result.published_at : new Date().toISOString(),
  };
}
