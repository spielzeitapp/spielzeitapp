import {
  computeTrainingAttendanceStats,
  resolveTrainingAttendanceStatus,
  type TrainingAttendanceStats,
} from './trainingAttendance';
import { isPastTrainingEvent } from './eventFilters';
import { supabase } from './supabaseClient';

export type PastTrainingEvent = { id: string; starts_at: string };

export const EMPTY_TRAINING_STATS: TrainingAttendanceStats = {
  teamRatePct: 0,
  activityRatePct: 0,
  present: 0,
  absent: 0,
  injured: 0,
  external: 0,
  open: 0,
  legacyUnknown: 0,
  sessionsCounted: 0,
};

export async function fetchPastTrainingEvents(teamSeasonId: string): Promise<PastTrainingEvent[]> {
  const sid = teamSeasonId.trim();
  if (!sid) return [];
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const { data: events, error } = await supabase
    .from('events')
    .select('id, starts_at, kind, type, status')
    .eq('team_season_id', sid)
    .eq('kind', 'training')
    .lt('starts_at', nowIso)
    .not('status', 'in', '(canceled,cancelled,deleted,archived)')
    .order('starts_at', { ascending: false });

  if (error) throw error;
  return (events ?? [])
    .filter((row) => isPastTrainingEvent(row, nowMs))
    .map((row) => ({
      id: String((row as { id: string }).id),
      starts_at: String((row as { starts_at: string }).starts_at),
    }));
}

export function computeTrainingStatsForPlayer(
  eventRows: PastTrainingEvent[],
  attendanceByEventId: Map<string, string>,
  nowMs: number = Date.now(),
): TrainingAttendanceStats {
  if (eventRows.length === 0) return { ...EMPTY_TRAINING_STATS };
  const sessionStatuses = eventRows.map((ev) =>
    resolveTrainingAttendanceStatus(
      attendanceByEventId.get(String(ev.id).toLowerCase()),
      ev.starts_at,
      nowMs,
    ),
  );
  return computeTrainingAttendanceStats(sessionStatuses);
}

export async function loadPlayerTrainingStats(
  playerId: string,
  teamSeasonId: string,
): Promise<TrainingAttendanceStats> {
  const pid = playerId.trim();
  const events = await fetchPastTrainingEvents(teamSeasonId);
  if (!pid || events.length === 0) return { ...EMPTY_TRAINING_STATS };

  const eventIds = events.map((e) => e.id).filter(Boolean);
  const { data: attRows, error } = await supabase
    .from('event_attendance')
    .select('event_id, status')
    .eq('player_id', pid)
    .in('event_id', eventIds);

  if (error) throw error;

  const statusByEvent = new Map<string, string>();
  for (const r of attRows ?? []) {
    const row = r as { event_id: string; status: string };
    statusByEvent.set(String(row.event_id).toLowerCase(), row.status);
  }

  return computeTrainingStatsForPlayer(events, statusByEvent);
}

export async function loadTeamPlayersTrainingStats(
  playerIds: string[],
  teamSeasonId: string,
): Promise<{ events: PastTrainingEvent[]; statsByPlayerId: Map<string, TrainingAttendanceStats> }> {
  const normalizedIds = [...new Set(playerIds.map((id) => id.trim()).filter(Boolean))];
  const statsByPlayerId = new Map<string, TrainingAttendanceStats>();
  for (const id of normalizedIds) {
    statsByPlayerId.set(id, { ...EMPTY_TRAINING_STATS });
  }

  const events = await fetchPastTrainingEvents(teamSeasonId);
  if (events.length === 0 || normalizedIds.length === 0) {
    return { events, statsByPlayerId };
  }

  const eventIds = events.map((e) => e.id).filter(Boolean);
  const { data: attRows, error } = await supabase
    .from('event_attendance')
    .select('event_id, player_id, status')
    .in('event_id', eventIds)
    .in('player_id', normalizedIds);

  if (error) throw error;

  const attendanceByPlayer = new Map<string, Map<string, string>>();
  for (const id of normalizedIds) {
    attendanceByPlayer.set(id.toLowerCase(), new Map());
  }
  for (const r of attRows ?? []) {
    const row = r as { event_id: string; player_id: string; status: string };
    const pid = String(row.player_id).toLowerCase();
    const map = attendanceByPlayer.get(pid);
    if (!map) continue;
    map.set(String(row.event_id).toLowerCase(), row.status);
  }

  const nowMs = Date.now();
  for (const id of normalizedIds) {
    const attMap = attendanceByPlayer.get(id.toLowerCase()) ?? new Map();
    statsByPlayerId.set(id, computeTrainingStatsForPlayer(events, attMap, nowMs));
  }

  return { events, statsByPlayerId };
}
