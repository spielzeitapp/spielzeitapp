import { useCallback, useEffect, useState } from 'react';
import {
  computeTrainingAttendanceStats,
  dbStatusToTrainingAttendance,
  type TrainingAttendanceStats,
} from '../lib/trainingAttendance';
import { supabase } from '../lib/supabaseClient';

const EMPTY_STATS: TrainingAttendanceStats = {
  ratePct: 0,
  present: 0,
  absent: 0,
  injured: 0,
  open: 0,
  sessionsCounted: 0,
};

/**
 * Trainingsbeteiligung eines Spielers in der Saison (nur vergangene Einheiten für die Quote).
 */
export function usePlayerTrainingStats(playerId: string | null, teamSeasonId: string | null) {
  const [stats, setStats] = useState<TrainingAttendanceStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const pid = (playerId ?? '').trim();
    const sid = (teamSeasonId ?? '').trim();
    if (!pid || !sid) {
      setStats(EMPTY_STATS);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      const { data: events, error: evErr } = await supabase
        .from('events')
        .select('id, starts_at')
        .eq('team_season_id', sid)
        .eq('kind', 'training')
        .lt('starts_at', nowIso)
        .neq('status', 'canceled')
        .order('starts_at', { ascending: false });

      if (evErr) throw evErr;
      const eventRows = (events ?? []) as { id: string; starts_at: string }[];
      const eventIds = eventRows.map((e) => e.id).filter(Boolean);
      if (eventIds.length === 0) {
        setStats(EMPTY_STATS);
        return;
      }

      const { data: attRows, error: attErr } = await supabase
        .from('event_attendance')
        .select('event_id, status')
        .eq('player_id', pid)
        .in('event_id', eventIds);

      if (attErr) throw attErr;

      const statusByEvent = new Map<string, string>();
      for (const r of attRows ?? []) {
        const row = r as { event_id: string; status: string };
        statusByEvent.set(String(row.event_id).toLowerCase(), row.status);
      }

      const sessionStatuses = eventIds.map((eid) =>
        dbStatusToTrainingAttendance(statusByEvent.get(eid.toLowerCase())),
      );
      setStats(computeTrainingAttendanceStats(sessionStatuses));
    } catch (e) {
      setStats(EMPTY_STATS);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [playerId, teamSeasonId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, loading, error, refetch: load };
}
