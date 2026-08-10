import { useCallback, useEffect, useState } from 'react';
import type { PlayerItem } from './usePlayers';
import {
  listHistoricalEventTrainingRoster,
  listHistoricalSeasonTrainingRoster,
} from '../lib/historicalTrainingRoster';

/**
 * Historischer Trainingskader für Archiv-Saison oder einzelnes Training.
 * enabled=false → leere Liste (kein Fetch).
 */
export function useHistoricalTrainingRoster(
  teamSeasonId: string | null,
  opts?: {
    enabled?: boolean;
    /** Wenn gesetzt: Event-Kader (aktiv ∪ Attendance dieses Events). */
    eventId?: string | null;
  },
) {
  const enabled = opts?.enabled !== false;
  const eventId = (opts?.eventId ?? '').trim() || null;
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const sid = (teamSeasonId ?? '').trim();
    if (!enabled || !sid) {
      setPlayers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = eventId
        ? await listHistoricalEventTrainingRoster(sid, eventId)
        : await listHistoricalSeasonTrainingRoster(sid);
      if (res.error) {
        setError(res.error);
        setPlayers([]);
      } else {
        setPlayers(res.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [teamSeasonId, enabled, eventId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { players, loading, error, refetch };
}
