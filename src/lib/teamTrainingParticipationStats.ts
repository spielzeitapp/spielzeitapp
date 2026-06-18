import {
  computeSessionParticipationPct,
  computeSessionParticipationPctExact,
  countTrainingAttendanceByStatus,
  resolveTrainingAttendanceStatusForStats,
  type TrainingAttendanceCounts,
  type TrainingAttendanceStatus,
} from './trainingAttendance';
import type { PastTrainingEvent } from './trainingStatsLoader';
import { fetchPastTrainingEvents } from './trainingStatsLoader';
import { supabase } from './supabaseClient';

export type TrainingSessionParticipation = {
  eventId: string;
  startsAt: string;
  counts: TrainingAttendanceCounts;
  participationPct: number | null;
};

export function computeEventParticipationFromStatuses(
  statuses: TrainingAttendanceStatus[],
): TrainingSessionParticipation['counts'] & { participationPct: number | null } {
  const counts = countTrainingAttendanceByStatus(statuses);
  return {
    ...counts,
    participationPct: computeSessionParticipationPct(counts),
  };
}

export function averageSessionParticipationPct(exactRates: Array<number | null | undefined>): number | null {
  const valid = exactRates.filter((r): r is number => r != null && Number.isFinite(r));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, r) => sum + r, 0) / valid.length);
}

export function computeSquadParticipationPct(sessions: TrainingSessionParticipation[]): number | null {
  const exactRates = sessions.map((s) => computeSessionParticipationPctExact(s.counts));
  return averageSessionParticipationPct(exactRates);
}

export function buildSessionParticipations(
  events: PastTrainingEvent[],
  activePlayerIds: string[],
  attendanceByEventId: Map<string, Map<string, string>>,
  nowMs: number = Date.now(),
): TrainingSessionParticipation[] {
  const roster = activePlayerIds.map((id) => id.trim().toLowerCase()).filter(Boolean);

  return events.map((ev) => {
    const eventKey = String(ev.id).toLowerCase();
    const byPlayer = attendanceByEventId.get(eventKey) ?? new Map<string, string>();
    const statuses = roster.map((playerId) =>
      resolveTrainingAttendanceStatusForStats(byPlayer.get(playerId), ev.starts_at, nowMs),
    );
    const { participationPct, ...counts } = computeEventParticipationFromStatuses(statuses);
    return {
      eventId: ev.id,
      startsAt: ev.starts_at,
      counts,
      participationPct,
    };
  });
}


export async function loadSquadTrainingParticipation(
  teamSeasonId: string,
  activePlayerIds: string[],
): Promise<{ squadParticipationPct: number | null; sessions: TrainingSessionParticipation[] }> {
  const sid = teamSeasonId.trim();
  const playerIds = [...new Set(activePlayerIds.map((id) => id.trim()).filter(Boolean))];
  if (!sid || playerIds.length === 0) {
    return { squadParticipationPct: null, sessions: [] };
  }

  const events = await fetchPastTrainingEvents(sid);
  if (events.length === 0) {
    return { squadParticipationPct: null, sessions: [] };
  }

  const eventIds = events.map((e) => e.id).filter(Boolean);
  const { data: attRows, error } = await supabase
    .from('event_attendance')
    .select('event_id, player_id, status')
    .in('event_id', eventIds)
    .in('player_id', playerIds);

  if (error) throw error;

  const attendanceByEventId = new Map<string, Map<string, string>>();
  for (const ev of events) {
    attendanceByEventId.set(String(ev.id).toLowerCase(), new Map());
  }
  for (const row of attRows ?? []) {
    const r = row as { event_id: string; player_id: string; status: string };
    const eventKey = String(r.event_id).toLowerCase();
    const map = attendanceByEventId.get(eventKey);
    if (!map) continue;
    map.set(String(r.player_id).toLowerCase(), r.status);
  }

  const sessions = buildSessionParticipations(events, playerIds, attendanceByEventId);
  return {
    squadParticipationPct: computeSquadParticipationPct(sessions),
    sessions,
  };
}
