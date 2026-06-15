import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  isPlayerAppStatusRpcMissingError,
  parsePlayerAppStatus,
  type PlayerAppStatusRow,
} from '../lib/playerAppStatus';

function mapRow(raw: Record<string, unknown>): PlayerAppStatusRow {
  return {
    player_id: String(raw.player_id),
    app_status: parsePlayerAppStatus(raw.app_status),
    last_used_at:
      typeof raw.last_used_at === 'string' && raw.last_used_at.trim() !== ''
        ? raw.last_used_at
        : null,
  };
}

export async function fetchTeamPlayerAppStatus(
  teamSeasonId: string,
): Promise<{ rows: PlayerAppStatusRow[]; error: string | null; rpcMissing: boolean }> {
  const { data, error } = await supabase.rpc('get_team_player_app_status', {
    p_team_season_id: teamSeasonId,
  });

  if (error) {
    const msg = error.message ?? 'Spieler-App-Status konnte nicht geladen werden.';
    if (isPlayerAppStatusRpcMissingError(msg)) {
      return { rows: [], error: msg, rpcMissing: true };
    }
    if (/not allowed/i.test(msg)) {
      return { rows: [], error: 'Keine Berechtigung für diese Übersicht.', rpcMissing: false };
    }
    return { rows: [], error: msg, rpcMissing: false };
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  return { rows, error: null, rpcMissing: false };
}

export function useTeamPlayerAppStatus(teamSeasonId: string | null, enabled = true) {
  const [rows, setRows] = useState<PlayerAppStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpcMissing, setRpcMissing] = useState(false);

  const refetch = useCallback(async () => {
    if (!teamSeasonId || !enabled) {
      setRows([]);
      setLoading(false);
      setError(null);
      setRpcMissing(false);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await fetchTeamPlayerAppStatus(teamSeasonId);
    setRpcMissing(result.rpcMissing);

    if (result.error) {
      setRows([]);
      setError(result.error);
      setLoading(false);
      return;
    }

    setRows(result.rows);
    setLoading(false);
  }, [teamSeasonId, enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { rows, loading, error, rpcMissing, refetch };
}
