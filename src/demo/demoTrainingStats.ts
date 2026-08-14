/**
 * Demo-Trainingsstatistik aus Events + lokaler Attendance (DEMO.2D).
 * Nutzt dieselben produktiven Helper wie die App (Ja/(Ja+Nein), neutrale Status).
 */

import type { EventRow } from '../hooks/useEvents';
import {
  computeTrainingAttendanceStats,
  resolveTrainingAttendanceStatusForStats,
  type TrainingAttendanceStats,
} from '../lib/trainingAttendance';
import {
  buildSessionParticipations,
  computeSquadParticipationPct,
  type TrainingSessionParticipation,
} from '../lib/teamTrainingParticipationStats';
import type { PastTrainingEvent } from '../lib/trainingStatsLoader';
import { EMPTY_TRAINING_STATS } from '../lib/trainingStatsLoader';
import { isPastTrainingEvent } from '../lib/eventFilters';
import { demoOffsetIso } from './demoTime';
import { getDemoFixturePlayer, getDemoTrainingParticipationPct } from './demoPlayers';
import type { AttendanceStatus } from '../hooks/useEventsAttendance';

type DemoAttendanceRow = {
  event_id: string;
  player_id: string;
  status: AttendanceStatus;
};

/** Gleicher Wert wie DEMO_TEAM_SEASON_ID (kein Import-Zyklus mit demoDataSource). */
const DEMO_SEASON_ID = '00000000-demo-4000-8000-teamseasonu12';

/** Anzahl fiktiver vergangener Trainings für Quote/Ranking (zusätzlich zu Fixture-Trainings). */
export const DEMO_TRAINING_HISTORY_COUNT = 14;

export function demoTrainingHistoryEventIds(): string[] {
  return Array.from({ length: DEMO_TRAINING_HISTORY_COUNT }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return `ev-train-h${n}`;
  });
}

export function isDemoTrainingSeasonId(teamSeasonId: string | null | undefined): boolean {
  return (teamSeasonId ?? '').trim() === DEMO_SEASON_ID;
}

function isCanceledTraining(ev: Pick<EventRow, 'id' | 'status' | 'notes'>): boolean {
  const st = String(ev.status ?? '').toLowerCase();
  if (st === 'canceled' || st === 'cancelled' || st === 'deleted' || st === 'archived') return true;
  return ev.id === 'ev-train-canceled' || /\babgesagt\b/i.test(ev.notes ?? '');
}

/** Vergangene, gültige Demo-Trainings (wie fetchPastTrainingEvents). */
export function getDemoPastTrainingEvents(
  events: EventRow[],
  nowMs: number = Date.now(),
): PastTrainingEvent[] {
  return events
    .filter((ev) => ev.kind === 'training' && !isCanceledTraining(ev))
    .filter((ev) => isPastTrainingEvent(ev, nowMs))
    .map((ev) => ({ id: ev.id, starts_at: ev.starts_at }))
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
}

export function countDemoUpcomingTrainings(
  events: EventRow[],
  nowMs: number = Date.now(),
): number {
  const nowIso = new Date(nowMs).toISOString();
  return events.filter(
    (ev) =>
      ev.kind === 'training' &&
      !isCanceledTraining(ev) &&
      ev.starts_at >= nowIso,
  ).length;
}

/** EventRows für die historische Trainingsbasis (nur für buildDemoEvents). */
export function buildDemoTrainingHistoryEventRows(): EventRow[] {
  return demoTrainingHistoryEventIds().map((id, i) => {
    // Älter als ev-train-past (−7): weiter zurück, alle 3–4 Tage
    const daysAgo = 28 + i * 3;
    const starts = demoOffsetIso(-daysAgo, 17, 0);
    return {
      id,
      team_season_id: DEMO_SEASON_ID,
      kind: 'training' as const,
      type: 'training',
      match_type: null,
      opponent: null,
      is_home: true,
      location: 'Sportplatz Rohrbach',
      address: null,
      starts_at: starts,
      meeting_at: null,
      status: 'finished' as const,
      attendance_mode: 'opt_in' as const,
      notes: 'Trainer: Markus Demo',
      match_id: null,
      series_id: null,
      training_absence_deadline_disabled: null,
      created_by: null,
      created_at: starts,
      updated_at: null,
      fixture_status: null,
    };
  });
}

/**
 * Deterministische History-Attendance passend zu Fixture-trainingPct.
 * p08 @ 93 % → z. B. 13 Dabei / 1 Abwesend bei 14 History-Sessions (+ Fixture-Past).
 */
