import { supabase } from './supabaseClient';

export function isTeamTrainingParticipationRpcMissingError(message: string): boolean {
  return /get_team_training_participation_pct/i.test(message);
}

export async function fetchTeamTrainingParticipationPct(
  teamSeasonId: string,
): Promise<{ pct: number | null; error: string | null; rpcMissing: boolean }> {
  const sid = teamSeasonId.trim();
  if (!sid) {
    return { pct: null, error: null, rpcMissing: false };
  }

  const { data, error } = await supabase.rpc('get_team_training_participation_pct', {
    p_team_season_id: sid,
  });

  if (error) {
    const msg = error.message ?? 'Trainingsbeteiligung konnte nicht geladen werden.';
    if (isTeamTrainingParticipationRpcMissingError(msg)) {
      return { pct: null, error: msg, rpcMissing: true };
    }
    if (/not allowed/i.test(msg)) {
      return { pct: null, error: 'Keine Berechtigung für diese Übersicht.', rpcMissing: false };
    }
    return { pct: null, error: msg, rpcMissing: false };
  }

  if (data == null) {
    return { pct: null, error: null, rpcMissing: false };
  }

  const pct = typeof data === 'number' ? Math.round(data) : Number(data);
  if (!Number.isFinite(pct)) {
    return { pct: null, error: null, rpcMissing: false };
  }

  return { pct, error: null, rpcMissing: false };
}
