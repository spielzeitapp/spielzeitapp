/** Training-Teilnahme (UI); Match/Event nutzt weiterhin yes/no. */

export type TrainingAttendanceStatus =
  | 'open'
  | 'present'
  | 'absent'
  | 'injured'
  | 'external'
  | 'legacy_unknown';

export type TrainingAttendanceDbStatus = 'yes' | 'no' | 'injured' | 'external_training';

export type TrainingAttendanceStats = {
  /** Team-Trainingsbeteiligung: yes / (yes + no) */
  teamRatePct: number;
  /** Trainingsaktivität gesamt: (yes + external) / (yes + external + no) */
  activityRatePct: number;
  present: number;
  absent: number;
  injured: number;
  external: number;
  open: number;
  legacyUnknown: number;
  sessionsCounted: number;
};

const TRAINING_STATUS_LABEL: Record<TrainingAttendanceStatus, string> = {
  open: 'Offen',
  present: 'Dabei',
  absent: 'Abwesend',
  injured: 'Verletzt',
  external: 'LAZ',
  legacy_unknown: 'Nicht erfasst',
};

export function trainingAttendanceLabel(status: TrainingAttendanceStatus): string {
  return TRAINING_STATUS_LABEL[status];
}

/** DB-Zeile → UI-Status (nur wenn Zeile existiert). */
export function dbStatusToTrainingAttendance(
  raw: string | null | undefined,
): TrainingAttendanceStatus | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'yes') return 'present';
  if (s === 'no') return 'absent';
  if (s === 'injured') return 'injured';
  if (s === 'external_training') return 'external';
  if (s === 'maybe') return 'legacy_unknown';
  return 'legacy_unknown';
}

/**
 * Fehlende Zeile: vergangenes Training → legacy_unknown; zukünftiges/aktuelles → open.
 */
export function resolveTrainingAttendanceStatus(
  rawDbStatus: string | null | undefined,
  _eventStartsAtIso: string | null | undefined,
  _nowMs: number = Date.now(),
): TrainingAttendanceStatus {
  const mapped = dbStatusToTrainingAttendance(rawDbStatus);
  if (mapped) return mapped;
  // Fachregel Training: Ohne Ausnahme gilt ein aktiver Spieler als dabei.
  return 'present';
}

export function trainingAttendanceToDb(status: TrainingAttendanceStatus): TrainingAttendanceDbStatus | null {
  if (status === 'open' || status === 'legacy_unknown') return null;
  if (status === 'present') return 'yes';
  if (status === 'absent') return 'no';
  if (status === 'external') return 'external_training';
  return 'injured';
}

export function trainingAttendanceBucketRank(status: TrainingAttendanceStatus): number {
  if (status === 'open') return 0;
  if (status === 'legacy_unknown') return 1;
  if (status === 'present') return 2;
  if (status === 'external') return 3;
  if (status === 'injured') return 4;
  return 5;
}

function pct(num: number, denom: number): number {
  return denom > 0 ? Math.round((num / denom) * 100) : 0;
}

/**
 * Training-Übersicht (Trainer): Dabei = aktiv − (Abwesend + Verletzt + LAZ).
 * LAZ zählt zu „Nicht da“, ist aber kein Absage-Status.
 */
export function countTrainingOverviewFromStatuses(
  statuses: TrainingAttendanceStatus[],
  activePlayerCount: number,
): { present: number; notPresent: number } {
  const c = countTrainingAttendanceByStatus(statuses);
  const notPresent = c.absent + c.injured + c.external;
  return { present: Math.max(0, activePlayerCount - notPresent), notPresent };
}

/**
 * Nur für Profil-Auswertung (vergangene Einheiten, bereits aufgelöste Status).
 * injured, open, legacy_unknown nicht im Nenner; LAZ nicht als Absage.
 */
export function computeTrainingAttendanceStats(
  sessionStatuses: TrainingAttendanceStatus[],
): TrainingAttendanceStats {
  let present = 0;
  let absent = 0;
  let injured = 0;
  let external = 0;
  let open = 0;
  let legacyUnknown = 0;

  for (const st of sessionStatuses) {
    if (st === 'present') present += 1;
    else if (st === 'absent') absent += 1;
    else if (st === 'injured') injured += 1;
    else if (st === 'external') external += 1;
    else if (st === 'legacy_unknown') legacyUnknown += 1;
    else open += 1;
  }

  const teamDenom = present + absent;
  const activityDenom = present + external + absent;

  return {
    teamRatePct: pct(present, teamDenom),
    activityRatePct: pct(present + external, activityDenom),
    present,
    absent,
    injured,
    external,
    open,
    legacyUnknown,
    sessionsCounted: sessionStatuses.length,
  };
}

export type TrainingAttendanceCounts = Pick<
  TrainingAttendanceStats,
  'present' | 'absent' | 'injured' | 'external' | 'open' | 'legacyUnknown'
>;

export function countTrainingAttendanceByStatus(statuses: TrainingAttendanceStatus[]): TrainingAttendanceCounts {
  const s = computeTrainingAttendanceStats(statuses);
  return {
    present: s.present,
    absent: s.absent,
    injured: s.injured,
    external: s.external,
    open: s.open,
    legacyUnknown: s.legacyUnknown,
  };
}

/**
 * Termine-Karten (Training): gleiche Zählregel wie TrainingAttendancePanel —
 * nur aktive Kader-Spieler, fehlende event_attendance-Zeile = Dabei.
 */
export function trainingScheduleCardCounts(params: {
  rosterPlayerIds: string[];
  availabilityByPlayerId?: Record<string, string | null | undefined>;
  startsAtIso?: string | null;
}): { yes: number; no: number; open: number } {
  const byPlayer = params.availabilityByPlayerId ?? {};
  const statuses = params.rosterPlayerIds.map((playerId) =>
    resolveTrainingAttendanceStatus(
      byPlayer[(playerId ?? '').toLowerCase()] ?? null,
      params.startsAtIso ?? null,
    ),
  );
  const c = countTrainingAttendanceByStatus(statuses);
  return {
    yes: c.present,
    no: c.absent + c.injured + c.external,
    open: 0,
  };
}