export function buildDemoTrainingHistoryAttendance(
  playerIds: string[],
  historyEventIds: string[] = demoTrainingHistoryEventIds(),
): DemoAttendanceRow[] {
  const rows: DemoAttendanceRow[] = [];
  const n = historyEventIds.length;
  if (n === 0) return rows;

  for (const playerId of playerIds) {
    const pct = getDemoTrainingParticipationPct(playerId);
    const seed = playerId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const neutralCount = Math.min(pct < 75 ? 1 + (seed % 2) : seed % 2, Math.max(0, n - 1));
    const valuable = Math.max(1, n - neutralCount);
    const absentCount = Math.max(0, Math.min(valuable, Math.round((valuable * (100 - pct)) / 100)));

    const statuses: AttendanceStatus[] = Array.from({ length: n }, () => 'yes');
    const used = new Set<number>();

    const pickIndex = (offset: number): number => {
      for (let k = 0; k < n; k += 1) {
        const idx = (offset + k) % n;
        if (!used.has(idx)) {
          used.add(idx);
          return idx;
        }
      }
      return 0;
    };

    for (let a = 0; a < absentCount; a += 1) {
      statuses[pickIndex(seed + a * 3)] = 'no';
    }
    for (let i = 0; i < neutralCount; i += 1) {
      const idx = pickIndex(seed * 2 + i * 5);
      const kind = (seed + i) % 3;
      statuses[idx] = kind === 0 ? 'sick' : kind === 1 ? 'injured' : 'external_training';
    }

    const fixture = getDemoFixturePlayer(playerId);
    if (fixture && !fixture.available) {
      const yesIdx = statuses.findIndex((s) => s === 'yes');
      if (yesIdx >= 0) statuses[yesIdx] = 'external_training';
    }

    historyEventIds.forEach((eventId, i) => {
      rows.push({ event_id: eventId, player_id: playerId, status: statuses[i] });
    });
  }

  return rows;
}

function attendanceMapForPlayer(
  rows: DemoAttendanceRow[],
  playerId: string,
): Map<string, string> {
  const m = new Map<string, string>();
  const pid = playerId.toLowerCase();
  for (const r of rows) {
    if (r.player_id.toLowerCase() !== pid) continue;
    m.set(r.event_id.toLowerCase(), r.status);
  }
  return m;
}

export function getDemoPlayerTrainingStatsFromAttendance(
  playerId: string,
  pastEvents: PastTrainingEvent[],
  attendanceRows: DemoAttendanceRow[],
  nowMs: number = Date.now(),
): TrainingAttendanceStats {
  if (pastEvents.length === 0) return { ...EMPTY_TRAINING_STATS };
  const byEvent = attendanceMapForPlayer(attendanceRows, playerId);
  const sessionStatuses = pastEvents.map((ev) =>
    resolveTrainingAttendanceStatusForStats(byEvent.get(ev.id.toLowerCase()), ev.starts_at, nowMs),
  );
  return computeTrainingAttendanceStats(sessionStatuses);
}

export function buildDemoStatsByPlayerId(
  playerIds: string[],
  pastEvents: PastTrainingEvent[],
  attendanceRows: DemoAttendanceRow[],
  nowMs: number = Date.now(),
): Map<string, TrainingAttendanceStats> {
  return new Map(
    playerIds.map((id) => [
      id,
      getDemoPlayerTrainingStatsFromAttendance(id, pastEvents, attendanceRows, nowMs),
    ]),
  );
}

export function buildDemoSessionParticipations(
  pastEvents: PastTrainingEvent[],
  activePlayerIds: string[],
  attendanceRows: DemoAttendanceRow[],
  nowMs: number = Date.now(),
): TrainingSessionParticipation[] {
  const attendanceByEventId = new Map<string, Map<string, string>>();
  for (const r of attendanceRows) {
    const ek = r.event_id.toLowerCase();
    let inner = attendanceByEventId.get(ek);
    if (!inner) {
      inner = new Map();
      attendanceByEventId.set(ek, inner);
    }
    inner.set(r.player_id.toLowerCase(), r.status);
  }
  return buildSessionParticipations(pastEvents, activePlayerIds, attendanceByEventId, nowMs);
}

export function computeDemoSquadParticipationPct(
  sessions: TrainingSessionParticipation[],
): number | null {
  return computeSquadParticipationPct(sessions);
}
