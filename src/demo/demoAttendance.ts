/**
 * Demo-Anfangs-Rückmeldungen (lokal, kein Supabase).
 * Spielerbasis: demoPlayers.ts (DEMO.2C).
 */

import type { AttendanceStatus, EventAttendanceData } from '../hooks/useEventsAttendance';
import { demoFixtures } from './demoFixtures';
import type { DemoEvent } from './demoTypes';
import {
  buildDemoPlayers,
  DEMO_LAZ_PLAYER_ID,
  DEMO_SELF_PLAYER_ID,
} from './demoPlayers';

export { buildDemoPlayers, DEMO_LAZ_PLAYER_ID, DEMO_SELF_PLAYER_ID } from './demoPlayers';

export type DemoAttendanceRow = {
  event_id: string;
  player_id: string;
  status: AttendanceStatus;
};

/**
 * Verteilt Fixture-RSVP-Zähler auf Spieler-IDs.
 * Status-Mix: yes / no / sick / injured / external_training / offen (keine Zeile).
 */
export function buildInitialDemoAttendance(events: DemoEvent[]): DemoAttendanceRow[] {
  const players = demoFixtures.players;
  const rows: DemoAttendanceRow[] = [];

  for (const ev of events) {
    const ids = players.map((p) => p.id);
    let i = 0;
    const take = (n: number, status: AttendanceStatus) => {
      for (let k = 0; k < n && i < ids.length; k += 1, i += 1) {
        rows.push({ event_id: ev.id, player_id: ids[i], status });
      }
    };

    const yes = Math.max(0, ev.rsvpYes);
    const noBlock = Math.max(0, ev.rsvpNo);
    const open = Math.max(0, ev.rsvpOpen);

    take(yes, 'yes');

    // Absagen aufteilen: no / sick / injured / LAZ (wenn Spieler übrig)
    let remainingNo = noBlock;
    if (remainingNo > 0 && i < ids.length) {
      take(1, 'no');
      remainingNo -= 1;
    }
    if (remainingNo > 0 && i < ids.length) {
      take(1, 'sick');
      remainingNo -= 1;
    }
    if (remainingNo > 0 && i < ids.length) {
      take(1, 'injured');
      remainingNo -= 1;
    }
    if (remainingNo > 0 && i < ids.length) {
      const pid = ids[i];
      take(1, pid === DEMO_LAZ_PLAYER_ID || remainingNo > 0 ? 'external_training' : 'no');
      remainingNo -= 1;
    }
    while (remainingNo > 0 && i < ids.length) {
      take(1, 'no');
      remainingNo -= 1;
    }

    // Offene: keine Zeilen (i wird weitergezählt ohne Push)
    i += open;
    void i;
  }

  // Demo-Nutzer (p08) hat auf dem nächsten Training eine sichtbare Ausgangs-Zusage
  const selfTrain = rows.find((r) => r.event_id === 'ev-train-next' && r.player_id === DEMO_SELF_PLAYER_ID);
  if (!selfTrain) {
    rows.push({ event_id: 'ev-train-next', player_id: DEMO_SELF_PLAYER_ID, status: 'yes' });
  }

  return rows;
}

export function attendanceRowsToByEventId(
  rows: DemoAttendanceRow[],
  eventIds: string[],
): Record<string, EventAttendanceData> {
  const out: Record<string, EventAttendanceData> = {};
  for (const id of eventIds) {
    out[id] = {
      yes: 0,
      no: 0,
      sick: 0,
      injured: 0,
      external: 0,
      unavailable: 0,
      availabilityByPlayerId: {},
    };
  }
  for (const r of rows) {
    const bucket = out[r.event_id];
    if (!bucket) continue;
    const pid = r.player_id.toLowerCase();
    bucket.availabilityByPlayerId[pid] = r.status;
    if (r.status === 'yes') bucket.yes += 1;
    else if (r.status === 'no') bucket.no += 1;
    else if (r.status === 'sick') bucket.sick += 1;
    else if (r.status === 'injured') bucket.injured += 1;
    else if (r.status === 'external_training') bucket.external += 1;
    if (r.status === 'no' || r.status === 'sick' || r.status === 'injured' || r.status === 'external_training') {
      bucket.unavailable += 1;
    }
  }
  return out;
}
